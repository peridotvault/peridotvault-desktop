import type { PGCGame, Distribution } from "@shared/interfaces/game";

export function resolveDistributionsFromGame(game: PGCGame): Distribution[] {
    if (Array.isArray(game.distribution) && game.distribution.length) {
        return game.distribution;
    }
    const meta = game.metadata;
    if (meta) {
        if (Array.isArray(meta.distribution) && meta.distribution.length) {
            return meta.distribution;
        }
        if (Array.isArray(meta.distributions) && meta.distributions.length) {
            return meta.distributions;
        }
    }
    return [];
}

/**
 * Build URL untuk dimainkan (web build), BUKAN landing website.
 */
export function resolveWebBuildUrlFromGame(game: PGCGame): string | undefined {
    const dists = resolveDistributionsFromGame(game);
    if (!dists.length) return undefined;

    const webDist = dists.find((dist) => "web" in dist && !!dist.web.url);

    if (webDist && "web" in webDist) {
        const url = webDist.web.url;
        if (typeof url === "string" && url.trim()) {
            return url.trim();
        }
    }

    // kalau mau, boleh banget tambahin fallback ke metadata.website / game.website,
    // tapi itu sudah "darurat", karena sebenarnya beda konsep.
    return undefined;
}


