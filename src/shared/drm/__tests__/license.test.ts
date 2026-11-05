/**
 * Offline license verification tests (ANT-942 AC#4 offline grace in/expiry,
 * AC#6 tamper rejected, NFR local verify <100ms).
 *
 * Vectors are generated at runtime with tweetnacl (same Ed25519 the server
 * uses) so the signature path is exercised for real; tamper flips 1 byte
 * of the payload segment and must fail closed.
 */
import { describe, expect, it } from 'vitest';
import * as nacl from 'tweetnacl';
import { verifyLicense, type LicensePayload } from '../license';

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlJson(value: unknown): string {
  return b64url(new TextEncoder().encode(JSON.stringify(value)));
}

function signToken(payload: Record<string, unknown>, secretKey: Uint8Array): string {
  const header = b64urlJson({ alg: 'EdDSA', typ: 'JWT', kid: 'drm-v1' });
  const body = b64urlJson(payload);
  const sig = nacl.sign.detached(new TextEncoder().encode(`${header}.${body}`), secretKey);
  return `${header}.${body}.${b64url(sig)}`;
}

const NOW = 1_800_000_000;
const GAME = 'game-1';
const TRACK = 'offchain' as const;
const DEVICE = 'device-abc';

function setup() {
  const kp = nacl.sign.keyPair();
  const pubB64 = Buffer.from(kp.publicKey).toString('base64');
  const base: LicensePayload = {
    sub: 'user-1', game: GAME, ver: '1.0.1', ent: 'ent-1', dev: DEVICE,
    trk: TRACK, iat: NOW - 60, exp: NOW + 3600, grace: true,
  };
  return { kp, pubB64, base };
}

describe('verifyLicense (offline JWT)', () => {
  it('AC#4: valid license within grace verifies (NFR <100ms)', () => {
    const { kp, pubB64, base } = setup();
    const token = signToken({ ...base }, kp.secretKey);
    const res = verifyLicense(token, pubB64, { gameId: GAME, track: TRACK, deviceId: DEVICE, version: '1.0.1', nowSeconds: NOW });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.ent).toBe('ent-1');
      expect(res.verifyMs).toBeLessThan(100);
    }
  });

  it('AC#4: past expiry blocks even with skew (exp + 300s < now)', () => {
    const { kp, pubB64, base } = setup();
    const token = signToken({ ...base, exp: NOW - 301 }, kp.secretKey);
    const res = verifyLicense(token, pubB64, { gameId: GAME, track: TRACK, deviceId: DEVICE, nowSeconds: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.failure.code).toBe('offline_expired');
  });

  it('clock skew tolerance: exp 299s ago still verifies', () => {
    const { kp, pubB64, base } = setup();
    const token = signToken({ ...base, exp: NOW - 299 }, kp.secretKey);
    const res = verifyLicense(token, pubB64, { gameId: GAME, track: TRACK, deviceId: DEVICE, nowSeconds: NOW });
    expect(res.ok).toBe(true);
  });

  it('AC#6: 1-byte tamper in payload fails signature', () => {
    const { kp, pubB64, base } = setup();
    const token = signToken({ ...base }, kp.secretKey);
    const [h, b, s] = token.split('.');
    const tampered = (b[0] === 'A' ? 'B' : 'A') + b.slice(1);
    const res = verifyLicense(`${h}.${tampered}.${s}`, pubB64, { gameId: GAME, track: TRACK, deviceId: DEVICE, nowSeconds: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.failure.code).toBe('offline_tampered');
  });

  it('wrong key fails closed', () => {
    const { base } = setup();
    const other = nacl.sign.keyPair();
    const mine = nacl.sign.keyPair();
    const token = signToken({ ...base }, other.secretKey);
    const pubB64 = Buffer.from(mine.publicKey).toString('base64');
    const res = verifyLicense(token, pubB64, { gameId: GAME, track: TRACK, deviceId: DEVICE, nowSeconds: NOW });
    expect(res.ok).toBe(false);
  });

  it('device bind mismatch blocks', () => {
    const { kp, pubB64, base } = setup();
    const token = signToken({ ...base }, kp.secretKey);
    const res = verifyLicense(token, pubB64, { gameId: GAME, track: TRACK, deviceId: 'device-other', nowSeconds: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.failure.code).toBe('offline_device_mismatch');
  });

  it('track mismatch blocks (OFF license cannot open ON gate)', () => {
    const { kp, pubB64, base } = setup();
    const token = signToken({ ...base }, kp.secretKey);
    const res = verifyLicense(token, pubB64, { gameId: GAME, track: 'onchain', deviceId: DEVICE, nowSeconds: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.failure.code).toBe('offline_not_covered');
  });

  it('version not covered blocks launch of a newer build', () => {
    const { kp, pubB64, base } = setup();
    const token = signToken({ ...base, ver: '1.0.1' }, kp.secretKey);
    const res = verifyLicense(token, pubB64, { gameId: GAME, track: TRACK, deviceId: DEVICE, version: '1.0.2', nowSeconds: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.failure.code).toBe('offline_not_covered');
  });

  it('malformed token fails closed', () => {
    const { pubB64 } = setup();
    expect(verifyLicense('not.a.jwt.here', pubB64, { gameId: GAME, track: TRACK, nowSeconds: NOW }).ok).toBe(false);
    expect(verifyLicense('only.two', pubB64, { gameId: GAME, track: TRACK, nowSeconds: NOW }).ok).toBe(false);
  });
});
