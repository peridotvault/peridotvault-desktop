import { deriveEvmAddressFromSeed } from '@shared/utils/evm';
import { getMyGamesEvm } from '@shared/blockchain/evm/services/game';
import { libraryService } from './localDb';
import { walletService } from '@shared/services/wallet';
import { resolveWebBuildUrlFromGame } from '../utils/formatDistribution';

import type { PGCGame, GameId } from '@shared/interfaces/game';
import type { CreateLibraryEntryInput } from '@shared/interfaces/library';

// pilih URL cover terbaik
function resolveCoverUrl(game: PGCGame): string | undefined {
  return game.coverVerticalImage || game.coverHorizontalImage || game.bannerImage || undefined;
}

// pilih URL banner terbaik
function resolveBannerUrl(game: PGCGame): string | undefined {
  return game.bannerImage || game.coverHorizontalImage || game.coverVerticalImage || undefined;
}

// mapping utama - uses original image URLs (compression removed)
async function mapPGCGameToLibraryInput(game: PGCGame): Promise<CreateLibraryEntryInput> {
  const gameId = game.gameId as GameId;

  const coverUrl = resolveCoverUrl(game);
  const bannerUrl = resolveBannerUrl(game);

  // Use original URLs without compression for now
  // Image compression can be added back later if needed
  const coverVerticalImage = coverUrl || '';
  const bannerImage = bannerUrl || '';

  const webUrl = resolveWebBuildUrlFromGame(game);
  console.log('[sync] resolved webUrl', { gameId: game.gameId, webUrl });

  return {
    gameId,
    gameName: game.name,
    description: game.description ?? '',
    coverVerticalImage,
    bannerImage,

    launchType: 'web',
    webUrl,

    // belum ada install lokal untuk web game
    install: undefined,

    status: 'installed',
    stats: {
      totalPlayTimeSeconds: 0,
      launchCount: 0,
    },
  };
}

/**
 * Sync dari getMyGames (EVM) → Dexie library.
 */
export async function syncLibraryFromRemote(wallet: unknown) {
  if (!wallet) return;

  try {
    let seedPhrase: string | null = null;

    // Check if this is a native/runtime wallet that needs migration
    const walletAny = wallet as { runtimeWallet?: unknown; encryptedSeedPhrase?: string };
    const isNativeWallet = walletAny.runtimeWallet && !walletAny.encryptedSeedPhrase;
    if (isNativeWallet) {
      console.log('[sync] Native wallet detected - skipping sync (requires migrated wallet)');
      return;
    }

    // Only try to decrypt desktop wallet (encryptedSeedPhrase)
    if (walletAny.encryptedSeedPhrase) {
      try {
        // Pastikan lock sudah terbuka
        const isLockOpen = await walletService.isLockOpen();
        if (isLockOpen) {
          seedPhrase = await walletService.decryptWalletData(
            walletAny.encryptedSeedPhrase as unknown as { iv: string; salt: string; data: string },
          );
          console.log('[sync] Decrypted native seed phrase for sync');
        } else {
          console.warn('[sync] Wallet is locked, cannot sync library from native seed phrase');
        }
      } catch (decryptErr) {
        console.error('[sync] Failed to decrypt native wallet for sync', decryptErr);
      }
    }

    if (!seedPhrase) {
      console.warn('[sync] No seed phrase available for library sync');
      return;
    }

    // Validate seed phrase
    const wordCount = seedPhrase.trim().split(/\s+/).length;
    if (![12, 15, 18, 21, 24].includes(wordCount)) {
      console.error(`[sync] Invalid seed phrase word count: ${wordCount}. Cannot sync.`);
      return;
    }

    const evmAddress = deriveEvmAddressFromSeed(seedPhrase);
    console.log('[sync] Syncing library for EVM address:', evmAddress);

    const remoteGames = await getMyGamesEvm({ address: evmAddress });
    console.log('[sync] Found remote games:', remoteGames.length);

    for (const game of remoteGames) {
      const gameId = game.gameId as GameId;
      const existing = await libraryService.getById(gameId);
      const mapped = await mapPGCGameToLibraryInput(game);

      if (!existing) {
        await libraryService.create(mapped);
        console.log('[sync] Created library entry for:', gameId);
      } else {
        await libraryService.update(gameId, {
          gameName: mapped.gameName,
          description: mapped.description,
          coverVerticalImage: mapped.coverVerticalImage,
          bannerImage: mapped.bannerImage,
          launchType: mapped.launchType,
          webUrl: mapped.webUrl,
        });
        console.log('[sync] Updated library entry for:', gameId);
      }
    }
  } catch (err) {
    console.error('[sync] Library sync error:', err);
  }
}
