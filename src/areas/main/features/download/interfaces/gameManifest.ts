export type GameManifest = {
    gameId: string;
    title: string;
    version: string;
    platform: string;
    sizeBytes: number;
    /** Integrity hash from the signed download-url response (FR2). */
    manifestHashSha256?: string;
    entryExe: string;
    // NOTE (ANT-942): the manifest NEVER carries a raw `download_url`.
    // Downloads go only through POST /v1/games/{id}/download-url
    // (TTL-bound, entitlement-gated). Do not re-add a URL field here.
};