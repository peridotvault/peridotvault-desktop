import { STORAGE_URL } from '@shared/constants/storage';
import { http } from '@shared/lib/http';
import type { PGCGame, Distribution, Platform } from '@shared/interfaces/game';

export interface LibraryGame {
  id: number;
  gameId: string;
  userId: number;
  purchasedAt: string;
  createdAt: string;
  updatedAt: string;
  game: LibraryGameDetails;
}

export interface LibraryGameDetails {
  id: number;
  gameId: string;
  name: string;
  description: string;
  bannerImage: string | null;
  coverVerticalImage: string | null;
  coverHorizontalImage: string | null;
  coverImage: string | null;
  requiredAge: number;
  websiteUrl: string | null;
  price: string;
  isPublished: boolean;
  releaseDate: string | null;
  categories: string[];
  tags: string[];
  previews: Array<{
    kind: 'image' | 'video';
    src: string;
  }>;
  distributions: Array<
    | {
        web: {
          url: string;
          memory?: number;
          graphics?: string;
          storage?: number;
          processor?: string;
          additionalNotes?: string;
        };
      }
    | {
        native: {
          os: string;
          memory?: number;
          graphics?: string;
          storage?: number;
          processor?: string;
          additionalNotes?: string;
          manifests?: any[];
        };
      }
  >;
}

export interface GetLibraryQuery {
  q?: string;
  sort?: 'purchased_at_desc' | 'purchased_at_asc' | 'name_asc' | 'name_desc';
  page?: number;
  limit?: number;
}

export interface PaginatedLibraryResponse {
  data: LibraryGame[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Resolves an image URL to an absolute URL.
 */
function resolveImageUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return `${STORAGE_URL}/${url.startsWith('/') ? url.slice(1) : url}`;
}

const VALID_PLATFORMS: Platform[] = ['web', 'windows', 'macos', 'linux', 'android', 'ios', 'other'];

/**
 * Convert API distributions to proper Distribution type.
 */
function convertDistributions(
  apiDistributions: LibraryGameDetails['distributions'],
): Distribution[] {
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
        const os = dist.native.os.toLowerCase() as Platform;
        if (!VALID_PLATFORMS.includes(os)) {
          console.warn(
            `[LibraryAPI] Skipping native distribution with invalid OS: ${dist.native.os}`,
          );
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
 * Get user game library.
 * Supports search by game name, sort, and pagination.
 */
export async function getMyLibrary(query: GetLibraryQuery = {}): Promise<PaginatedLibraryResponse> {
  const params = new URLSearchParams();

  if (query.q) params.append('q', query.q);
  if (query.sort) params.append('sort', query.sort);
  if (query.page) params.append('page', query.page.toString());
  if (query.limit) params.append('limit', query.limit.toString());

  const endpoint = `/api/library?${params.toString()}`;
  console.log('[LibraryAPI] Fetching library:', { query });

  return http.get<PaginatedLibraryResponse>(endpoint);
}

/**
 * Get a specific game from user library.
 */
export async function getLibraryGame(gameId: string): Promise<LibraryGame | null> {
  const endpoint = `/api/library/${encodeURIComponent(gameId)}`;
  console.log('[LibraryAPI] Fetching library game:', { gameId });

  try {
    return await http.get<LibraryGame>(endpoint);
  } catch (error) {
    if ((error as any).statusCode === 404) {
      return null;
    }
    console.error('[LibraryAPI] Failed to fetch library game:', error);
    return null;
  }
}

/**
 * Convert LibraryGame to PGCGame format for compatibility.
 */
export function convertLibraryGameToPGCGame(libraryGame: LibraryGame): PGCGame {
  const game = libraryGame.game;
  const distributions = convertDistributions(game.distributions ?? []);

  return {
    gameId: game.gameId,
    name: game.name ?? 'Unknown Game',
    description: game.description ?? '',
    published: game.isPublished ?? true,
    price: Number(game.price) ?? 0,
    tokenPayment: '',
    totalPurchased: 0,
    maxSupply: 0,
    requiredAge: game.requiredAge,
    coverVerticalImage: resolveImageUrl(game.coverVerticalImage || game.coverImage),
    coverHorizontalImage: resolveImageUrl(game.coverHorizontalImage),
    bannerImage: resolveImageUrl(game.bannerImage),
    website: game.websiteUrl ?? undefined,
    metadata: {
      gameId: game.gameId,
      game_id: game.gameId,
      name: game.name,
      description: game.description,
      requiredAge: game.requiredAge,
      required_age: game.requiredAge,
      price: Number(game.price),
      website: game.websiteUrl ?? undefined,
      bannerImage: resolveImageUrl(game.bannerImage),
      banner_image: resolveImageUrl(game.bannerImage),
      coverVerticalImage: resolveImageUrl(game.coverVerticalImage || game.coverImage),
      cover_vertical_image: resolveImageUrl(game.coverVerticalImage || game.coverImage),
      coverHorizontalImage: resolveImageUrl(game.coverHorizontalImage),
      cover_horizontal_image: resolveImageUrl(game.coverHorizontalImage),
      coverImage: resolveImageUrl(game.coverImage),
      cover_image: resolveImageUrl(game.coverImage),
      is_published: game.isPublished,
      releaseDate: game.releaseDate ? new Date(game.releaseDate).getTime() : undefined,
      release_date: game.releaseDate ? new Date(game.releaseDate).getTime() : undefined,
      categories: game.categories,
      tags: game.tags,
      previews: game.previews,
      distribution: distributions,
      distributions: distributions,
      _source: 'library-api',
      _libraryId: libraryGame.id,
      _purchasedAt: libraryGame.purchasedAt,
    },
    distribution: distributions,
    previews:
      game.previews?.map((p) => ({
        kind: p.kind,
        src: p.src,
        url: p.src,
      })) ?? [],
  };
}

/**
 * Check if user has a game in their library.
 */
export async function isGameInLibrary(gameId: string): Promise<boolean> {
  const game = await getLibraryGame(gameId);
  return game !== null;
}

/**
 * Add a game to user library (sync from blockchain to offchain API).
 */
export async function addGameToLibrary(gameId: string): Promise<LibraryGame> {
  const endpoint = `/api/library/${encodeURIComponent(gameId)}`;
  console.log('[LibraryAPI] Adding game to library:', { gameId });

  return http.post<LibraryGame>(endpoint, {});
}
