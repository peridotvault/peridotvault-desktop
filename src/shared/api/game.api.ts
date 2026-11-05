import { STORAGE_URL } from '@shared/constants/storage';
import { http } from '@shared/lib/http';
import type { PGCGame, GameId, Distribution, Platform } from '@shared/interfaces/game';

const VALID_PLATFORMS: Platform[] = ['web', 'windows', 'macos', 'linux', 'android', 'ios', 'other'];

/**
 * Resolves an image URL to an absolute URL.
 * If the URL is already absolute (http/https/data), returns as-is.
 * If relative, prepends the storage URL (includes /storage/files path).
 */
function resolveImageUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    // Already absolute URL
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return url;
    }
    // Relative URL - prepend storage URL which includes the /storage/files path
    return `${STORAGE_URL}/${url.startsWith('/') ? url.slice(1) : url}`;
}

export interface GameDetailApi {
    game_id: string;
    name: string;
    description: string;
    required_age: number;
    price: number;
    website_url?: string;
    banner_image?: string;
    cover_vertical_image?: string;
    cover_horizontal_image?: string;
    cover_image?: string;
    is_published: boolean;
    release_date: number;
    draft_status: string;
    status: string;
    categories: string[];
    tags: string[];
    previews: Array<{ kind: 'image' | 'video'; src: string }>;
    distributions: Array<
        | { web: { url: string; memory?: number; graphics?: string; storage?: number; processor?: string; additionalNotes?: string } }
        | { native: { os: string; memory?: number; graphics?: string; storage?: number; processor?: string; additionalNotes?: string; manifests?: any[] } }
    >;
}

/**
 * Convert API distribution to proper Distribution type.
 * Filters out invalid native distributions with unknown OS.
 */
function convertDistributions(apiDistributions: GameDetailApi['distributions']): Distribution[] {
    return apiDistributions
        .map((dist): Distribution | null => {
            if ('web' in dist) {
                return {
                    web: {
                        url: dist.web.url,
                        memory: dist.web.memory,
                        graphics: dist.web.graphics,
                        storage: dist.web.storage,
                        processor: dist.web.processor,
                        additionalNotes: dist.web.additionalNotes,
                    },
                };
            }
            if ('native' in dist) {
                // Validate OS is a valid Platform
                const os = dist.native.os as Platform;
                if (!VALID_PLATFORMS.includes(os)) {
                    console.warn(`[GameAPI] Skipping native distribution with invalid OS: ${dist.native.os}`);
                    return null;
                }
                return {
                    native: {
                        os,
                        memory: dist.native.memory,
                        graphics: dist.native.graphics,
                        storage: dist.native.storage,
                        processor: dist.native.processor,
                        additionalNotes: dist.native.additionalNotes,
                        manifests: dist.native.manifests ?? [],
                    },
                };
            }
            return null;
        })
        .filter((d): d is Distribution => d !== null);
}

/**
 * Fetch game details from the API by game ID.
 * This is used as a fallback when contract metadata is incomplete.
 */
export async function getGameDetailApi(gameId: GameId): Promise<GameDetailApi> {
    const endpoint = `/api/games/${gameId}`;
    console.log('[GameAPI] Fetching game details:', { gameId });

    return http.get<GameDetailApi>(endpoint);
}

/**
 * Convert API game detail to PGCGame format.
 */
export function convertApiGameToPGCGame(gameId: string, apiGame: GameDetailApi): PGCGame {
    return {
        gameId,
        name: apiGame.name ?? 'Unknown Game',
        description: apiGame.description ?? '',
        published: apiGame.is_published ?? false,
        price: apiGame.price ?? 0,
        tokenPayment: '',
        totalPurchased: 0,
        maxSupply: 0,
        requiredAge: apiGame.required_age,
        coverVerticalImage: resolveImageUrl(apiGame.cover_vertical_image || apiGame.cover_image),
        coverHorizontalImage: resolveImageUrl(apiGame.cover_horizontal_image),
        bannerImage: resolveImageUrl(apiGame.banner_image),
        website: apiGame.website_url,
        metadata: {
            gameId,
            game_id: gameId,
            name: apiGame.name,
            description: apiGame.description,
            requiredAge: apiGame.required_age,
            required_age: apiGame.required_age,
            price: apiGame.price,
            website: apiGame.website_url,
            bannerImage: resolveImageUrl(apiGame.banner_image),
            banner_image: resolveImageUrl(apiGame.banner_image),
            coverVerticalImage: resolveImageUrl(apiGame.cover_vertical_image || apiGame.cover_image),
            cover_vertical_image: resolveImageUrl(apiGame.cover_vertical_image || apiGame.cover_image),
            coverHorizontalImage: resolveImageUrl(apiGame.cover_horizontal_image),
            cover_horizontal_image: resolveImageUrl(apiGame.cover_horizontal_image),
            coverImage: resolveImageUrl(apiGame.cover_image),
            cover_image: resolveImageUrl(apiGame.cover_image),
            is_published: apiGame.is_published,
            releaseDate: apiGame.release_date,
            release_date: apiGame.release_date,
            draftStatus: apiGame.draft_status,
            draft_status: apiGame.draft_status,
            status: apiGame.status,
            categories: apiGame.categories,
            tags: apiGame.tags,
            previews: apiGame.previews,
            distribution: convertDistributions(apiGame.distributions ?? []),
            distributions: convertDistributions(apiGame.distributions ?? []),
            _source: 'api',
        },
        distribution: convertDistributions(apiGame.distributions ?? []),
        previews: apiGame.previews?.map((p) => ({
            kind: p.kind,
            src: p.src,
            url: p.src,
        })) ?? [],
    };
}

/**
 * Fetch game details and return as PGCGame format.
 * This is a convenience function that combines getGameDetailApi and convertApiGameToPGCGame.
 */
export async function fetchGameAsPGC(gameId: GameId): Promise<PGCGame | null> {
    try {
        const apiGame = await getGameDetailApi(gameId);
        if (!apiGame || !apiGame.name) {
            console.warn('[GameAPI] API returned game without name:', gameId);
            return null;
        }
        return convertApiGameToPGCGame(gameId, apiGame);
    } catch (err) {
        // Check if it's a 404 (game not found) - this is expected for some games
        if ((err as any).statusCode === 404) {
            console.log(`[GameAPI] Game ${gameId} not found in API (this is normal for unregistered games)`);
        } else {
            console.error('[GameAPI] Failed to fetch game:', gameId, err);
        }
        return null;
    }
}
