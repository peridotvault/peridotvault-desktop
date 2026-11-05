import { useEffect, useState, useRef, useCallback } from 'react';
import { useWallet } from '@shared/contexts/WalletContext';
import { walletService } from '@shared/services/wallet';
import { deriveEvmAddressFromSeed } from '@shared/utils/evm';
import { deriveSvmAddressFromSeed } from '@shared/utils/solana';
import { getMyGamesEvm } from '@shared/blockchain/evm/services/game';
import { getMyGamesSvm } from '@shared/blockchain/solana/services/game';

import { getMyLibrary, convertLibraryGameToPGCGame } from '@shared/api/library.api';
import type { LibraryEntry, CreateLibraryEntryInput } from '@shared/interfaces/library';
import type { PGCGame } from '@shared/interfaces/game';
import { initializeAuthWithLockOnFailure } from '@shared/services/auth-init.service';
import { useWalletLockStore } from '@shared/states/wallet-lock.store';
import { hasRuntimeWalletData } from '@shared/services/wallet';
import { useLibraryStore } from './useLibraryStore';

export type RealLibraryGame = {
  gameId: string;
  name: string;
  description: string;
  coverVerticalImage: string;
  bannerImage: string;
  status: 'owned' | 'installed' | 'installing';
  localEntry?: LibraryEntry;
  remoteData?: PGCGame;
};

