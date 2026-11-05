import { Connection, PublicKey } from '@solana/web3.js';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import {
  STORAGE_URL,
  SVM_RPC_URLS,
  SVM_PGC1_PROGRAM_ID,
} from '@shared/constants/storage';
import { decodeLicenseAccount, decodePgcGameAccount } from '../contracts/account.state';
import { fetchGameAsPGC } from '@shared/api/game.api';
import type { PGCGame } from '@shared/interfaces/game';
import { withRetry, CircuitBreaker, isRetryableError } from '@shared/utils/retry';

/**
 * Resolves an image URL to an absolute URL.
 * If the URL is already absolute (http/https/data), returns as-is.
 * If relative, prepends the storage URL (includes /storage/files path).
 */
function resolveImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return `${STORAGE_URL}/${url.startsWith('/') ? url.slice(1) : url}`;
}

const PGC1_PROGRAM_ID = new PublicKey(SVM_PGC1_PROGRAM_ID);

// Circuit breaker for SVM operations
const svmCircuitBreaker = new CircuitBreaker(5, 30000, 'SVM-GameService');

// Track current RPC index for round-robin fallback
let currentRpcIndex = 0;

/**
 * Get a connection with the current RPC URL
 */
function getConnection(): Connection {
  const rpcUrl = SVM_RPC_URLS[currentRpcIndex];
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Rotate to the next RPC URL
 */
function rotateToNextRpc(): void {
  currentRpcIndex = (currentRpcIndex + 1) % SVM_RPC_URLS.length;
  console.log(`[SVM-GameService] Rotated to RPC: ${SVM_RPC_URLS[currentRpcIndex].split('?')[0]}...`);
}

/**
 * Execute an SVM operation with retry logic and RPC fallback
 */
async function executeWithFallback<T>(
  operation: (connection: Connection) => Promise<T>,
  operationName: string
): Promise<T> {
  // Check circuit breaker first
  if (svmCircuitBreaker.isOpen()) {
    console.warn('[SVM-GameService] Circuit breaker is open, skipping operation');
    throw new Error('Solana RPC is currently unavailable. Please try again later.');
  }

  const errors: Error[] = [];
  const startIndex = currentRpcIndex;

  // Try each RPC URL
  for (let i = 0; i < SVM_RPC_URLS.length; i++) {
    const connection = getConnection();

    try {
      const result = await withRetry(
        () => operation(connection),
        {
          maxRetries: 2,
          baseDelayMs: 500,
          shouldRetry: isRetryableError,
          onRetry: (error, attempt) => {
            console.warn(
              `[SVM-GameService] Retry ${attempt}/2 for ${operationName}:`,
              error instanceof Error ? error.message : error
            );
          },
        }
      );

      // Success - record it
      svmCircuitBreaker.recordSuccess();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(new Error(`${operationName} failed: ${errorMessage}`));

      // Record failure in circuit breaker
      svmCircuitBreaker.recordFailure();

      // Log the error
      console.warn(
        `[SVM-GameService] RPC failed (${SVM_RPC_URLS[currentRpcIndex].split('?')[0]}): ${errorMessage}`
      );

      // Rotate to next RPC for the next attempt
      rotateToNextRpc();

      // If we have tried all RPCs, break and throw
      if (currentRpcIndex === startIndex) {
        break;
      }
    }
  }

  // All RPCs failed
  const summary = errors.map((e) => e.message).join('; ');
  throw new Error(`All Solana RPC endpoints failed. ${summary}`);
}

export async function getMyGamesSvm({ address }: { address: string }): Promise<PGCGame[]> {
  try {
    const userPubkey = new PublicKey(address);

    // Get all License accounts owned by the user with retry logic
    const accounts = await executeWithFallback(async (connection) => {
      return await connection.getProgramAccounts(PGC1_PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: 8,
              bytes: userPubkey.toBase58(),
            },
          },
        ],
      });
    }, 'getProgramAccounts');

    if (accounts.length === 0) return [];

    const ownedGames: PGCGame[] = [];

    for (const { account } of accounts) {
      try {
        const license = decodeLicenseAccount(new Uint8Array(account.data));
        const gamePda = license.game;

        // Fetch PGC Game Account to get metadataUri with retry
        const gameAccountInfo = await executeWithFallback(async (connection) => {
          return await connection.getAccountInfo(gamePda);
        }, 'getAccountInfo');

        if (!gameAccountInfo) continue;

        const pgcGame = decodePgcGameAccount(new Uint8Array(gameAccountInfo.data));

        // Fetch metadata from URI
        let metadata: any = {};
        let hasValidMetadata = false;

        try {
          const apiBase = import.meta.env.VITE_API_BASE ?? 'https://api.peridotvault.com';
          const fetchUri = pgcGame.metadataUri.startsWith('http')
            ? pgcGame.metadataUri
            : `${apiBase}${pgcGame.metadataUri}`;

          // Fetch with retry logic
          const response = await withRetry(
            async () => {
              const res = await tauriFetch(fetchUri);
              if (!res.ok) {
                throw new Error(`Failed to fetch metadata: ${res.status} ${res.statusText}`);
              }
              return res;
            },
            {
              maxRetries: 2,
              baseDelayMs: 300,
              shouldRetry: isRetryableError,
            }
          );

          metadata = await response.json();

          // Check if metadata has valid name
          if (metadata && metadata.name && metadata.name !== 'Unknown Game') {
            hasValidMetadata = true;
          }
        } catch (err) {
          console.warn(`[SVM] Failed to fetch metadata from ${pgcGame.metadataUri}`, err);
        }

        // If contract metadata is valid, use it
        if (hasValidMetadata) {
          ownedGames.push(composePGCGameFromSvm(pgcGame.gameId, metadata));
          continue;
        }

        // Otherwise, fallback to API
        console.warn(`[SVM] Contract metadata incomplete for ${pgcGame.gameId}, trying API fallback...`);
        try {
          const apiGame = await fetchGameAsPGC(pgcGame.gameId);
          if (apiGame) {
            console.log(`[SVM] Successfully fetched ${pgcGame.gameId} from API`);
            ownedGames.push(apiGame);
            continue;
          }
        } catch (apiErr) {
          console.warn(`[SVM] API fallback also failed for ${pgcGame.gameId}`, apiErr);
        }

        // If both contract and API fail, still show the game with minimal info
        console.log(`[SVM] Adding game ${pgcGame.gameId} with minimal metadata`);
        ownedGames.push({
          gameId: pgcGame.gameId,
          name: pgcGame.gameId,
          description: '',
          published: true,
          price: 0,
          tokenPayment: '',
          totalPurchased: 0,
          maxSupply: 0,
          coverVerticalImage: undefined,
          coverHorizontalImage: undefined,
          bannerImage: undefined,
          metadata: {
            _blockchain: 'solana',
            _source: 'contract-only',
            gameId: pgcGame.gameId,
          },
          distribution: [],
          previews: [],
        });
      } catch (e) {
        console.error(`[Library] Failed to process SVM license:`, e);
      }
    }

    return ownedGames;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Only log full error if it is not a circuit breaker error
    if (!errorMessage.includes('Circuit is open')) {
      console.error('[Library] SVM Fetch failed:', error);
    } else {
      console.warn('[Library] SVM RPC temporarily unavailable (circuit breaker open)');
    }
    return [];
  }
}

