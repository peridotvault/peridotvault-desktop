// @ts-ignore
import React, { useEffect, useMemo, useState } from 'react';
import { faClock, faRocket, faStore } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { getGameByGameId } from '@shared/blockchain/icp/services/game';
import { useParams } from 'react-router-dom';
import type { Distribution, PGCGame } from '@shared/blockchain/icp/types/game';
import { PriceCoin } from '@shared/components/ui/CoinPrice';
import { isZeroTokenAmount, resolveTokenInfo } from '@shared/utils/token-info';
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

import type { GameId } from '@shared/interfaces/game';
import type { LibraryEntry } from '@shared/interfaces/library';
import { libraryService } from '@features/library/services/localDb';

export default function LibraryGameDetail() {
  const { gameId } = useParams();

  const [theGame, setTheGame] = useState<PGCGame | null>(null);
  const [libraryEntry, setLibraryEntry] = useState<LibraryEntry | null>(null);

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

  // 1) Fetch on-chain/off-chain game (price, metadata, dsb)
  useEffect(() => {
    if (!gameId) {
      setTheGame(null);
      return;
    }

    window.scrollTo(0, 0);

    let cancelled = false;
    (async () => {
      try {
        setTheGame(null);
        const res = await getGameByGameId({ gameId });
        if (!cancelled) setTheGame(res);
      } catch (e) {
        if (!cancelled) setTheGame(null);
      }
    })();

    return () => {
      cancelled = true;
    };
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

  // ====== TOKEN / PRICE ======

  const tokenCanister = theGame?.tokenPayment;
  const rawPrice = theGame?.price ?? 0;
  const tokenInfo = resolveTokenInfo(tokenCanister);
  const priceIsFree = isZeroTokenAmount(rawPrice, tokenInfo.decimals);

  // ====== DISTRIBUTIONS & INSTALL STATE ======

  const resolvedDistributions: Distribution[] = useMemo(
    () => resolveDistributions(theGame),
    [theGame],
  );

  const osKey = useMemo(() => detectOSKey(), []);
  const { installed, latest } = useInstalled(appIdKey, osKey);

  // webUrl:
  // 1) prefer dari local library (hasil sync getMyGames + distribution)
  // 2) fallback ke resolveWebBuildUrl (metadata/distribution on-chain)
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

  // ====== HERO IMAGE ======

  const heroImage =
    // prefer dari local library (sudah di-compress / dataURL)
    libraryEntry?.bannerImage ||
    libraryEntry?.coverVerticalImage ||
    // fallback on-chain
    theGame?.bannerImage ||
    theGame?.coverHorizontalImage ||
    theGame?.coverVerticalImage ||
    theGame?.metadata?.bannerImage ||
    theGame?.metadata?.coverHorizontalImage ||
    theGame?.metadata?.coverVerticalImage ||
    ImageLoading;

  // ====== STATS LABELS (local play stats) ======

  const playTimeLabel = useMemo(() => {
    const seconds = libraryEntry?.stats.totalPlayTimeSeconds ?? 0;
    if (!seconds) return '—';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }, [libraryEntry?.stats.totalPlayTimeSeconds]);

  const lastLaunchLabel = useMemo(() => {
    const ts = libraryEntry?.stats.lastLaunchedAt;
    if (!ts) return 'Never';

    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [libraryEntry?.stats.lastLaunchedAt]);

  // ====== ACTIONS ======

  const onLaunch = async () => {
    await launchGame(launchState, {
      preferGameWindow: true,
      notify: (msg) => alert(msg),
    });
  };

  const getWebStatus = () => {
    if (installed) {
      return `Installed${latest?.version ? ` v${latest.version}` : ''}`;
    }
    if (hasWeb) {
      return 'Playable instantly via browser';
    }
    if (hasNativeForOS) {
      return 'Download required before playing';
    }
    return 'No build for this OS';
  };

  // ====== RENDER ======

  return (
    <main className="flex flex-col items-center gap-5 mb-32">
      <div className="bg-foreground w-full h-96 relative">
        <img src={heroImage} className="object-cover w-full h-120 bg-card" alt="" />
        <div className="bg-linear-to-t from-background via-background/50 w-full h-28 absolute bottom-0 translate-y-[6.2rem]" />
      </div>

      {/* column */}
      <div className="container flex gap-8 px-6 z-10 ">
        {/* left column ========================================== */}
        <div className="flex flex-col gap-8 w-2/3">
          {/* Header  */}
          <section className="flex flex-col gap-4">
            <p className="text-3xl font-medium">
              {theGame?.name ?? libraryEntry?.gameName ?? 'Untitled Game'}
            </p>
            <div className="flex gap-4">
              <p className="flex gap-2 items-center">
                <FontAwesomeIcon icon={faClock} className="text-muted-foreground" />
                <label className="text-muted-foreground">Play Time :</label> {playTimeLabel}
              </p>
              <div className="border border-muted" />
              <p className="flex gap-2 items-center">
                <FontAwesomeIcon icon={faRocket} className="text-muted-foreground" />
                <label className="text-muted-foreground">Last Launched :</label> {lastLaunchLabel}
              </p>
            </div>
          </section>
        </div>

        {/* right column ========================================== */}
        <div className="w-1/3 min-w-[300px] flex flex-col gap-8">
          <section className="bg-background shadow-flat-sm w-full p-6 rounded-2xl flex flex-col gap-6">
            {/* price */}
            <div className="flex flex-col gap-2">
              <p>current price</p>
              <div className="text-3xl font-bold">
                {priceIsFree ? (
                  'FREE'
                ) : (
                  <PriceCoin amount={rawPrice ?? 0} tokenCanister={tokenCanister} textSize="xl" />
                )}
              </div>
            </div>

            {/* DRM edition + upfront cost (ANT-942 FR7) */}
            <TrackEditionSelector
              editions={[
                { track: 'offchain', label: 'OFF' },
                { track: 'onchain', label: 'ON', chain: 'eip155:84532' },
              ]}
              value={track}
              onChange={setTrack}
            />

            {/* CTAs */}
            <div className="flex flex-col gap-4">
              <GameActionButton
                gameId={appIdKey ?? gameId ?? 'unknown'}
                title={theGame?.name ?? libraryEntry?.gameName ?? 'Untitled Game'}
                platform={primaryPlatform}
                downloadInfo={nativeDownloadInfo}
                webUrl={webUrl}
                onPlay={onLaunch}
                className="w-full justify-center"
                track={track}
              />

              <ButtonWithSound className="border border-foreground/20 px-6 py-2 rounded-lg flex gap-2 items-center w-full justify-center">
                <FontAwesomeIcon icon={faStore} />
                Item Market
              </ButtonWithSound>
            </div>

            {/* detail kecil status */}
            <div className="text-sm opacity-70">{getWebStatus()}</div>
          </section>

          <div className="my-32" />
        </div>
      </div>
    </main>
  );
}
