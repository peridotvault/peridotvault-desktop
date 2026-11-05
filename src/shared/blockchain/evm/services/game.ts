import { createPublicClient, createWalletClient, custom, isAddress } from 'viem';
import { baseSepolia } from 'viem/chains';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { mnemonicToSeedSync } from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { Buffer } from 'buffer';
import {
  STORAGE_URL,
  EVM_RPC_URL,
  EVM_REGISTRY_ADDRESS,
} from '@shared/constants/storage';
import { PeridotRegistryAbi } from '../abis/abi.registry';
import { PGC1Abi } from '../abis/abi.pgc1';
import { PGCGame } from '@shared/interfaces/game';
import { fetchGameAsPGC } from '@shared/api/game.api';

const bip32 = BIP32Factory(ecc);

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

const REGISTRY_ADDRESS = EVM_REGISTRY_ADDRESS as `0x${string}`;
const RPC_URL = EVM_RPC_URL;
const PGC1_LICENSE_ID = BigInt(1);



// Custom transport using Tauri's HTTP API to bypass CORS
const tauriHttpTransport = () => {
  return custom({
    async request({ method, params }) {
      const response = await tauriFetch(RPC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Math.floor(Math.random() * 1000000),
          method,
          params,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'RPC error');
      }

      return data.result;
    },
  });
};

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: tauriHttpTransport(),
});

const ZERO = BigInt(0);

/**
 * Parse registry game response into structured format
 */
function parseRegistryGame(value: unknown): { pgc1: string; publisher: string; createdAt: bigint; active: boolean } | null {
  if (!Array.isArray(value)) return null;

  const [pgc1, publisher, createdAt, active] = value;

  if (
    typeof pgc1 !== 'string' ||
    typeof publisher !== 'string' ||
    !isAddress(pgc1) ||
    !isAddress(publisher)
  ) {
    return null;
  }

  return {
    pgc1: pgc1,
    publisher: publisher,
    createdAt: typeof createdAt === 'bigint' ? createdAt : BigInt(createdAt ?? 0),
    active: Boolean(active),
  };
}

