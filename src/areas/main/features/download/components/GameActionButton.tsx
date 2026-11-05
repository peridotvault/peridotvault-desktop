import React, { useMemo, useState } from 'react';
import { ButtonWithSound } from '@shared/components/ui/ButtonWithSound';
import { useEntitlementGate } from '@shared/drm/useEntitlementGate';
import type { Track } from '@shared/drm/tracks';
import { detectOSKey } from '@shared/utils/os';
import { useDownloadQueue } from '../hooks/useDownloadQueue';
import { useInstalled } from '../hooks/useInstalled';
import type { NativeDownloadInfo, PlatformType } from '../interfaces/download';
import type { OSKey } from '@shared/interfaces/CoreInterface';

type GameActionButtonProps = {
  gameId: string;
  title: string;
  platform: PlatformType; // tetap ada, tapi tidak jadi penentu utama
  os?: OSKey;
  downloadInfo?: NativeDownloadInfo | null;
  resolveDownloadInfo?: () => Promise<NativeDownloadInfo | null>;
  webUrl?: string | null;
  onPlay?: () => Promise<void> | void;
  className?: string;
  /** DRM edition (ANT-942 FR7). Defaults to offchain. */
  track?: Track;
  /** Wallet address for track=onchain; omitted for OFF (tanpa wallet). */
  walletAddress?: string;
  /** From the game's policy; false = online-only edition. */
  allowOffline?: boolean;
};

type VisualState =
  | 'web-play'
  | 'native-play'
  | 'native-install'
  | 'downloading'
  | 'queued'
  | 'disabled';

const VISUAL_STATE_CLASSES: Record<VisualState, string> = {
  // Bisa play langsung lewat URL (web only / belum ada native yang dipakai)
  'web-play': 'bg-emerald-500 text-black hover:bg-emerald-400',

  // Native sudah terinstall, play lokal
  'native-play': 'bg-accent text-black hover:bg-accent/90',

  // Ada native build tapi belum install → harus download dulu
  'native-install': 'border border-sky-400 text-sky-100 hover:bg-sky-500/10',

  // Sedang download / install
  downloading: 'bg-amber-500 text-black cursor-default',

  // Masih di antrian download
  queued: 'bg-muted text-muted-foreground cursor-default',

  // Benar-benar disabled
  disabled: 'bg-muted text-muted-foreground cursor-not-allowed',
};

const toDownloadPlatform = (osKey: OSKey): 'windows' | 'macos' | 'linux' =>
  osKey === 'macos' ? 'macos' : osKey === 'linux' ? 'linux' : 'windows';