function composePGCGameFromSvm(gameId: string, metadata: any): PGCGame {
  const game: PGCGame = {
    gameId,
    name: metadata.name ?? 'Unknown Game',
    description: metadata.description ?? '',
    published: true,
    price: metadata.price ?? 0,
    tokenPayment: metadata.paymentToken ?? metadata.payment_token ?? '',
    totalPurchased: 0,
    maxSupply: 0,
    requiredAge: metadata.required_age ?? metadata.requiredAge,
    coverVerticalImage: resolveImageUrl(metadata.cover_vertical_image ?? metadata.coverVerticalImage),
    coverHorizontalImage: resolveImageUrl(metadata.cover_horizontal_image ?? metadata.coverHorizontalImage),
    bannerImage: resolveImageUrl(metadata.banner_image ?? metadata.bannerImage),
    website: metadata.website,
    metadata: {
      ...metadata,
      _blockchain: 'solana',
    },
    distribution: metadata.distributions ?? metadata.distribution ?? [],
    previews: metadata.previews ?? [],
  };

  if (game.name === 'Unknown Game') {
    console.warn(`[SVM] Game ${gameId} has no name in metadata`);
  }

  return game;
}

export interface BuyGameSvmResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

/**
 * Buy a game on Solana.
 * Note: This requires the runtime wallet for signing transactions.
 * Currently not fully implemented - returns an error directing users to use EVM.
 */
export async function buyGameSvm({
  gameId,
  seedPhrase,
}: {
  gameId: string;
  seedPhrase: string;
}): Promise<BuyGameSvmResult> {
  try {
    console.log('[SVM] Initiating game purchase:', { gameId });

    // Import the runtime wallet derivation function
    // @ts-expect-error - Module does not have proper type declarations
    const walletRuntime = await import('@antigane/peridotwallet-runtime');

    // Derive buyer's keypair from seed phrase
    const buyerKeypair = walletRuntime.deriveSolanaKeypairFromMnemonic(seedPhrase);
    console.log('[SVM] Derived buyer keypair:', buyerKeypair.publicKey);

    // TODO: Implement full Solana purchase flow
    console.warn('[SVM] Solana game purchase requires full implementation');

    return {
      success: false,
      error:
        'Solana game purchase is not yet fully implemented. Please use EVM (Base Sepolia) for purchases.',
    };
  } catch (error) {
    console.error('[SVM] Buy game failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}
