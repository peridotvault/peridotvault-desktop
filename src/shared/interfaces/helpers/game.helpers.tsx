import { Distribution, Opt } from '@shared/interfaces/game';

export const optGet = <T,>(o: Opt<T>): T | undefined => (o.length ? o[0] : undefined);

export const optGetOr = <T,>(o: Opt<T>, fallback: T): T => (o.length ? o[0] : fallback);

export function ToOpt<T>(value: T | null | undefined): Opt<T> {
  return value == null ? [] : [value];
}

export const fmtBytes = (n?: number | bigint): string | undefined => {
  if (n === undefined || n === null) return undefined;
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  const KB = 1024;
  const MB = KB ** 2;
  const GB = KB ** 3;
  if (num >= GB) return `${(num / GB).toFixed(1)} GB`;
  if (num >= MB) return `${(num / MB).toFixed(0)} MB`;
  if (num >= KB) return `${(num / KB).toFixed(0)} KB`;
  return `${num} B`;
};

export const normalizeOsToPlatform = (
  osRaw: string | undefined,
): 'Website' | 'Windows' | 'macOS' | 'Linux' | 'Other' => {
  const os = (osRaw || '').toLowerCase();
  if (os.includes('web')) return 'Website';
  if (os.includes('win')) return 'Windows';
  if (os.includes('mac') || os.includes('darwin')) return 'macOS';
  if (os.includes('linux') || os.includes('ubuntu') || os.includes('debian')) return 'Linux';
  return 'Other';
};

export type NativeSpec = {
  os: string;
  processor?: string;
  graphics?: string;
  memory?: string;
  storage?: string;
  notes?: string;
};

export type WebSpec = {
  processor?: string;
  graphics?: string;
  memory?: string;
  storage?: string;
  notes?: string;
  url?: string;
};

export type NormalizedDist = {
  Website?: WebSpec[];
  Windows?: NativeSpec[];
  macOS?: NativeSpec[];
  Linux?: NativeSpec[];
  Other?: NativeSpec[];
};

const toNote = (notes: unknown): string | undefined => {
  if (Array.isArray(notes)) {
    return notes.length ? String(notes[0] ?? '').trim() || undefined : undefined;
  }
  if (typeof notes === 'string') return notes.trim() || undefined;
  return undefined;
};

export const normalizeDistribution = (
  dist: Opt<Distribution[]> | Distribution[] | null | undefined,
): NormalizedDist => {
  const out: NormalizedDist = {};
  const list: Distribution[] = (() => {
    if (!dist) return [];
    if (Array.isArray(dist)) {
      if (dist.length === 0) return [];
      const first = dist[0] as unknown;
      if (Array.isArray(first)) {
        return first as Distribution[];
      }
      if (first && typeof first === 'object') {
        return dist as Distribution[];
      }
    }
    return [];
  })();

  for (const entry of list) {
    if ('web' in entry) {
      const spec: WebSpec = {
        processor: entry.web.processor,
        graphics: entry.web.graphics,
        memory: fmtBytes(entry.web.memory),
        storage: fmtBytes(entry.web.storage),
        notes: toNote(entry.web.additionalNotes),
        url: entry.web.url,
      };
      (out.Website ??= []).push(spec);
    } else if ('native' in entry) {
      const spec: NativeSpec = {
        os: entry.native.os,
        processor: entry.native.processor,
        graphics: entry.native.graphics,
        memory: fmtBytes(entry.native.memory),
        storage: fmtBytes(entry.native.storage),
        notes: toNote(entry.native.additionalNotes),
      };
      const key = normalizeOsToPlatform(entry.native.os);
      (out[key] ??= []).push(spec);
    }
  }

  return out;
};