export async function getMyGamesEvm({ address }: { address: string }): Promise<PGCGame[]> {
  if (!isAddress(address)) {
    console.warn('[EVM] Invalid address provided:', address);
    return [];
  }

  try {
    console.log('[EVM] Starting game fetch for address:', address);

    const gameCount = (await publicClient.readContract({
      address: REGISTRY_ADDRESS,
      abi: PeridotRegistryAbi,
      functionName: 'gameCount',
    })) as bigint;

    console.log(`[EVM] Total games in registry: ${gameCount}`);

    if (gameCount === ZERO) return [];

    // STEP 1: Get all game IDs using multicall (much faster than sequential)
    console.log('[EVM] Fetching game IDs via multicall...');
    const gameIdResults = await publicClient.multicall({
      contracts: Array.from({ length: Number(gameCount) }).map((_, i) => ({
        address: REGISTRY_ADDRESS,
        abi: PeridotRegistryAbi,
        functionName: 'gameIdAt',
        args: [BigInt(i)],
      })),
      allowFailure: true,
    });

    const gameIds: string[] = [];
    for (const result of gameIdResults) {
      if (
        result.status === 'success' &&
        typeof result.result === 'string' &&
        result.result.length > 0
      ) {
        gameIds.push(result.result);
      }
    }

    console.log(`[EVM] Retrieved ${gameIds.length} game IDs`);

    if (gameIds.length === 0) return [];

    // STEP 2: Get game structs using multicall
    console.log('[EVM] Fetching game structs via multicall...');
    const gameStructResults = await publicClient.multicall({
      contracts: gameIds.map((id) => ({
        address: REGISTRY_ADDRESS,
        abi: PeridotRegistryAbi,
        functionName: 'games',
        args: [id],
      })),
      allowFailure: true,
    });

    const parsedGames: Array<{ gameId: string; pgc1: string }> = [];

    for (let i = 0; i < gameStructResults.length; i++) {
      const result = gameStructResults[i];

      if (result.status !== 'success') continue;

      const parsed = parseRegistryGame(result.result);
      if (!parsed) continue;

      parsedGames.push({
        gameId: gameIds[i],
        pgc1: parsed.pgc1,
      });
    }

    console.log(`[EVM] Parsed ${parsedGames.length} valid game structs`);

    if (parsedGames.length === 0) return [];

    // STEP 3: Check balances using multicall
    console.log('[EVM] Checking ownership via multicall...');
    const balanceResults = await publicClient.multicall({
      contracts: parsedGames.map((g) => ({
        address: g.pgc1 as `0x${string}`,
        abi: PGC1Abi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`, PGC1_LICENSE_ID],
      })),
      allowFailure: true,
    });

    const ownedGames: typeof parsedGames = [];

    for (let i = 0; i < balanceResults.length; i++) {
      const result = balanceResults[i];

      if (result.status !== 'success') continue;

      const balance = result.result as bigint;

      if (balance > ZERO) {
        ownedGames.push(parsedGames[i]);
      }
    }

    console.log(`[EVM] Found ${ownedGames.length} owned games`);

    if (ownedGames.length === 0) return [];

    // STEP 4: Get metadata versions using multicall
    console.log('[EVM] Fetching metadata versions...');
    const metaVersionResults = await publicClient.multicall({
      contracts: ownedGames.map((g) => ({
        address: g.pgc1 as `0x${string}`,
        abi: PGC1Abi,
        functionName: 'contractMetaHeadVersion',
      })),
      allowFailure: true,
    });

    type MetadataCommit = {
      hash: `0x${string}`;
      parentHash: `0x${string}`;
      timestamp: bigint;
      uri: string;
    };

    const metadataContracts: {
      address: `0x${string}`;
      abi: typeof PGC1Abi;
      functionName: 'contractMetadataAt';
      args: [bigint];
    }[] = [];

    const metadataIndexMap: number[] = [];

    for (let i = 0; i < metaVersionResults.length; i++) {
      const result = metaVersionResults[i];
      if (result.status !== 'success') continue;

      const versionRaw = result.result as number | bigint;
      const version = typeof versionRaw === 'bigint' ? versionRaw : BigInt(versionRaw);

      if (version === ZERO) continue;

      metadataContracts.push({
        address: ownedGames[i].pgc1 as `0x${string}`,
        abi: PGC1Abi,
        functionName: 'contractMetadataAt',
        args: [version - BigInt(1)], // version starts at 1
      });

      metadataIndexMap.push(i);
    }

    const metadataResults =
      metadataContracts.length > 0
        ? await publicClient.multicall({
            contracts: metadataContracts,
            allowFailure: true,
          })
        : [];

    // STEP 5: Build metadata URI map and fetch game data
    const metadataUriMap = new Map<number, string | null>();

    for (let i = 0; i < metadataResults.length; i++) {
      const result = metadataResults[i];
      const gameIndex = metadataIndexMap[i];
      if (gameIndex === undefined) continue;

      if (result.status !== 'success') {
        metadataUriMap.set(gameIndex, null);
        continue;
      }

      const meta = result.result as MetadataCommit;
      metadataUriMap.set(gameIndex, meta.uri);
    }

    // STEP 6: Fetch full game data
    console.log('[EVM] Enriching game metadata...');
    const finalGames: PGCGame[] = [];

    for (let i = 0; i < ownedGames.length; i++) {
      const owned = ownedGames[i];
      const metadataUri = metadataUriMap.get(i);

      try {
        // Try to fetch metadata from URI if available
        if (metadataUri) {
          const apiBase = import.meta.env.VITE_API_BASE ?? 'https://api.peridotvault.com';
          const uri = metadataUri.startsWith('http') ? metadataUri : `${apiBase}${metadataUri}`;

          const response = await tauriFetch(uri);
          if (response.ok) {
            const metadata = await response.json();

            if (metadata && metadata.name && metadata.name !== 'Unknown Game') {
              finalGames.push(composePGCGameFromEvm(owned.gameId, metadata));
              continue;
            }
          }
        }

        console.warn(`[EVM] Contract metadata incomplete for ${owned.gameId}, trying API fallback...`);
      } catch (err) {
        console.warn(`[EVM] Contract metadata failed for ${owned.gameId}, trying API fallback...`, err);
      }

      // Fallback: Fetch from API
      try {
        const apiGame = await fetchGameAsPGC(owned.gameId);
        if (apiGame) {
          console.log(`[EVM] Successfully fetched ${owned.gameId} from API`);
          finalGames.push(apiGame);
          continue;
        }
      } catch (apiErr) {
        console.warn(`[EVM] API fallback also failed for ${owned.gameId}`, apiErr);
      }

      // If both contract and API fail, still show the game with minimal info
      console.log(`[EVM] Adding game ${owned.gameId} with minimal metadata`);
      finalGames.push({
        gameId: owned.gameId,
        name: owned.gameId,
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
          _blockchain: 'base-sepolia',
          _source: 'contract-only',
          gameId: owned.gameId,
        },
        distribution: [],
        previews: [],
      });
    }

    console.log(`[EVM] Successfully loaded ${finalGames.length} games`);
    return finalGames;
  } catch (error) {
    console.error('[EVM] Error fetching games:', error);
    return [];
  }
}

/**
 * Fetch game by ID - tries local DB first, then fetches from API
 */

export async function getGameByGameId({ gameId }: { gameId: string }): Promise<PGCGame> {
  // Try to get from local library first
  const { libraryService } = await import('@features/library/services/localDb');
  const local = await libraryService.getById(gameId as any);
  if (local) {
    return {
      gameId: local.gameId,
      name: local.gameName,
      description: local.description,
      published: true,
      price: 0,
      tokenPayment: '',
      totalPurchased: 0,
      maxSupply: 0,
      coverVerticalImage: local.coverVerticalImage,
      bannerImage: local.bannerImage,
      metadata: null,
      distribution: [],
      previews: [],
    };
  }

  // Fetch from API
  try {
    const apiGame = await fetchGameAsPGC(gameId);
    if (apiGame) {
      // Save to local DB for future use
      await saveGameToLibrary(apiGame);
      return apiGame;
    }
  } catch (err) {
    console.error(`[getGameByGameId] Failed to fetch game ${gameId} from API:`, err);
  }

  throw new Error('Game not found');
}

/**
 * Save a game to the local library database
 */
async function saveGameToLibrary(game: PGCGame): Promise<void> {
  try {
    const { libraryService } = await import('@features/library/services/localDb');
    const existing = await libraryService.getById(game.gameId);

    const webDist = game.distribution?.find((d) => 'web' in d);
    const webUrl = webDist && 'web' in webDist ? webDist.web.url : undefined;

    const libraryEntry = {
      gameId: game.gameId,
      gameName: game.name,
      description: game.description ?? '',
      coverVerticalImage: game.coverVerticalImage ?? '',
      bannerImage: game.bannerImage ?? '',
      launchType: 'web' as const,
      webUrl,
      status: 'installed' as const,
      stats: {
        totalPlayTimeSeconds: 0,
        launchCount: 0,
      },
    };

    if (!existing) {
      await libraryService.create(libraryEntry);
      console.log(`[saveGameToLibrary] Created library entry for: ${game.gameId}`);
    }
  } catch (err) {
    console.warn(`[saveGameToLibrary] Failed to save game ${game.gameId}:`, err);
  }
}

export async function getDeveloperGames() {
  return [];
}

export async function register_game() {
  throw new Error('Not implemented for EVM yet');
}

export async function createGamePaid() {
  throw new Error('Not implemented for EVM yet');
}

export async function createGameVoucher() {
  throw new Error('Not implemented for EVM yet');
}

export async function getPublishedGames(_params: {
  start: number;
  limit: number;
}): Promise<PGCGame[]> {
  return [];
}

function composePGCGameFromEvm(gameId: string, metadata: any): PGCGame {
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
      _blockchain: 'base-sepolia',
    },
    distribution: metadata.distributions ?? metadata.distribution ?? [],
    previews: metadata.previews ?? [],
  };

  if (game.name === 'Unknown Game') {
    console.warn(`[EVM] Game ${gameId} has no name in metadata`);
  }

  return game;
}

/**
 * Derive EVM private key from seed phrase.
 */
function deriveEvmPrivateKey(seedPhrase: string): `0x${string}` {
  const seed = mnemonicToSeedSync(seedPhrase);
  const root = bip32.fromSeed(seed);
  const child = root.derivePath("m/44'/60'/0'/0/0");

  if (!child.privateKey) {
    throw new Error('Failed to derive private key');
  }

  return `0x${Buffer.from(child.privateKey).toString('hex')}` as `0x${string}`;
}

export interface BuyGameEvmResult {
  success: boolean;
  transactionHash?: string;
  alreadyOwned?: boolean;
  error?: string;
}

/**
 * Check if user owns a specific game on EVM.
 */
export async function checkGameOwnershipEvm({
  gameId,
  address,
}: {
  gameId: string;
  address: string;
}): Promise<boolean> {
  try {
    if (!isAddress(address)) return false;

    // Get the PGC1 contract address from registry
    const gameRecord = (await publicClient.readContract({
      address: REGISTRY_ADDRESS,
      abi: PeridotRegistryAbi,
      functionName: 'games',
      args: [gameId],
    })) as [string, string, bigint, boolean];

    const [pgc1Address] = gameRecord;

    if (!pgc1Address || pgc1Address === '0x0000000000000000000000000000000000000000') {
      return false;
    }

    // Check balance
    const balance = (await publicClient.readContract({
      address: pgc1Address as `0x${string}`,
      abi: PGC1Abi,
      functionName: 'balanceOf',
      args: [address as `0x${string}`, PGC1_LICENSE_ID],
    })) as bigint;

    return balance > BigInt(0);
  } catch (error) {
    console.error('[EVM] Failed to check ownership:', error);
    return false;
  }
}

import { privateKeyToAccount } from 'viem/accounts';

/**
 * Buy a game on EVM (Base Sepolia).
 * Returns the transaction hash if successful.
 */
export async function buyGameEvm({
  gameId,
  seedPhrase,
}: {
  gameId: string;
  seedPhrase: string;
}): Promise<BuyGameEvmResult> {
  try {
    // Derive wallet from seed phrase to get address
    const privateKey = deriveEvmPrivateKey(seedPhrase);
    const account = privateKeyToAccount(privateKey);
    const buyerAddress = account.address;

    // 1. Get the PGC1 contract address from registry
    const gameRecord = (await publicClient.readContract({
      address: REGISTRY_ADDRESS,
      abi: PeridotRegistryAbi,
      functionName: 'games',
      args: [gameId],
    })) as [string, string, bigint, boolean];

    const [pgc1Address] = gameRecord;

    if (!pgc1Address || pgc1Address === '0x0000000000000000000000000000000000000000') {
      return { success: false, error: 'Game not found on registry' };
    }

    // 2. Check if already owned
    const balance = (await publicClient.readContract({
      address: pgc1Address as `0x${string}`,
      abi: PGC1Abi,
      functionName: 'balanceOf',
      args: [buyerAddress, PGC1_LICENSE_ID],
    })) as bigint;

    if (balance > BigInt(0)) {
      console.log('[EVM] Game already owned:', gameId);
      return { success: true, alreadyOwned: true, transactionHash: '' };
    }

    // 3. Get the price from the PGC1 contract
    const price = (await publicClient.readContract({
      address: pgc1Address as `0x${string}`,
      abi: PGC1Abi,
      functionName: 'price',
    })) as bigint;

    // 4. Create wallet client
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: tauriHttpTransport(),
    });

    // 5. Send buy transaction
    console.log('[EVM] Sending buy transaction...', { gameId, pgc1Address, price: price.toString() });
    const hash = await walletClient.writeContract({
      address: pgc1Address as `0x${string}`,
      abi: PGC1Abi,
      functionName: 'buy',
      value: price,
    });

    console.log('[EVM] Buy transaction sent:', hash);

    // 6. Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log('[EVM] Buy transaction confirmed:', hash);
      return { success: true, transactionHash: hash };
    } else {
      return { success: false, error: 'Transaction failed on-chain' };
    }
  } catch (error) {
    console.error('[EVM] Buy game failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}
