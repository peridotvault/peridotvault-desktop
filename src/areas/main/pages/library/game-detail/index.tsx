// @ts-ignore
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faClock, faGlobe, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import type { Distribution, PGCGame } from '@shared/interfaces/game';
import type { GameId } from '@shared/interfaces/game';
import type { LibraryEntry } from '@shared/interfaces/library';
import { libraryService } from '@features/library/services/localDb';
import { getGameByGameId } from '@shared/blockchain/evm/services/game';
import { ButtonWithSound } from '@shared/components/ui/ButtonWithSound';
import { ImageLoading } from '@shared/constants/images';
import {
  buildLaunchState,
  launchGame,
  resolveDistributions,
  resolveWebBuildUrl,
} from '@features/game/services/launchGame';
import { detectOSKey } from '@shared/utils/os';
import { useInstalled } from '@features/download/hooks/useInstalled';
import { resolveNativeDownload } from '@features/download/lib/resolveNativeDownload';
import { GameActionButton } from '@features/download/components/GameActionButton';
import { TrackEditionSelector } from '@shared/drm/TrackEditionSelector';
import type { Track } from '@shared/drm/tracks';
import type { PlatformType } from '@features/download/interfaces/download';
import { STORAGE_URL } from '@shared/constants/storage';

export default function LibraryGameDetail() {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const [theGame, setTheGame] = useState<PGCGame | null>(null);
  const [libraryEntry, setLibraryEntry] = useState<LibraryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // DRM edition (ANT-942 FR7): OFF = tanpa wallet/gas, ON = gas + chain.
  const [track, setTrack] = useState<Track>('offchain');

  // normalize appId untuk penyimpanan lokal
  const appIdKey = useMemo(() => {
    try {
      return gameId ? gameId : undefined;
    } catch {
      return gameId;
    }
  }, [gameId]);

  // ====== DATA FETCHING ======

  const fetchGame = async () => {
    if (!gameId) {
      setTheGame(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await getGameByGameId({ gameId });
      setTheGame(res);
    } catch (e) {
      setError('Failed to load game details');
      setTheGame(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 1) Fetch on-chain/off-chain game (price, metadata, dsb)
  useEffect(() => {
    window.scrollTo(0, 0);
    fetchGame();
  }, [gameId]);

  // 2) Fetch local library entry (image + stats + webUrl)
  useEffect(() => {
    if (!gameId) {
      setLibraryEntry(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const entry = await libraryService.getById(gameId as GameId);
        if (!cancelled) {
          setLibraryEntry(entry ?? null);
        }
      } catch (err) {
        console.warn('[LibraryDetail] Failed to load library entry', err);
        if (!cancelled) setLibraryEntry(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gameId]);

  // ====== DISTRIBUTIONS & INSTALL STATE ======

  const resolvedDistributions: Distribution[] = useMemo(
    () => resolveDistributions(theGame),
    [theGame],
  );

  const osKey = useMemo(() => detectOSKey(), []);
  const { installed, latest } = useInstalled(appIdKey, osKey);

  const webUrl = useMemo(() => {
    const fromLibrary = libraryEntry?.webUrl;
    const fromGame =
      resolveWebBuildUrl({
        game: theGame,
        distributions: resolvedDistributions,
        chainWebUrl: undefined,
      }) ?? undefined;

    return fromLibrary || fromGame;
  }, [libraryEntry?.webUrl, theGame, resolvedDistributions]);

  const launchState = useMemo(
    () =>
      buildLaunchState({
        game: theGame,
        gameId: appIdKey,
        distributions: resolvedDistributions,
        osKey,
        webUrl: webUrl ?? null,
        installedEntry: latest,
        installed,
      }),
    [appIdKey, installed, latest, osKey, resolvedDistributions, theGame, webUrl],
  );

  const hasNativeForOS = launchState?.hasNativeForOS ?? false;
  const hasWeb = launchState?.hasWeb ?? false;
  const nativeDownloadInfo = useMemo(
    () => (hasNativeForOS ? resolveNativeDownload(resolvedDistributions, osKey) : null),
    [hasNativeForOS, osKey, resolvedDistributions],
  );
  const primaryPlatform: PlatformType = hasNativeForOS ? 'native' : 'web';

  // ====== ACTIONS ======

  const onLaunch = async () => {
    await launchGame(launchState, {
      preferGameWindow: true,
      notify: (msg) => alert(msg),
    });
  };

  // ====== HELPERS ======

  const getImageUrl = (url: string | undefined): string => {
    if (!url) return ImageLoading;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    return `${STORAGE_URL}/${url.startsWith('/') ? url.slice(1) : url}`;
  };

  const formatStorage = (mb: number | undefined): string => {
    if (!mb) return 'N/A';
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  const formatPlaytime = (seconds: number): string => {
    if (seconds === 0) return 'Not played yet';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours === 0) return `${minutes} minutes`;
    if (minutes === 0) return `${hours} hours`;
    return `${hours} hours ${minutes} minutes`;
  };

  // ====== LOADING STATE ======

  if (isLoading) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-48 h-64 bg-foreground/10 rounded-xl" />
          <div className="h-8 bg-foreground/10 rounded w-64" />
          <div className="h-4 bg-foreground/10 rounded w-48" />
        </div>
      </main>
    );
  }

  // ====== ERROR STATE ======

  if (error || !theGame) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <FontAwesomeIcon icon={faExclamationTriangle} className="text-6xl text-red-400 mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Game Not Found</h1>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          We couldn't find the game you're looking for. It may have been removed or you may not have access to it.
        </p>
        <div className="flex gap-4">
          <ButtonWithSound
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-foreground/10 hover:bg-foreground/20 rounded-lg flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Go Back
          </ButtonWithSound>
          <ButtonWithSound
            onClick={fetchGame}
            className="px-6 py-2 bg-accent hover:bg-accent/80 text-accent-foreground rounded-lg"
          >
            Try Again
          </ButtonWithSound>
        </div>
      </main>
    );
  }

  // ====== RENDER ======

  const bannerImage = getImageUrl(
    theGame.bannerImage || theGame.coverHorizontalImage || theGame.coverVerticalImage
  );
  const coverImage = getImageUrl(
    libraryEntry?.coverVerticalImage || theGame.coverVerticalImage || theGame.coverHorizontalImage
  );
  const gameName = theGame.name ?? libraryEntry?.gameName ?? 'Untitled Game';
  const description = theGame.description ?? libraryEntry?.description ?? 'No description available.';
  
  // Find native distribution for system requirements
  const nativeDist = resolvedDistributions.find((d): d is { native: any } => 'native' in d)?.native;
  const webDist = resolvedDistributions.find((d): d is { web: any } => 'web' in d)?.web;

  return (
    <main className="flex flex-col min-h-screen pb-20">
      {/* Back Button */}
      <div className="px-6 py-4">
        <ButtonWithSound
          onClick={() => navigate(-1)}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          Back to Library
        </ButtonWithSound>
      </div>

      {/* ===== HERO SECTION ===== */}
      <div className="relative w-full h-64 md:h-80 overflow-hidden">
        <img
          src={bannerImage}
          className="absolute inset-0 w-full h-full object-cover"
          alt={gameName}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="container mx-auto max-w-6xl px-6 -mt-20 relative z-10">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* ===== LEFT COLUMN ===== */}
          <div className="flex-1">
            {/* Game Header Card */}
            <div className="bg-card rounded-2xl p-6 mb-6 shadow-flat-sm">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Cover Image */}
                <div className="shrink-0 mx-auto md:mx-0 -mt-16 md:-mt-24">
                  <img
                    src={coverImage}
                    alt={`Cover of ${gameName}`}
                    className="w-40 md:w-48 aspect-[2/3] object-cover rounded-xl shadow-lg"
                  />
                </div>

                {/* Game Info */}
                <div className="flex flex-col gap-3 flex-1">
                  <h1 className="text-3xl md:text-4xl font-bold">{gameName}</h1>
                  
                  {/* Quick Stats */}
                  {libraryEntry && (
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faClock} />
                        {formatPlaytime(libraryEntry.stats.totalPlayTimeSeconds)}
                      </span>
                      <span>•</span>
                      <span>{libraryEntry.stats.launchCount || 0} launches</span>
                      {libraryEntry.stats.lastLaunchedAt && (
                        <>
                          <span>•</span>
                          <span>Last played {new Date(libraryEntry.stats.lastLaunchedAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  <p className="text-foreground/70 leading-relaxed mt-2">{description}</p>

                  {/* Tags */}
                  {(theGame.metadata as any)?.tags && ((theGame.metadata as any).tags).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {((theGame.metadata as any).tags as string[]).slice(0, 6).map((tag, index) => (
                        <span
                          key={index}
                          className="bg-foreground/5 px-3 py-1 rounded-full text-xs text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* About Section */}
            <section className="bg-card rounded-2xl p-6 mb-6 shadow-flat-sm">
              <h2 className="text-xl font-semibold mb-4">About This Game</h2>
              <p className="text-foreground/70 leading-relaxed whitespace-pre-line">{description}</p>
              
              {/* Categories */}
              {(theGame.metadata as any)?.categories && ((theGame.metadata as any).categories).length > 0 && (
                <div className="mt-6 pt-6 border-t border-foreground/10">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {((theGame.metadata as any).categories as string[]).map((cat, index) => (
                      <span
                        key={index}
                        className="bg-accent/10 text-accent px-3 py-1 rounded-full text-sm"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* System Requirements */}
            {(nativeDist || webDist) && (
              <section className="bg-card rounded-2xl p-6 shadow-flat-sm">
                <h2 className="text-xl font-semibold mb-4">System Requirements</h2>
                {nativeDist ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-foreground/5 rounded-lg">
                      <span className="text-sm text-muted-foreground block mb-1">Operating System</span>
                      <span className="font-medium capitalize">{nativeDist.os || 'Not specified'}</span>
                    </div>
                    <div className="p-4 bg-foreground/5 rounded-lg">
                      <span className="text-sm text-muted-foreground block mb-1">Processor</span>
                      <span className="font-medium">{nativeDist.processor || 'Not specified'}</span>
                    </div>
                    <div className="p-4 bg-foreground/5 rounded-lg">
                      <span className="text-sm text-muted-foreground block mb-1">Memory</span>
                      <span className="font-medium">{formatStorage(nativeDist.memory)}</span>
                    </div>
                    <div className="p-4 bg-foreground/5 rounded-lg">
                      <span className="text-sm text-muted-foreground block mb-1">Graphics</span>
                      <span className="font-medium">{nativeDist.graphics || 'Not specified'}</span>
                    </div>
                    {nativeDist.storage && (
                      <div className="p-4 bg-foreground/5 rounded-lg">
                        <span className="text-sm text-muted-foreground block mb-1">Storage</span>
                        <span className="font-medium">{formatStorage(nativeDist.storage)}</span>
                      </div>
                    )}
                  </div>
                ) : webDist ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-foreground/5 rounded-lg">
                      <span className="text-sm text-muted-foreground block mb-1">Platform</span>
                      <span className="font-medium">Web Browser</span>
                    </div>
                    <div className="p-4 bg-foreground/5 rounded-lg">
                      <span className="text-sm text-muted-foreground block mb-1">Processor</span>
                      <span className="font-medium">{webDist.processor || 'Any modern CPU'}</span>
                    </div>
                    <div className="p-4 bg-foreground/5 rounded-lg">
                      <span className="text-sm text-muted-foreground block mb-1">Memory</span>
                      <span className="font-medium">{formatStorage(webDist.memory)}</span>
                    </div>
                    <div className="p-4 bg-foreground/5 rounded-lg">
                      <span className="text-sm text-muted-foreground block mb-1">Graphics</span>
                      <span className="font-medium">{webDist.graphics || 'WebGL compatible'}</span>
                    </div>
                  </div>
                ) : null}
              </section>
            )}
          </div>

          {/* ===== RIGHT COLUMN ===== */}
          <div className="w-full lg:w-80 flex flex-col gap-4">
            {/* Play Action Card */}
            <div className="bg-card rounded-2xl p-5 shadow-flat-sm sticky top-4">
              {/* DRM edition + upfront cost (ANT-942 FR7) */}
              <TrackEditionSelector
                editions={[
                  { track: 'offchain', label: 'OFF' },
                  { track: 'onchain', label: 'ON', chain: 'eip155:84532' },
                ]}
                value={track}
                onChange={setTrack}
              />
              <GameActionButton
                gameId={appIdKey ?? gameId ?? 'unknown'}
                title={gameName}
                platform={primaryPlatform}
                downloadInfo={nativeDownloadInfo}
                webUrl={webUrl}
                onPlay={onLaunch}
                className="w-full justify-center text-lg py-4"
                track={track}
              />

              {webUrl && (
                <ButtonWithSound
                  onClick={() => window.open(webUrl, '_blank')}
                  className="w-full mt-3 py-3 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground/70 hover:text-foreground transition-colors flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faGlobe} />
                  Play in Browser
                </ButtonWithSound>
              )}

              {/* Game Details List */}
              <div className="mt-6 pt-6 border-t border-foreground/10 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Developer</span>
                  <span>{(theGame.metadata as any)?.developer || 'Antigane Studio'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Publisher</span>
                  <span>{(theGame.metadata as any)?.publisher || 'Antigane Inc'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Release Date</span>
                  <span>
                    {(theGame.metadata as any)?.releaseDate
                      ? new Date((theGame.metadata as any).releaseDate).toLocaleDateString(undefined, { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })
                      : 'TBA'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform</span>
                  <span className="capitalize">
                    {hasNativeForOS ? osKey : hasWeb ? 'Web Browser' : 'N/A'}
                  </span>
                </div>
                {theGame.website && (
                  <div className="pt-3 border-t border-foreground/10">
                    <a
                      href={theGame.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-accent hover:underline flex items-center gap-2"
                    >
                      <FontAwesomeIcon icon={faGlobe} />
                      Visit Website
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
