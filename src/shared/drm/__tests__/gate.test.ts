/**
 * Gate TTL + deny-message tests (ANT-942 edge: TTL-boundary fail-closed,
 * offline + grace=0 → online-only block, empty track → 400 display).
 */
import { describe, expect, it } from 'vitest';
import { isDownloadUrlFresh } from '../gate';
import { denyMessage } from '../tracks';

describe('isDownloadUrlFresh (TTL boundary, fail-closed)', () => {
  const NOW = 1_800_000_000_000;
  it('fresh URL passes', () => {
    expect(isDownloadUrlFresh(new Date(NOW + 60_000).toISOString(), NOW)).toBe(true);
  });
  it('exact boundary fails closed (exp == now)', () => {
    expect(isDownloadUrlFresh(new Date(NOW).toISOString(), NOW)).toBe(false);
  });
  it('expired URL fails', () => {
    expect(isDownloadUrlFresh(new Date(NOW - 1_000).toISOString(), NOW)).toBe(false);
  });
  it('unparseable expiry fails closed', () => {
    expect(isDownloadUrlFresh('not-a-date', NOW)).toBe(false);
    expect(isDownloadUrlFresh('', NOW)).toBe(false);
  });
});

describe('denyMessage (per-track UX copy)', () => {
  it('device_limit denial is surfaced per track', () => {
    expect(denyMessage('device_limit')).toMatch(/perangkat/i);
  });
  it('past-grace offline block says butuh online', () => {
    expect(denyMessage('offline_expired')).toMatch(/online/i);
  });
  it('empty-track display exists', () => {
    expect(denyMessage('track_required')).toMatch(/edisi/i);
  });
  it('sync_lag tells the user to retry online', () => {
    expect(denyMessage('sync_lag')).toMatch(/online/i);
  });
  it('wrong_wallet and onchain_unconfirmed have distinct messages', () => {
    expect(denyMessage('wrong_wallet')).not.toBe(denyMessage('onchain_unconfirmed'));
  });
});
