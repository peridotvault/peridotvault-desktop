import { deleteKvItem, getKvItem, setKvItem } from '@core/storage/kv-key';
import { OSKey } from '@shared/api/wasabi.api';

export type InstalledEntry = {
  version: string;
  os: OSKey;
  filePath?: string;
  installDir?: string;
  launchPath?: string;
  fileUrl?: string;
  fileName: string;
  sizeBytes?: number;
  checksum?: string;
  checksumVerified?: boolean;
  installedAt: number;
};

export type InstalledRecord = {
  appId: string;
  title?: string;
  cover?: string;
  entries: InstalledEntry[];
};

const INSTALLED_PREFIX = 'pv.installed.';
export const INSTALLED_EVENT = 'pv:installed:changed';

function keyFor(appId: string | number | bigint) {
  return `${INSTALLED_PREFIX}${String(appId)}`;
}

function emitInstalledChanged(appId: string | number | bigint) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(INSTALLED_EVENT, { detail: { appId: String(appId) } }));
}

export async function getInstalledRecord(
  appId: string | number | bigint,
): Promise<InstalledRecord | null> {
  return (await getKvItem<InstalledRecord>(keyFor(appId))) ?? null;
}

export async function isInstalled(appId: string | number | bigint, os?: OSKey): Promise<boolean> {
  const rec = await getInstalledRecord(appId);
  if (!rec) return false;
  if (!os) return rec.entries.length > 0;
  return rec.entries.some((e) => e.os === os);
}

export async function getLatestInstalled(
  appId: string | number | bigint,
  os?: OSKey,
): Promise<InstalledEntry | undefined> {
  const rec = await getInstalledRecord(appId);
  if (!rec) return undefined;
  const list = os ? rec.entries.filter((e) => e.os === os) : rec.entries.slice();
  return list.sort((a, b) => b.installedAt - a.installedAt)[0];
}

export async function upsertInstalledEntry(
  appId: string | number | bigint,
  entry: InstalledEntry,
  meta?: { title?: string; cover?: string },
): Promise<void> {
  const prev =
    (await getInstalledRecord(appId)) ?? ({ appId: String(appId), entries: [] } as InstalledRecord);

  if (meta?.title) prev.title = meta.title;
  if (meta?.cover) prev.cover = meta.cover;

  const idx = prev.entries.findIndex((e) => e.os === entry.os && e.version === entry.version);
  if (idx >= 0) prev.entries[idx] = entry;
  else prev.entries.push(entry);

  await setKvItem(keyFor(appId), prev);
  emitInstalledChanged(appId);
}

export async function removeInstalled(appId: string | number | bigint, os?: OSKey) {
  if (!os) {
    await deleteKvItem(keyFor(appId));
    emitInstalledChanged(appId);
    return;
  }
  const rec = await getInstalledRecord(appId);
  if (!rec) return;
  rec.entries = rec.entries.filter((e) => e.os !== os);
  await setKvItem(keyFor(appId), rec);
  emitInstalledChanged(appId);
}
