/**
 * DRM track vocabulary (ANT-942, slice 3 client).
 *
 * Mirrors the server contract from ANT-940 (`entitlement.dto.ts`):
 * two tracks, one gate. The desktop never invents new tracks —
 * unknown values from the server are treated as denials (fail-closed).
 */

export const TRACKS = ['offchain', 'onchain'] as const;
export type Track = (typeof TRACKS)[number];

export const DEFAULT_TRACK: Track = 'offchain';

export function isTrack(value: unknown): value is Track {
  return value === 'offchain' || value === 'onchain';
}

export function normalizeTrack(value: unknown, fallback: Track = DEFAULT_TRACK): Track {
  return isTrack(value) ? value : fallback;
}

/** Deny reasons returned by `POST /v1/entitlements/check` (ANT-940 FR3). */
export type DenyReason =
  | 'not_purchased'
  | 'revoked'
  | 'refunded'
  | 'device_limit'
  | 'version_not_covered'
  | 'onchain_unconfirmed'
  | 'wrong_wallet'
  | 'sync_lag';

/** Local (offline) deny reasons produced by the desktop gate itself. */
export type LocalDenyReason =
  | 'offline_no_license'
  | 'offline_expired'
  | 'offline_tampered'
  | 'offline_device_mismatch'
  | 'offline_not_covered'
  | 'track_required'
  | 'url_expired';

export type GateDenyReason = DenyReason | LocalDenyReason;

const DENY_MESSAGES: Record<GateDenyReason, string> = {
  not_purchased: 'Game ini belum dibeli untuk edisi ini. Silakan beli dulu.',
  revoked: 'Lisensi dicabut. Hubungi publisher untuk detailnya.',
  refunded: 'Pembelian sudah di-refund, lisensi tidak berlaku lagi.',
  device_limit: 'Batas perangkat tercapai untuk edisi ini. Keluarkan perangkat lain dulu.',
  version_not_covered: 'Versi ini tidak tercakup lisensi. Update ke versi yang didukung.',
  onchain_unconfirmed: 'Transaksi onchain belum final. Tunggu konfirmasi jaringan lalu coba lagi.',
  wrong_wallet: 'Wallet yang terhubung bukan pemilik lisensi ini.',
  sync_lag: 'Data onchain belum sinkron. Coba lagi sebentar lagi (butuh online).',
  offline_no_license: 'Belum ada lisensi offline. Butuh online untuk verifikasi pertama.',
  offline_expired: 'Lisensi offline kedaluwarsa. Butuh online untuk memperbarui.',
  offline_tampered: 'Lisensi offline tidak valid. Butuh online untuk verifikasi ulang.',
  offline_device_mismatch: 'Lisensi ini terikat ke perangkat lain.',
  offline_not_covered: 'Versi terinstal tidak tercakup lisensi offline.',
  track_required: 'Pilih edisi dulu (OFF atau ON).',
  url_expired: 'Link download kedaluwarsa. Minta link baru (butuh online).',
};

export function denyMessage(reason: GateDenyReason): string {
  return DENY_MESSAGES[reason] ?? 'Akses ditolak. Coba lagi atau hubungi dukungan.';
}

/** Human chain labels for the ON-track gas badge (FR7 / AC#15). */
const CHAIN_LABELS: Record<string, string> = {
  'eip155:84532': 'Base Sepolia',
  'eip155:8453': 'Base',
  'solana:devnet': 'Solana Devnet',
  'solana:mainnet': 'Solana',
};

export function chainLabel(chain: string): string {
  return CHAIN_LABELS[chain] ?? chain;
}
