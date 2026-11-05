import { isDesktopRuntime } from '@shared/desktop/windowControls';
import type { Distribution, PGCGame } from '@shared/interfaces/game';
import type { InstalledEntry, InstalledRecord } from '@shared/utils/installedStorage';
import { getInstalledRecord } from '@shared/utils/installedStorage';
import { detectOSKey, normalizeOSKey } from '@shared/utils/os';
import type { OSKey } from '@shared/interfaces/CoreInterface';

export type LaunchEnvironment = 'desktop' | 'web';

type LaunchTarget =
  | 'native'
  | 'desktop-webview'
  | 'desktop-browser'
  | 'web-browser'
  | 'unsupported';

export type LaunchState = {
  appId?: string | number | bigint;
  gameId: string;
  gameName?: string;
  osKey: OSKey;
  distributions: Distribution[];
  hasNativeForOS: boolean;
  hasWeb: boolean;
  webUrl?: string | null;
  installedEntry?: InstalledEntry;
  installed?: boolean;
};

export type LaunchOptions = {
  preferGameWindow?: boolean;
  notify?: (message: string) => void;
};

export type LaunchResult = {
  ok: boolean;
  target: LaunchTarget;
  message?: string;
};

const defaultNotify = (message: string) => {
  if (!message) return;
  // eslint-disable-next-line no-alert
  alert(message);
};

const normalizeStringValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first : '';
  }
  return typeof value === 'string' ? value : '';
};

export const resolveDistributions = (game: PGCGame | null): Distribution[] => {
  if (!game) return [];
  if (Array.isArray(game.distribution) && game.distribution.length) {
    return game.distribution;
  }
  const meta = game.metadata as
    | { distribution?: Distribution[]; distributions?: Distribution[] }
    | null
    | undefined;
  if (meta) {
    if (Array.isArray(meta.distribution) && meta.distribution.length) {
      return meta.distribution;
    }
    if (Array.isArray(meta.distributions) && meta.distributions.length) {
      return meta.distributions;
    }
  }
  return [];
};

export const resolveWebBuildUrl = ({
  game,
  distributions,
  chainWebUrl,
}: {
  game: PGCGame | null;
  distributions: Distribution[];
  chainWebUrl?: string | null;
}): string | null => {
  if (distributions.length) {
    const distEntry = distributions.find((dist) => 'web' in dist && !!dist.web.url);
    if (distEntry && 'web' in distEntry) {
      const url = normalizeStringValue(distEntry.web.url);
      if (url.trim()) return url.trim();
    }
  }
  const fallback = chainWebUrl ?? game?.metadata?.website ?? '';
  return fallback.trim() ? fallback.trim() : null;
};

export const hasNativeForPlatform = (distributions: Distribution[], osKey: OSKey): boolean => {
  if (!distributions.length) return false;
  return distributions.some(
    (dist) => 'native' in dist && normalizeOSKey(dist.native.os) === osKey,
  );
};

const getEnvironment = (): LaunchEnvironment => (isDesktopRuntime() ? 'desktop' : 'web');

const pickInstalledEntry = (
  record: InstalledRecord | null,
  osKey: OSKey,
): InstalledEntry | undefined => {
  if (!record) return undefined;
  const perOS = record.entries.filter((e) => e.os === osKey);
  if (perOS.length) {
    return perOS.sort((a, b) => b.installedAt - a.installedAt)[0];
  }
  return record.entries.sort((a, b) => b.installedAt - a.installedAt)[0];
};

const loadDesktopOpener = async () => {
  try {
    const mod = await import('@tauri-apps/plugin-opener');
    return mod;
  } catch (error) {
    console.warn('[launch] Unable to load opener plugin', error);
    return null;
  }
};

const openNativePath = async (path: string): Promise<boolean> => {
  if (!isDesktopRuntime()) return false;
  const opener = await loadDesktopOpener();
  if (!opener?.openPath) return false;
  try {
    await opener.openPath(path);
    return true;
  } catch (error) {
    console.error('[launch] Failed to open native path', error);
    return false;
  }
};

