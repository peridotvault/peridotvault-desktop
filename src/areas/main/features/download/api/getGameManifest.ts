import { GameManifest } from "../interfaces/gameManifest";

const apiBase = (): string =>
    (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') ?? '';

/**
 * Manifest-only fetch (ANT-942 FR2/FR3).
 *
 * Returns version/size/integrity metadata for the gate. The response's
 * `download_url` — if a legacy server still sends one — is deliberately
 * NOT mapped: downloads must go through the entitlement-gated
 * `POST /v1/games/{id}/download-url` (see `@shared/drm/gate.ts`).
 */
export async function getGameManifest(
    gameId: string,
    platform: string
): Promise<GameManifest> {
    const base = apiBase() || 'https://api.peridotvault.com';
    const res = await fetch(
        `${base}/api/v1/games/${encodeURIComponent(gameId)}/latest?platform=${encodeURIComponent(platform)}`
    );

    if (!res.ok) {
        throw new Error(`Failed to fetch manifest: ${res.status}`);
    }

    const json = await res.json();
    const data = (json?.data ?? json) as Record<string, unknown>;

    const str = (v: unknown, fallback = ''): string =>
        typeof v === 'string' ? v : fallback;
    const num = (v: unknown, fallback = 0): number =>
        typeof v === 'number' ? v : fallback;

    const hashRaw = data.manifestHashSha256 ?? data.manifest_hash ?? data.checksum;

    return {
        gameId,
        title: str(data.name ?? data.title, gameId),
        version: str(data.version ?? data.latestVersion),
        platform,
        sizeBytes: num(data.size_bytes ?? data.sizeBytes),
        manifestHashSha256: typeof hashRaw === 'string' && hashRaw ? hashRaw : undefined,
        entryExe: str(data.entry_exe ?? data.entryExe),
    };
}
