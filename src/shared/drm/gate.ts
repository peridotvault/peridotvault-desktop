/**
 * Entitlement gate client (ANT-942, FR2/FR3 + offline JWT).
 *
 * Single online gate: `POST /v1/entitlements/check
 * {userId?, gameId, gameVersion, deviceId, track, walletAddress?}`.
 * Downloads only via `POST /v1/games/{id}/download-url` (TTL ≤ 15min,
 * fail-closed on the TTL boundary). The raw `download_url` from any
 * manifest endpoint is NEVER used for downloading.
 *
 * Offline launch path: verify the cached Ed25519 license locally
 * (signature + expiry + gameId + track + device bind). Within grace →
 * launch; past expiry → "butuh online" block; tampered → fail.
 *
 * The client emits `{track, deviceId}` on every request so the server
 * can audit `entitlement.checked|denied` (FR5). No PII or seed material
 * is ever placed in a JWT — the token is server-issued and opaque here.
 */

import { getDeviceId } from './deviceId';
import {
  cacheLicense,
  cachePublicKey,
  readCachedLicense,
  readCachedPublicKey,
  verifyLicense,
} from './license';
import { denyMessage, isTrack, type GateDenyReason, type Track } from './tracks';

export type { Track };

const MAX_TTL_SECONDS = 900; // 15min, mirrors server fail-closed cap

const apiBase = (): string =>
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') ?? '';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token =
      localStorage.getItem('peridotvault.access_token') ??
      localStorage.getItem('peridotvault.accessToken') ??
      sessionStorage.getItem('peridotvault.access_token');
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* storage unavailable — request goes unauthenticated, server decides */
  }
  return headers;
}

/** Envelope-tolerant unwrap: server wraps payloads in `{data}` (ResponseV1Interceptor). */
function unwrap<T>(json: unknown): T {
  if (json !== null && typeof json === 'object' && 'data' in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}

export interface CheckInput {
  gameId: string;
  gameVersion: string;
  track: Track;
  walletAddress?: string;
  userId?: string;
}

export interface CheckGranted {
  entitled: true;
  track: Track;
  licenseJwt: string;
  licenseExpiresAt: string;
  entitlementId: string;
  ownershipProof?: {
    chain: string;
    contract: string;
    tokenId: string;
    txHash: string | null;
    confirmedAt: string | null;
  };
}

export interface CheckDenied {
  entitled: false;
  track: Track;
  reason: string;
}

export type CheckResult = CheckGranted | CheckDenied;

export interface DownloadUrl {
  url: string;
  expiresAt: string;
  manifestHashSha256: string;
  track: Track;
}

export interface PublicKeyInfo {
  keyId: string;
  algorithm: string;
  publicKeyB64: string;
}

export class GateHttpError extends Error {
  status: number;
  reason: string;
  constructor(status: number, reason: string, message?: string) {
    super(message ?? denyMessage(reason as GateDenyReason));
    this.name = 'GateHttpError';
    this.status = status;
    this.reason = reason;
  }
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const base = apiBase();
  if (!base) throw new GateHttpError(0, 'sync_lag', 'API base URL belum dikonfigurasi.');
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
  } catch {
    throw new GateHttpError(0, 'sync_lag', 'Tidak ada koneksi. Butuh online untuk verifikasi.');
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const data = (json !== null && typeof json === 'object' ? json : {}) as Record<string, unknown>;
    const nested = (data.data ?? {}) as Record<string, unknown>;
    const reason =
      typeof nested.reason === 'string'
        ? nested.reason
        : typeof data.reason === 'string'
          ? data.reason
          : res.status === 400
            ? 'track_required'
            : 'sync_lag';
    const message =
      typeof nested.message === 'string'
        ? nested.message
        : typeof data.message === 'string'
          ? data.message
          : undefined;
    throw new GateHttpError(res.status, reason, message ?? denyMessage(reason as GateDenyReason));
  }
  return unwrap<T>(json);
}

async function getJson<T>(path: string): Promise<T> {
  const base = apiBase();
  if (!base) throw new GateHttpError(0, 'sync_lag', 'API base URL belum dikonfigurasi.');
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { headers: authHeaders() });
  } catch {
    throw new GateHttpError(0, 'sync_lag', 'Tidak ada koneksi. Butuh online untuk verifikasi.');
  }
  if (!res.ok) throw new GateHttpError(res.status, 'sync_lag');
  return unwrap<T>(await res.json());
}

/**
 * Single entitlement gate (FR2/FR3). Empty track is rejected client-side
 * with the same 400-class display the server returns.
 */
export async function checkEntitlement(input: {
  gameId: string;
  gameVersion: string;
  track: string;
  walletAddress?: string;
  userId?: string;
}): Promise<CheckResult> {
  if (!input.track) {
    throw new GateHttpError(400, 'track_required');
  }
  if (!isTrack(input.track)) {
    throw new GateHttpError(400, 'track_required', 'Edisi tidak dikenal. Pilih OFF atau ON.');
  }
  const { deviceId } = getDeviceId();
  const verdict = await postJson<CheckResult>('/api/v1/entitlements/check', {
    ...(input.userId ? { userId: input.userId } : {}),
    gameId: input.gameId,
    gameVersion: input.gameVersion,
    deviceId,
    track: input.track,
    ...(input.walletAddress ? { walletAddress: input.walletAddress } : {}),
  });
  // Cache the fresh license so the next offline launch can verify locally.
  if (verdict.entitled && verdict.licenseJwt) {
    cacheLicense(input.gameId, input.track, verdict.licenseJwt);
  }
  return verdict;
}