const openUrlDesktop = async (url: string): Promise<boolean> => {
  if (!isDesktopRuntime()) return false;
  const opener = await loadDesktopOpener();
  if (!opener?.openUrl) return false;
  try {
    await opener.openUrl(url);
    return true;
  } catch (error) {
    console.error('[launch] Failed to open URL via opener plugin', error);
    return false;
  }
};

type GameWindowOptions = { label?: string; title?: string };
const openDesktopGameWindow = async (url: string, options?: GameWindowOptions) => {
  if (!isDesktopRuntime()) return false;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_game_window', {
      url,
      label: options?.label,
      title: options?.title,
    });
    return true;
  } catch (error) {
    console.error('[launch] Failed to open dedicated game window', error);
    return false;
  }
};

export const buildLaunchState = ({
  game,
  gameId,
  distributions,
  osKey,
  webUrl,
  installedEntry,
  installed,
}: {
  game?: PGCGame | null;
  gameId?: string | number | bigint | null;
  distributions: Distribution[];
  osKey?: OSKey;
  webUrl?: string | null;
  installedEntry?: InstalledEntry;
  installed?: boolean;
}): LaunchState | null => {
  const id = game?.gameId ?? gameId;
  if (id == null) return null;

  const targetOS = osKey ?? detectOSKey();
  const hasNative = hasNativeForPlatform(distributions, targetOS);
  const hasWeb = Boolean(webUrl);

  return {
    appId: id,
    gameId: String(id),
    gameName: game?.name,
    osKey: targetOS,
    distributions,
    hasNativeForOS: hasNative,
    hasWeb,
    webUrl,
    installedEntry,
    installed,
  };
};

export async function launchGame(
  state: LaunchState | null,
  options?: LaunchOptions,
): Promise<LaunchResult> {
  const notify = options?.notify ?? defaultNotify;
  if (!state) {
    notify('Data game belum siap.');
    return { ok: false, target: 'unsupported', message: 'missing-state' };
  }

  const { hasNativeForOS, hasWeb, webUrl, osKey, appId, gameName } = state;
  const environment = getEnvironment();

  let entry = state.installedEntry;
  if (!entry && appId != null) {
    const record = await getInstalledRecord(appId);
    entry = pickInstalledEntry(record, osKey);
  }

  const notifyMissingBuild = () => {
    notify('Build untuk platform ini tidak tersedia.');
  };

  const notifyMissingInstall = () => {
    notify('App belum terpasang atau lokasi instalasi tidak ditemukan.');
  };

  // Prefer native when it exists for the OS and an installed entry is available.
  if (hasNativeForOS) {
    if (entry) {
      if (environment === 'desktop') {
        const candidate = entry.launchPath || entry.filePath || entry.installDir;
        if (!candidate) {
          notifyMissingInstall();
          return { ok: false, target: 'native', message: 'missing-path' };
        }
        const opened = await openNativePath(candidate);
        if (!opened) {
          notify('Gagal menjalankan aplikasi. Coba buka folder install secara manual.');
          return { ok: false, target: 'native', message: 'open-failed' };
        }
        return { ok: true, target: 'native' };
      }
      notify('Native build hanya bisa dijalankan dari aplikasi desktop.');
      return { ok: false, target: 'native', message: 'native-on-web' };
    }
    if (!hasWeb) {
      notifyMissingInstall();
      return { ok: false, target: 'native', message: 'missing-install' };
    }
  }

  if (hasWeb && webUrl) {
    if (environment === 'desktop') {
      if (options?.preferGameWindow) {
        const openedGameWindow = await openDesktopGameWindow(webUrl, {
          label: `game-${state.gameId}`,
          title: gameName ?? 'PeridotVault Game',
        });
        if (openedGameWindow) {
          return { ok: true, target: 'desktop-webview' };
        }
      }

      const openedViaPlugin = await openUrlDesktop(webUrl);
      if (openedViaPlugin) {
        return { ok: true, target: 'desktop-browser' };
      }
    }

    window.open(webUrl, '_blank', 'noopener,noreferrer');
    return { ok: true, target: 'web-browser' };
  }

  notifyMissingBuild();
  return { ok: false, target: 'unsupported', message: 'no-build-available' };
}
