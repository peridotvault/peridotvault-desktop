/**
 * React binding for the entitlement gate (ANT-942).
 *
 * Gives download/launch buttons a uniform gate: loading state, deny
 * message display, and the offline-grace notice. All states render —
 * never ship a state you have not seen.
 */

import { useCallback, useState } from 'react';
import {
  isDownloadUrlFresh,
  requestDownloadUrl,
  resolveLaunch,
  type LaunchVerdict,
} from './gate';
import type { Track } from './tracks';

export type GateStatus =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'allowed'; mode: 'online' | 'offline-grace' }
  | { phase: 'denied'; message: string };

export function useEntitlementGate(input: {
  gameId: string;
  gameVersion?: string;
  track: Track;
  walletAddress?: string;
  userId?: string;
  allowOffline?: boolean;
}) {
  const [status, setStatus] = useState<GateStatus>({ phase: 'idle' });

  const guardLaunch = useCallback(async (): Promise<LaunchVerdict> => {
    if (!input.gameVersion) {
      const denied: LaunchVerdict = {
        allowed: false,
        reason: 'offline_not_covered',
        message: 'Versi game belum diketahui.',
      };
      setStatus({ phase: 'denied', message: denied.message });
      return denied;
    }
    setStatus({ phase: 'checking' });
    const verdict = await resolveLaunch({
      gameId: input.gameId,
      gameVersion: input.gameVersion,
      track: input.track,
      walletAddress: input.walletAddress,
      userId: input.userId,
      allowOffline: input.allowOffline,
    });
    setStatus(
      verdict.allowed
        ? { phase: 'allowed', mode: verdict.mode }
        : { phase: 'denied', message: verdict.message },
    );
    return verdict;
  }, [input.gameId, input.gameVersion, input.track, input.walletAddress, input.userId, input.allowOffline]);

  const fetchFreshUrl = useCallback(
    async (opts?: { platform?: 'windows' | 'macos' | 'linux'; ttlSeconds?: number }) => {
      setStatus({ phase: 'checking' });
      try {
        const issued = await requestDownloadUrl({
          gameId: input.gameId,
          gameVersion: input.gameVersion,
          track: input.track,
          walletAddress: input.walletAddress,
          platform: opts?.platform,
          ttlSeconds: opts?.ttlSeconds,
        });
        if (!isDownloadUrlFresh(issued.expiresAt)) {
          throw new Error('Link download kedaluwarsa. Minta link baru.');
        }
        setStatus({ phase: 'allowed', mode: 'online' });
        return issued;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal meminta link download.';
        setStatus({ phase: 'denied', message });
        throw err;
      }
    },
    [input.gameId, input.gameVersion, input.track, input.walletAddress],
  );

  const reset = useCallback(() => setStatus({ phase: 'idle' }), []);

  return { status, guardLaunch, fetchFreshUrl, reset };
}