/**
 * TTL-bound signed download URL (FR2). Fail-closed: ttl outside 1..900
 * is rejected before any network call; expired URLs are never retried
 * silently — the caller must request a fresh one (online).
 */
export async function requestDownloadUrl(input: {
  gameId: string;
  gameVersion?: string;
  track: Track;
  walletAddress?: string;
  platform?: 'windows' | 'macos' | 'linux';
  ttlSeconds?: number;
}): Promise<DownloadUrl> {
  const ttl = input.ttlSeconds ?? MAX_TTL_SECONDS;
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > MAX_TTL_SECONDS) {
    throw new GateHttpError(400, 'url_expired', 'TTL harus 1..900 detik.');
  }
  const { deviceId } = getDeviceId();
  return postJson<DownloadUrl>(
    `/api/v1/games/${encodeURIComponent(input.gameId)}/download-url`,
    {
      ...(input.gameVersion ? { gameVersion: input.gameVersion } : {}),
      deviceId,
      track: input.track,
      ...(input.walletAddress ? { walletAddress: input.walletAddress } : {}),
      ...(input.platform ? { platform: input.platform } : {}),
      ttlSeconds: ttl,
    },
  );
}

/** Returns true while a TTL-bound URL is still usable (fail-closed on the boundary). */
export function isDownloadUrlFresh(expiresAt: string, nowMs = Date.now()): boolean {
  const exp = Date.parse(expiresAt);
  if (Number.isNaN(exp)) return false;
  return exp > nowMs;
}

export async function fetchLicensePublicKey(): Promise<PublicKeyInfo> {
  const info = await getJson<PublicKeyInfo>('/api/v1/entitlements/license-public-key');
  if (info?.publicKeyB64 && info?.keyId) {
    cachePublicKey(info.keyId, info.publicKeyB64);
  }
  return info;
}

async function resolvePublicKey(): Promise<string | null> {
  // Prefer a fresh key when online; fall back to the cached key offline.
  try {
    const info = await fetchLicensePublicKey();
    if (info?.publicKeyB64) return info.publicKeyB64;
  } catch {
    /* offline — use cache below */
  }
  return readCachedPublicKey()?.publicKeyB64 ?? null;
}

export type LaunchVerdict =
  | { allowed: true; mode: 'online' | 'offline-grace'; ownershipProof?: CheckGranted['ownershipProof'] }
  | { allowed: false; reason: GateDenyReason; message: string };

/**
 * Launch gate (FR3 + offline §). Online first: a live `check` decides and
 * refreshes the cached license. Offline: local JWT verify — within grace
 * (signature + expiry + bind OK) → launch; past expiry → "butuh online"
 * block; tampered/mismatch → fail. Never bypasses when offline past grace.
 *
 * `grace=0` (allowOffline=false) policies are represented by the ABSENCE
 * of a cached license being acceptable: pass `allowOffline=false` and the
 * offline path blocks immediately as online-only.
 */
export async function resolveLaunch(input: {
  gameId: string;
  gameVersion: string;
  track: Track;
  walletAddress?: string;
  userId?: string;
  /** From the game's policy; when false the offline path is online-only. */
  allowOffline?: boolean;
}): Promise<LaunchVerdict> {
  const { deviceId } = getDeviceId();

  // Online attempt first.
  try {
    const verdict = await checkEntitlement(input);
    if (verdict.entitled) {
      return { allowed: true, mode: 'online', ownershipProof: verdict.ownershipProof };
    }
    if (verdict.reason === 'revoked' || verdict.reason === 'refunded') {
      // Revocations close the offline path too: drop the cached license.
      const { clearCachedLicense } = await import('./license');
      clearCachedLicense(input.gameId, input.track);
    }
    return {
      allowed: false,
      reason: verdict.reason as GateDenyReason,
      message: denyMessage(verdict.reason as GateDenyReason),
    };
  } catch (err) {
    if (err instanceof GateHttpError && err.status !== 0) {
      // Server reached a verdict (400/403/...) — that is final, not a network issue.
      return { allowed: false, reason: err.reason as GateDenyReason, message: err.message };
    }
    // Network failure → offline path.
  }

  if (input.allowOffline === false) {
    return {
      allowed: false,
      reason: 'offline_expired',
      message: 'Edisi ini butuh online. Hubungkan internet untuk main.',
    };
  }

  const cached = readCachedLicense(input.gameId, input.track);
  if (!cached) {
    return {
      allowed: false,
      reason: 'offline_no_license',
      message: denyMessage('offline_no_license'),
    };
  }
  const publicKeyB64 = await resolvePublicKey();
  if (!publicKeyB64) {
    return {
      allowed: false,
      reason: 'offline_no_license',
      message: denyMessage('offline_no_license'),
    };
  }
  const result = verifyLicense(cached, publicKeyB64, {
    gameId: input.gameId,
    track: input.track,
    deviceId,
    version: input.gameVersion,
  });
  if (result.ok) {
    return { allowed: true, mode: 'offline-grace' };
  }
  const reason = result.failure.code;
  return {
    allowed: false,
    reason,
    message:
      reason === 'offline_expired'
        ? 'Lisensi offline kedaluwarsa. Butuh online untuk memperbarui.'
        : denyMessage(reason),
  };
}
