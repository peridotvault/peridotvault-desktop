/**
 * Stable device id for the DRM device bind (ANT-942).
 *
 * The server enforces `maxDevices` per track; the desktop must send a
 * stable `deviceId` with every `check` / `download-url` call so the
 * server can count devices and return `device_limit` denials.
 *
 * No Tauri machine-id plugin is bundled, so the id is a persisted
 * random UUID scoped to this app profile (localStorage). It survives
 * restarts, which is what the server's device counting needs. If
 * localStorage is unavailable (private mode), an in-memory id is used
 * and the caller is told it is ephemeral.
 */

const STORAGE_KEY = 'peridotvault.deviceId.v1';

function randomId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let memoryFallback: string | null = null;

export type DeviceIdSource = 'stored' | 'created' | 'ephemeral';

export function getDeviceId(): { deviceId: string; source: DeviceIdSource } {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && UUID_RE.test(existing.trim())) {
      return { deviceId: existing.trim(), source: 'stored' };
    }
    const fresh = randomId();
    localStorage.setItem(STORAGE_KEY, fresh);
    return { deviceId: fresh, source: existing ? 'created' : 'created' };
  } catch {
    if (!memoryFallback) memoryFallback = randomId();
    return { deviceId: memoryFallback, source: 'ephemeral' };
  }
}
