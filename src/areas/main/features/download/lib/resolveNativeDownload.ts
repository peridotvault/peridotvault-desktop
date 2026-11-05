import type { Distribution, Manifest, StorageRef } from '@shared/interfaces/game';
import type { OSKey } from '@shared/interfaces/CoreInterface';
import { normalizeOSKey } from '@shared/utils/os';
import type { NativeDownloadInfo } from '../interfaces/download';

const toTimestamp = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return 0;
};

const cleanPath = (value?: string | null) => (value ? value.replace(/^\/*/, '') : '');

const buildUrlFromStorageRef = (storageRef: StorageRef, listing: string): string | null => {
  if ('url' in storageRef && storageRef.url.url) {
    return storageRef.url.url;
  }

  if ('s3' in storageRef && storageRef.s3.bucket) {
    const base = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '');
    if (!base) return null;
    const basePath = cleanPath(storageRef.s3.basePath);
    const fileName = cleanPath(listing || storageRef.s3.objectKey || '');
    const joined = [basePath, fileName].filter(Boolean).join('/');
    return `${base}/files/${joined}`;
  }

  if ('ipfs' in storageRef && storageRef.ipfs.cid) {
    const gateway =
      (import.meta.env.VITE_IPFS_GATEWAY as string | undefined)?.replace(/\/+$/, '') ??
      'https://ipfs.io/ipfs';
    const path = storageRef.ipfs.path ? `/${cleanPath(storageRef.ipfs.path)}` : '';
    return `${gateway}/${storageRef.ipfs.cid}${path}`;
  }

  return null;
};

const pickLatestManifest = (manifests: Manifest[]): Manifest | null => {
  if (!manifests.length) return null;
  return [...manifests].sort((a, b) => {
    const tb = toTimestamp((b as any).createdAt ?? (b as any).created_at);
    const ta = toTimestamp((a as any).createdAt ?? (a as any).created_at);
    if (tb !== ta) return tb - ta;
    return (b.version || '').localeCompare(a.version || '', undefined, { numeric: true });
  })[0];
};

export const resolveNativeDownload = (
  distributions: Distribution[],
  osKey: OSKey,
): NativeDownloadInfo | null => {
  const nativeEntry = distributions.find(
    (dist) => 'native' in dist && normalizeOSKey(dist.native.os) === osKey,
  );
  if (!nativeEntry || !('native' in nativeEntry)) return null;

  const manifest = pickLatestManifest(nativeEntry.native.manifests || []);
  if (!manifest) return null;

  const storageRef = manifest.storage ?? manifest.storageRef;
  if (!storageRef) return null;

  const url = buildUrlFromStorageRef(storageRef, manifest.listing);
  if (!url) return null;

  const normalizedOS = normalizeOSKey(nativeEntry.native.os);
  const fileName = cleanPath(manifest.listing || '') || `build-${manifest.version || 'latest'}`;
  const sizeBytes = manifest.sizeBytes ?? (manifest as any).size_bytes;

  return {
    os: normalizedOS,
    url,
    fileName,
    version: manifest.version,
    sizeBytes: typeof sizeBytes === 'bigint' ? Number(sizeBytes) : sizeBytes,
  };
};