// Convert store entries to display format
function convertEntriesToGames(entries: LibraryEntry[]): RealLibraryGame[] {
  const games = entries.map((entry) => ({
    gameId: entry.gameId,
    name: entry.gameName,
    description: entry.description,
    coverVerticalImage: entry.coverVerticalImage,
    bannerImage: entry.bannerImage,
    status: entry.status as 'owned' | 'installed' | 'installing',
    localEntry: entry,
  }));
  return games.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

// Convert a PGCGame to CreateLibraryEntryInput
function gameToEntryInput(game: PGCGame): CreateLibraryEntryInput {
  console.log(`[gameToEntryInput] Converting game:`, { gameId: game.gameId, name: game.name, hasName: !!game.name });

  const webDist = game.distribution?.find((d): d is { web: { url: string } } => 'web' in d);
  const webUrl = webDist?.web?.url;

  // Ensure we have a valid name - use gameId as fallback
  const gameName = game.name && game.name.trim() ? game.name : game.gameId;

  const entry = {
    gameId: game.gameId,
    gameName: gameName,
    description: game.description ?? '',
    coverVerticalImage: game.coverVerticalImage || game.coverHorizontalImage || '',
    bannerImage: game.bannerImage || '',
    launchType: 'web' as const,
    webUrl,
    status: 'not-installed' as const,
    stats: {
      totalPlayTimeSeconds: 0,
      launchCount: 0,
    },
  };

  console.log(`[gameToEntryInput] Created entry:`, entry);
  return entry;
}

// Global state to prevent parallel background syncs
let globalSyncInProgress = false;

export function useMyGames() {
  const { wallet } = useWallet();
  const lockStatus = useWalletLockStore((state) => state.status);

  // Use shared store for library data
  const storeEntries = useLibraryStore((state) => state.entries);
  const storeLoading = useLibraryStore((state) => state.isLoading);
  const storeSyncing = useLibraryStore((state) => state.isSyncing);
  const storeLoadAll = useLibraryStore((state) => state.loadAll);
  const storeAddEntry = useLibraryStore((state) => state.addEntry);
  const storeSetSyncing = useLibraryStore((state) => state.setSyncing);

  // Local state for sync progress and error
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const isMounted = useRef(true);
  const lastLockStatus = useRef(lockStatus);
  const loadedGameIds = useRef(new Set<string>());

  // Convert store entries to display format
  const games = convertEntriesToGames(storeEntries);

  // Load from local DB on mount
  useEffect(() => {
    console.log('[useMyGames] Initial load from store');
    storeLoadAll();
  }, [storeLoadAll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Re-fetch when wallet is unlocked
  useEffect(() => {
    if (lastLockStatus.current === 'locked' && lockStatus === 'unlocked') {
      console.log('[useMyGames] Wallet unlocked - refreshing library');
      setRefreshTrigger((prev) => prev + 1);
    }
    lastLockStatus.current = lockStatus;
  }, [lockStatus]);

  // Background sync effect
  useEffect(() => {
    console.log('[useMyGames] Background sync effect started');

    // Prevent duplicate background syncs across component instances
    if (globalSyncInProgress) {
      console.log('[useMyGames] Background sync already in progress, skipping');
      return;
    }

    let cancelled = false;
    loadedGameIds.current.clear();

    const syncGames = async () => {
      globalSyncInProgress = true;
      storeSetSyncing(true);

      try {
        // Check wallet availability
        const isWalletLoaded = wallet?.encryptedSeedPhrase || wallet?.runtimeWallet;

        if (!isWalletLoaded) {
          console.log('[useMyGames] No wallet, skipping background sync');
          return;
        }

        // Check for native wallet migration
        const hasNativeWallet = hasRuntimeWalletData(wallet) && !wallet.encryptedSeedPhrase;
        const currentLockStatus = useWalletLockStore.getState().status;

        if (hasNativeWallet && currentLockStatus !== 'locked') {
          console.log('[useMyGames] Native wallet detected - triggering password prompt');
          useWalletLockStore.getState().forceLock();
          return;
        }

        if (hasNativeWallet && currentLockStatus === 'locked') {
          console.log('[useMyGames] Waiting for wallet unlock...');
          return;
        }

        // Get seed phrase for authentication
        let seedPhrase: string | null = null;

        if (wallet.encryptedSeedPhrase) {
          const isLockOpen = await walletService.isLockOpen();
          if (isLockOpen) {
            try {
              seedPhrase = await walletService.decryptWalletData(wallet.encryptedSeedPhrase);
            } catch (err) {
              console.warn('[useMyGames] Failed to decrypt seed phrase:', err);
            }
          }
        }

        if (!seedPhrase) {
          console.log('[useMyGames] No seed phrase available');
          return;
        }

        // Validate seed phrase
        const wordCount = seedPhrase.trim().split(/\s+/).length;
        if (![12, 15, 18, 21, 24].includes(wordCount)) {
          console.warn(`[useMyGames] Invalid seed phrase word count: ${wordCount}`);
          return;
        }

        // Try API first
        console.log('[useMyGames] Fetching from API...');
        let authSuccess = false;
        try {
          authSuccess = await initializeAuthWithLockOnFailure(seedPhrase);
        } catch (authErr) {
          console.warn('[useMyGames] Auth initialization failed:', authErr);
        }

        if (authSuccess) {
          try {
            const libraryResponse = await getMyLibrary({ limit: 100 });
            const apiGames = libraryResponse.data.map(convertLibraryGameToPGCGame);

            if (apiGames.length > 0) {
              console.log(`[useMyGames] API returned ${apiGames.length} games`);

              // Add games incrementally
              let count = 0;
              for (const game of apiGames) {
                if (cancelled || !isMounted.current) break;
                await storeAddEntry(gameToEntryInput(game));
                count++;
                setSyncProgress({ current: count, total: apiGames.length });
              }

              console.log('[useMyGames] === LOAD COMPLETE (API) ===');
              return;
            }
          } catch (apiErr) {
            console.warn('[useMyGames] API fetch failed:', apiErr);
          }
        }

        // If API empty or auth failed, try blockchain
        console.log('[useMyGames] Fetching from blockchain...');

        const evmAddress = deriveEvmAddressFromSeed(seedPhrase);
        const svmAddress = deriveSvmAddressFromSeed(seedPhrase);

        console.log(`[useMyGames] Querying blockchains - EVM: ${evmAddress}, SVM: ${svmAddress}`);

        const [evmResult, svmResult] = await Promise.allSettled([
          getMyGamesEvm({ address: evmAddress }),
          getMyGamesSvm({ address: svmAddress }),
        ]);

        const evmGames = evmResult.status === 'fulfilled' ? evmResult.value : [];
        const svmGames = svmResult.status === 'fulfilled' ? svmResult.value : [];

        console.log(
          `[useMyGames] Blockchain results - EVM: ${evmGames.length} games, SVM: ${svmGames.length} games`,
        );

        // DEBUG: Test adding a sample entry
        if (evmGames.length > 0) {
          console.log('[useMyGames] DEBUG - Testing first EVM game:', evmGames[0]);
        }

        // Process EVM games
        let processedCount = 0;
        const totalGames = evmGames.length + svmGames.length;

        console.log(`[useMyGames] Processing ${evmGames.length} EVM games...`);
        console.log(`[useMyGames] DEBUG - cancelled: ${cancelled}, isMounted: ${isMounted.current}`);

        for (const game of evmGames) {
          console.log(`[useMyGames] Adding EVM game: ${game.gameId} (${game.name})`);
          const entryInput = gameToEntryInput(game);
          console.log(`[useMyGames] Entry input:`, entryInput);
          await storeAddEntry(entryInput);
          processedCount++;
          setSyncProgress({ current: processedCount, total: totalGames });
        }

        // Process SVM games
        const evmGameIds = new Set(evmGames.map((g) => g.gameId));

        console.log(`[useMyGames] Processing ${svmGames.length} SVM games...`);

        for (const game of svmGames) {
          if (evmGameIds.has(game.gameId)) {
            console.log(`[useMyGames] Skipping duplicate SVM game: ${game.gameId}`);
            processedCount++;
            continue;
          }
          console.log(`[useMyGames] Adding SVM game: ${game.gameId} (${game.name})`);
          const entryInput = gameToEntryInput(game);
          console.log(`[useMyGames] Entry input:`, entryInput);
          await storeAddEntry(entryInput);
          processedCount++;
          setSyncProgress({ current: processedCount, total: totalGames });
        }

        console.log('[useMyGames] === LOAD COMPLETE (BLOCKCHAIN) ===');
      } catch (err) {
        console.error('[useMyGames] Error during sync:', err);
        setError('Failed to load library');
      } finally {
        globalSyncInProgress = false;
        storeSetSyncing(false);
        setSyncProgress(null);
      }
    };

    syncGames();

    return () => {
      cancelled = true;
      globalSyncInProgress = false;
    };
  }, [wallet, refreshTrigger, storeAddEntry, storeSetSyncing]);

  const reload = useCallback(() => {
    console.log('[useMyGames] Manual reload triggered');
    globalSyncInProgress = false;
    loadedGameIds.current.clear();
    setRefreshTrigger((prev) => prev + 1);
    storeLoadAll();
  }, [storeLoadAll]);

  return {
    games,
    loading: storeLoading,
    syncing: storeSyncing,
    syncProgress,
    error,
    isEmpty: !storeLoading && !storeSyncing && games.length === 0,
    reload,
  };
}
