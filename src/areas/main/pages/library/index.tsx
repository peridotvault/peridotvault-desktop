import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync, faCheck, faLock } from '@fortawesome/free-solid-svg-icons';
import { LibraryGameCard } from '@main/features/library/components/GameCard';
import { useMyGames, RealLibraryGame } from '@main/features/library/hooks/useMyGames';
import { formatTitle } from '@main/features/library/utils/formatTitle';
import { useWallet } from '@shared/contexts/WalletContext';
import { useWalletLockStore } from '@shared/states/wallet-lock.store';
import { hasRuntimeWalletData } from '@shared/services/wallet';

export default function LibraryPage() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const lockStatus = useWalletLockStore((state) => state.status);
  const { games, loading, syncing, syncProgress, error, isEmpty, reload } = useMyGames();

  // DEBUG LOGS
  console.log('[LibraryPage] Render:', {
    gamesCount: games.length,
    loading,
    syncing,
    isEmpty,
    needsUnlock:
      hasRuntimeWalletData(wallet) && !wallet.encryptedSeedPhrase && lockStatus === 'locked',
  });

  const recentGames = useMemo(() => {
    return games
      .filter((g) => g.localEntry?.stats?.lastLaunchedAt)
      .sort(
        (a, b) =>
          (b.localEntry?.stats?.lastLaunchedAt ?? 0) - (a.localEntry?.stats?.lastLaunchedAt ?? 0),
      )
      .slice(0, 8);
  }, [games]);

  // Games are already sorted A to Z from the hook
  const allGames = games;

  // Check if user has native wallet that needs unlocking
  const hasNativeWallet = hasRuntimeWalletData(wallet) && !wallet.encryptedSeedPhrase;
  const isLocked = lockStatus === 'locked';
  const needsUnlock = hasNativeWallet && isLocked;

  // Show loading state while syncing initially (don't show "empty" too early)
  if ((loading || syncing) && games.length === 0 && !needsUnlock) {
    return (
      <div className="w-full h-[80vh] flex flex-col justify-center items-center gap-4 text-foreground/50">
        <FontAwesomeIcon icon={faSync} spin className="text-4xl mb-4" />
        <p className="text-xl font-medium">Loading your games...</p>
        <p className="text-sm">Fetching from your library</p>
      </div>
    );
  }

  if (isEmpty && !needsUnlock) {
    return (
      <div className="w-full h-[80vh] flex flex-col justify-center items-center gap-4 text-foreground/50">
        <p className="text-xl font-medium">Your Library is Empty</p>
        <p className="text-sm">Explore the store to add some games!</p>
      </div>
    );
  }

  // Show unlock prompt for native wallets
  if (needsUnlock && games.length === 0) {
    return (
      <div className="w-full h-[80vh] flex flex-col justify-center items-center gap-6 text-foreground/70">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <FontAwesomeIcon icon={faLock} className="text-3xl text-primary" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-2xl font-bold text-foreground">Unlock Required</p>
          <p className="text-sm max-w-md">
            Your wallet needs to be unlocked to sync your game library.
            <br />
            Please enter your password in the unlock panel above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center min-h-screen pb-20">
      <div className="container max-w-7xl px-6 py-8 flex flex-col gap-12">
        {/* Header with Sync Status */}
        <header className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold tracking-tight">My Games</h1>
              {/* Sync Status Indicator */}
              {syncing && (
                <span className="flex items-center gap-2 text-sm text-accent animate-pulse">
                  <FontAwesomeIcon icon={faSync} spin />
                  {syncProgress && syncProgress.total > 0 ? (
                    <>
                      Saving {syncProgress.current}/{syncProgress.total}...
                    </>
                  ) : (
                    <>Syncing...</>
                  )}
                </span>
              )}
              {!syncing && !loading && games.length > 0 && (
                <span className="flex items-center gap-2 text-sm text-foreground/50">
                  <FontAwesomeIcon icon={faCheck} />
                  Up to date
                </span>
              )}
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            {/* Progress bar during sync */}
            {syncing && syncProgress && syncProgress.total > 0 && (
              <div className="w-full max-w-xs">
                <div className="h-1 w-full bg-foreground/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300 ease-out"
                    style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-foreground/50 mt-1">
                  Saving games to local storage...{' '}
                  {Math.round((syncProgress.current / syncProgress.total) * 100)}%
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={reload}
              disabled={syncing || loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground bg-foreground/5 hover:bg-foreground/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FontAwesomeIcon icon={faSync} spin={syncing || loading} />
              Refresh
            </button>
            <span className="text-foreground/50 text-sm">{allGames.length} games</span>
          </div>
        </header>

        {/* Recently Played */}
        {recentGames.length > 0 && (
          <section className="flex flex-col gap-6">
            <h2 className="text-2xl font-semibold opacity-90">Recently Played</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6">
              {recentGames.map((game) => (
                <GameItem key={game.gameId} game={game} navigate={navigate} />
              ))}
            </div>
          </section>
        )}

        {/* All Games - Sorted A to Z */}
        <section className="flex flex-col gap-6">
          <h2 className="text-2xl font-semibold opacity-90">
            {recentGames.length > 0 ? 'All Games' : 'Library'}
            <span className="text-sm font-normal text-foreground/50 ml-2">(A - Z)</span>
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
            {loading
              ? // Loading Skeletons
                Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-3 animate-pulse">
                    <div className="aspect-[2/3] bg-foreground/10 rounded-xl" />
                    <div className="h-4 bg-foreground/10 rounded w-3/4" />
                  </div>
                ))
              : allGames.map((game) => (
                  <GameItem key={game.gameId} game={game} navigate={navigate} />
                ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function GameItem({ game, navigate }: { game: RealLibraryGame; navigate: any }) {
  const slug = formatTitle(game.name);
  const pathForItem = `/library/${slug}/${game.gameId}`;

  return (
    <div className="flex flex-col gap-3 group transition-transform duration-300 hover:scale-[1.02]">
      <LibraryGameCard
        entry={{
          gameId: game.gameId,
          gameName: game.name,
          coverVerticalImage: game.coverVerticalImage,
          bannerImage: game.bannerImage,
        }}
        onClick={() => navigate(pathForItem)}
      />
      <div className="flex flex-col gap-0.5">
        <p className="font-medium text-sm truncate opacity-90 group-hover:opacity-100 transition-opacity">
          {game.name}
        </p>
        <span className="text-[10px] uppercase tracking-wider opacity-40 font-bold truncate">
          {game.status === 'owned' ? 'Not Installed' : game.status}
        </span>
      </div>
    </div>
  );
}
