/**
 * Offline Ed25519 license verification (ANT-942).
 *
 * Token shape (server: ANT-940 `LicenseJwtService`, compact JWS):
 *   base64url({"alg":"EdDSA","typ":"JWT","kid":"drm-v1"}).
 *   base64url({sub,game,ver,ent,dev,trk,own?,iat,exp,grace}).
 *   base64url(Ed25519 signature)
 *
 * The client holds the PUBLIC key only (fetched from
 * `GET /v1/entitlements/license-public-key`, cached locally).
 * No signing secrets ever enter this module.
 *
 * Checks, in order: format → signature → required claims → gameId →
 * track → device bind → expiry (with ±5min clock-skew tolerance).
 * A 1-byte tamper fails at the signature step.
 */

import * as nacl from 'tweetnacl';
import { isTrack, type Track } from './tracks';

export interface LicensePayload {
  sub: string;
  game: string;
  ver: string;
  ent: string;
  dev: string;
  trk: string;
  own?: string;
  iat: number;
  exp: number;
  grace: boolean;
}

/** ±5min clock-skew tolerance, same value as the server. */
export const CLOCK_SKEW_SECONDS = 300;

const REQUIRED_CLAIMS = ['sub', 'game', 'ver', 'ent', 'dev', 'trk'] as const;

function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (b64.length % 4)) % 4;
  const bin = atob(b64 + '='.repeat(pad));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type VerifyFailure =
  | { code: 'offline_tampered'; detail: string }
  | { code: 'offline_expired'; detail: string }
  | { code: 'offline_device_mismatch'; detail: string }
  | { code: 'offline_not_covered'; detail: string };

export type VerifyOk = { ok: true; payload: LicensePayload; verifyMs: number };
export type VerifyResult = VerifyOk | { ok: false; failure: VerifyFailure };

export interface VerifyExpect {
  gameId: string;
  track: Track;
  /** Device this desktop reports as. `undefined` skips the bind check (caller decides). */
  deviceId?: string;
  /** Installed/downloaded version; when set, must equal the licensed `ver`. */
  version?: string;
  nowSeconds?: number;
}

export function verifyLicense(
  token: string,
  publicKeyB64: string,
  expect: VerifyExpect,
): VerifyResult {
  const started = performance.now();
  const done = (payload: LicensePayload): VerifyOk => ({
    ok: true,
    payload,
    verifyMs: performance.now() - started,
  });
  const fail = (failure: VerifyFailure): VerifyResult => ({ ok: false, failure });

  let publicKey: Uint8Array;
  try {
    publicKey = b64ToBytes(publicKeyB64.trim());
  } catch {
    return fail({ code: 'offline_tampered', detail: 'bad public key encoding' });
  }
  if (publicKey.length !== 32) {
    return fail({ code: 'offline_tampered', detail: 'public key must be 32 bytes' });
  }

  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return fail({ code: 'offline_tampered', detail: 'invalid token format' });
  }

  let signature: Uint8Array;
  let payload: LicensePayload;
  try {
    signature = b64urlDecode(parts[2]);
    const msg = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    if (!nacl.sign.detached.verify(msg, signature, publicKey)) {
      return fail({ code: 'offline_tampered', detail: 'invalid signature' });
    }
    payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(parts[1])),
    ) as LicensePayload;
  } catch {
    return fail({ code: 'offline_tampered', detail: 'unreadable payload' });
  }

  for (const field of REQUIRED_CLAIMS) {
    if (!payload[field] || typeof payload[field] !== 'string') {
      return fail({ code: 'offline_tampered', detail: `missing claim ${field}` });
    }
  }

  // Game + track bind: a license for another game/track never opens this gate.
  if (payload.game !== expect.gameId) {
    return fail({ code: 'offline_not_covered', detail: 'game mismatch' });
  }
  if (!isTrack(payload.trk) || payload.trk !== expect.track) {
    return fail({ code: 'offline_not_covered', detail: 'track mismatch' });
  }
  if (expect.deviceId !== undefined && payload.dev !== expect.deviceId) {
    return fail({ code: 'offline_device_mismatch', detail: 'device bind mismatch' });
  }
  if (expect.version !== undefined && payload.ver !== expect.version) {
    return fail({ code: 'offline_not_covered', detail: 'version not covered' });
  }

  // Expiry with skew tolerance; `iat` in the future beyond skew = tampered clock/claims.
  const now = expect.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_SECONDS < now) {
    return fail({ code: 'offline_expired', detail: 'token expired' });
  }
  if (typeof payload.iat === 'number' && payload.iat - CLOCK_SKEW_SECONDS > now) {
    return fail({ code: 'offline_tampered', detail: 'issued in the future' });
  }

  return done(payload);
}

/** Offline license cache (one entry per game+track). localStorage so relaunch works offline. */
const licenseKey = (gameId: string, track: Track) =>
  `peridotvault.license.v1.${gameId}.${track}`;

export function cacheLicense(gameId: string, track: Track, token: string): void {
  try {
    localStorage.setItem(licenseKey(gameId, track), token);
  } catch {
    /* storage unavailable — online-only until restart */
  }
}

export function readCachedLicense(gameId: string, track: Track): string | null {
  try {
    return localStorage.getItem(licenseKey(gameId, track));
  } catch {
    return null;
  }
}

export function clearCachedLicense(gameId: string, track: Track): void {
  try {
    localStorage.removeItem(licenseKey(gameId, track));
  } catch {
    /* ignore */
  }
}

const PUBKEY_KEY = 'peridotvault.drm.pubkey.v1';

export function cachePublicKey(keyId: string, publicKeyB64: string): void {
  try {
    localStorage.setItem(PUBKEY_KEY, JSON.stringify({ keyId, publicKeyB64 }));
  } catch {
    /* ignore */
  }
}

export function readCachedPublicKey(): { keyId: string; publicKeyB64: string } | null {
  try {
    const raw = localStorage.getItem(PUBKEY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { keyId?: unknown; publicKeyB64?: unknown };
    if (typeof parsed.keyId === 'string' && typeof parsed.publicKeyB64 === 'string') {
      return { keyId: parsed.keyId, publicKeyB64: parsed.publicKeyB64 };
    }
    return null;
  } catch {
    return null;
  }
}