export const GameActionButton: React.FC<GameActionButtonProps> = ({
  gameId,
  title,
  os,
  downloadInfo,
  resolveDownloadInfo,
  webUrl,
  onPlay,
  className,
  track = 'offchain',
  walletAddress,
  allowOffline,
}) => {
  const osKey = useMemo(() => os ?? detectOSKey(), [os]);

  const { installed, latest } = useInstalled(gameId, osKey);
  const { requestInstall, getTaskForGame } = useDownloadQueue();

  const [resolving, setResolving] = useState(false);

  // Entitlement gate (ANT-942 FR2/FR3). Version: build metadata wins,
  // installed record is the fallback for already-installed games.
  const knownVersion =
    downloadInfo?.version ?? latest?.version ?? undefined;
  const { status: gateStatus, guardLaunch, fetchFreshUrl } = useEntitlementGate({
    gameId,
    gameVersion: knownVersion,
    track,
    walletAddress,
    allowOffline,
  });

  const queueTask = getTaskForGame(gameId);
  const isDownloading = queueTask?.status === 'downloading' || queueTask?.status === 'installing';
  const isQueued = queueTask?.status === 'queued';
  const progressPercent = queueTask ? Math.round((queueTask.progress || 0) * 100) : 0;

  const hasNative = !!downloadInfo;
  const hasWeb = !!webUrl;
  const gateChecking = gateStatus.phase === 'checking';
  const gateDenyMessage = gateStatus.phase === 'denied' ? gateStatus.message : null;

  const handleInstall = async () => {
    if (!hasNative) return;

    setResolving(true);
    try {
      const info = downloadInfo ?? (await resolveDownloadInfo?.());
      if (!info) {
        alert('Download info is not available for this game yet.');
        return;
      }

      // Gate first: online check refreshes the cached license; offline
      // falls back to the local JWT. Denied → show reason, no download.
      const verdict = await guardLaunch();
      if (!verdict.allowed) {
        alert(verdict.message);
        return;
      }
      if (verdict.mode === 'offline-grace') {
        alert('Mode offline: memakai lisensi tersimpan.');
      }

      // Download ONLY via the signed TTL-bound URL — never info.url.
      // info keeps providing file metadata (name/version/size).
      const issued = await fetchFreshUrl({ platform: toDownloadPlatform(info.os ?? osKey) });
      await requestInstall({
        gameId,
        title,
        download: { ...info, url: issued.url, version: info.version ?? knownVersion },
      });
    } catch (err) {
      if (err instanceof Error) alert(err.message);
    } finally {
      setResolving(false);
    }
  };

  const handlePlay = async () => {
    if (isDownloading || isQueued) return;

    // Installed native builds still pass the launch gate: online check,
    // else offline JWT within grace; past grace → "butuh online" block.
    const verdict = await guardLaunch();
    if (!verdict.allowed) {
      alert(verdict.message);
      return;
    }

    if (onPlay) {
      await onPlay();
      return;
    }

    if (webUrl) {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const label = (): string => {
    if (isDownloading) return `Downloading ${progressPercent}%`;
    if (isQueued) return 'Queued';
    if (gateChecking) return 'Memeriksa lisensi…';
    if (installed) return 'Play';

    // Belum install
    if (hasNative) return 'Install';
    if (hasWeb) return 'Play';

    return 'Unavailable';
  };

  const disabled =
    resolving ||
    gateChecking ||
    isDownloading ||
    isQueued ||
    (!installed && !hasNative && !hasWeb);

  const visualState: VisualState = (() => {
    if (disabled && !isDownloading && !isQueued) return 'disabled';
    if (isDownloading) return 'downloading';
    if (isQueued) return 'queued';

    if (installed && hasNative) return 'native-play';
    if (!installed && hasNative) return 'native-install';
    if (hasWeb) return 'web-play';

    return 'disabled';
  })();

  const handleClick = () => {
    if (disabled) return;

    // Prioritas:
    // 1) Kalau sudah install → play native ( Lewat gate )
    // 2) Kalau belum install tapi ada native → install ( Lewat gate + signed URL )
    // 3) Kalau hanya web → play via URL ( Lewat gate )
    if (installed && hasNative) {
      void handlePlay();
    } else if (!installed && hasNative) {
      void handleInstall();
    } else if (hasWeb) {
      void handlePlay();
    }
  };

  const versionText = installed && latest?.version ? ` • v${latest.version}` : '';

  return (
    <div className="flex flex-col gap-1.5">
      <ButtonWithSound
        onClick={handleClick}
        disabled={disabled}
        className={[
          'px-4 py-2 rounded-lg font-medium transition-colors duration-200',
          'flex items-center justify-center gap-1',
          VISUAL_STATE_CLASSES[visualState],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {label()}
        {versionText}
      </ButtonWithSound>
      {gateDenyMessage && (
        <p className="text-xs text-red-400" role="alert" data-testid="drm-gate-deny">
          {gateDenyMessage}
        </p>
      )}
      {gateStatus.phase === 'allowed' && gateStatus.mode === 'offline-grace' && (
        <p className="text-xs opacity-70" data-testid="drm-offline-grace">
          Mode offline — lisensi tersimpan.
        </p>
      )}
    </div>
  );
};
