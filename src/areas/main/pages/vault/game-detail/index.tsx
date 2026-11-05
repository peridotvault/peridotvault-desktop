import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faApple, faLinux, faWindows } from '@fortawesome/free-brands-svg-icons';
import { faAngleRight, faGlobe } from '@fortawesome/free-solid-svg-icons';
import { useWallet } from '@shared/contexts/WalletContext';
import { walletService } from '@shared/services/wallet';
import CarouselPreview from '@features/game/components/carousel-preview';
import { PriceCoin } from '@shared/components/ui/CoinPrice';
import {
  normalizeDistribution,
  NormalizedDist,
  NativeSpec,
  WebSpec,
} from '@shared/interfaces/helpers/game.helpers';
import { getGameByGameId, getPublishedGames } from '@features/game/services/dto';
import { Distribution, Metadata, PGCGame } from '@shared/interfaces/game';

import type { MediaItem } from '@shared/interfaces/app/GameInterface';
import { TypographyH2 } from '@shared/components/ui/typography-h2';
import { ImageLoading } from '@shared/constants/images';
import { VerticalCard } from '@shared/components/cards/VerticalCard';
import {
  createPurchase,
  completePurchase,
  type CreatePurchaseRequest,
} from '@shared/api/purchase.api';
import { buyGameEvm, checkGameOwnershipEvm } from '@shared/blockchain/evm/services/game';
import { deriveEvmAddressFromSeed } from '@shared/utils/evm';
import { libraryService } from '@features/library/services/localDb';
import { getLibraryGame, convertLibraryGameToPGCGame } from '@shared/api/library.api';

type PlatformTab = keyof Pick<NormalizedDist, 'Website' | 'Windows' | 'macOS' | 'Linux' | 'Other'>;

const PLATFORM_ORDER: PlatformTab[] = ['Website', 'Windows', 'macOS', 'Linux', 'Other'];

const PLATFORM_ICON: Record<PlatformTab, any> = {
  Website: faGlobe,
  Windows: faWindows,
  macOS: faApple,
  Linux: faLinux,
  Other: faGlobe,
};

const normalizePreviews = (items: MediaItem[] | undefined): MediaItem[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const src = (item.src ?? item.url ?? '').trim();
      if (!src) return null;
      const isVideo = /\.(mp4|webm|mov|m4v)$/i.test(src) || item.kind === 'video';
      return {
        ...item,
        src,
        url: src,
        kind: isVideo ? 'video' : 'image',
      } as MediaItem;
    })
    .filter(Boolean) as MediaItem[];
};

const extractMetadataArray = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (typeof entry === 'number') return entry.toString();
      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        const keys = ['id', 'value', 'categoryId', 'tagId', 'name'];
        for (const key of keys) {
          const value = obj[key];
          if (typeof value === 'string' && value.trim()) return value.trim();
        }
      }
      return null;
    })
    .filter((v): v is string => !!v);
};

const mergeDistributions = (
  primary: Distribution[] | undefined,
  fallback: Distribution[] | undefined,
): Distribution[] =>
  Array.isArray(primary) && primary.length ? primary : Array.isArray(fallback) ? fallback : [];

const resolveReleaseDate = (metadata: Metadata | null | undefined): number | undefined => {
  if (!metadata) return undefined;
  if (typeof metadata.releaseDate === 'number') return metadata.releaseDate;
  if (typeof metadata.release_date === 'number') return metadata.release_date;
  if (metadata.publishInfo?.releaseDate) return Number(metadata.publishInfo.releaseDate);
  if (metadata.release_date_ns) {
    return Number(metadata.release_date_ns) / 1_000_000;
  }
  return undefined;
};

export default function GameDetail(): React.ReactElement {
  const { gameId } = useParams();
  const { wallet } = useWallet();

  const [game, setGame] = useState<PGCGame | null>(null);
  const [otherGames, setOtherGames] = useState<PGCGame[]>([]);
  const [dist, setDist] = useState<NormalizedDist>({});
  const [activeTab, setActiveTab] = useState<PlatformTab | null>(null);
  const [buying, setBuying] = useState(false);
  const [purchaseState, setPurchaseState] = useState<{
    status: 'success' | 'error';
    message: string;
  } | null>(null);

  //   const announcements = useAnnouncements(gameId, wallet);

  useEffect(() => {
    if (!gameId) return;

    let mounted = true;
    (async () => {
      try {
        const detail = await getGameByGameId({ gameId });
        if (!mounted) return;
        setGame(detail ?? null);

        if (detail) {
          const combinedDistribution = mergeDistributions(
            detail.distribution,
            detail.metadata?.distribution as Distribution[] | undefined,
          );
          const normalized = normalizeDistribution(combinedDistribution);
          setDist(normalized);
          const firstTab = PLATFORM_ORDER.find((tab) => {
            const items = (normalized as Record<string, NativeSpec[] | WebSpec[] | undefined>)[tab];
            return Array.isArray(items) && items.length > 0;
          });
          setActiveTab(firstTab ?? null);
        }
      } catch (err) {
        console.error('[GameDetail] Unable to fetch game detail', err);
      }
    })();

    (async () => {
      try {
        const published = await getPublishedGames({ start: 0, limit: 200 });
        if (!mounted) return;
        setOtherGames(
          Array.isArray(published)
            ? published.filter((item) => item?.gameId !== gameId && item?.published !== false)
            : [],
        );
      } catch (err) {
        console.error('[GameDetail] Unable to resolve recommended games', err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [gameId]);

  const metadata = game?.metadata ?? null;

  const previews = useMemo(() => {
    const primary = normalizePreviews(game?.previews);
    if (primary.length) return primary;
    return normalizePreviews(metadata?.previews as MediaItem[] | undefined);
  }, [game?.previews, metadata?.previews]);

  const categories = useMemo(
    () => extractMetadataArray(metadata?.categories),
    [metadata?.categories],
  );
  const tags = useMemo(() => extractMetadataArray(metadata?.tags), [metadata?.tags]);
  const website = metadata?.website ?? metadata?.website ?? undefined;
  const releaseDate = resolveReleaseDate(metadata);

  const tokenCanister = game?.tokenPayment;
  const rawPrice = game?.price ?? 0;

  const availablePlatforms = useMemo(() => {
    const platforms = new Set<string>();
    const source = mergeDistributions(
      game?.distribution,
      metadata?.distribution as Distribution[] | undefined,
    );
    source.forEach((entry) => {
      if ('web' in entry) {
        platforms.add('Website');
      } else if ('native' in entry) {
        platforms.add(entry.native.os);
      }
    });
    return Array.from(platforms);
  }, [game?.distribution, metadata?.distribution]);

  const finalizePurchase = async (): Promise<void> => {
    if (!game) {
      throw new Error('Game data not loaded');
    }

    if (!wallet?.encryptedSeedPhrase) {
      throw new Error('Please connect your wallet first.');
    }

    // Get seed phrase from wallet
    let seedPhrase: string;
    try {
      seedPhrase = await walletService.decryptWalletData(wallet.encryptedSeedPhrase);
    } catch (err) {
      throw new Error('Failed to decrypt wallet. Please unlock your wallet.');
    }

    const gameId = game.gameId;
    const price = game.price ?? 0;
    const tokenPayment = game.tokenPayment ?? '0x0000000000000000000000000000000000000000';

    console.log('[Purchase] Starting purchase flow:', { gameId, price, tokenPayment });

    // Check if already owned on-chain
    const evmAddress = deriveEvmAddressFromSeed(seedPhrase);
    const isAlreadyOwned = await checkGameOwnershipEvm({ gameId, address: evmAddress });
    
    if (isAlreadyOwned) {
      console.log('[Purchase] Game already owned on-chain:', gameId);
      // Still save to library in case it's not there
      await savePurchasedGameToLibrary(gameId);
      throw new Error('Game already purchased! The game has been added to your library.');
    }

    let purchaseRecordCreated = false;
    let transactionHash: string | undefined;

    // Step 1: Try to create pending purchase record via API (non-blocking)
    try {
      const pendingTxHash = `pending_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const createRequest: CreatePurchaseRequest = {
        gameId,
        purchasePrice: price.toString(),
        paymentToken: tokenPayment,
        paymentTokenId: 1, // License token ID
        transactionHash: pendingTxHash,
      };

      console.log('[Purchase] Creating pending purchase record...');
      await createPurchase(createRequest);
      purchaseRecordCreated = true;
      console.log('[Purchase] Pending purchase record created');
    } catch (apiErr) {
      console.warn('[Purchase] Failed to create API purchase record (continuing):', apiErr);
      // Continue with on-chain purchase even if API fails
    }

    // Step 2: Execute on-chain purchase (EVM only for now)
    console.log('[Purchase] Executing on-chain purchase...');
    const buyResult = await buyGameEvm({ gameId, seedPhrase });

    if (!buyResult.success) {
      throw new Error(buyResult.error ?? 'On-chain purchase failed');
    }

    // Handle already owned case from buy result
    if (buyResult.alreadyOwned) {
      console.log('[Purchase] Game already owned (detected during purchase):', gameId);
      await savePurchasedGameToLibrary(gameId);
      throw new Error('Game already purchased! The game has been added to your library.');
    }

    transactionHash = buyResult.transactionHash;
    console.log('[Purchase] On-chain purchase successful:', transactionHash);

    // Step 3: Try to complete purchase via API (non-blocking)
    if (purchaseRecordCreated && transactionHash) {
      try {
        console.log('[Purchase] Completing purchase record...');
        await completePurchase(gameId, {
          gameId,
          transactionHash: transactionHash,
        });
        console.log('[Purchase] Purchase record completed in API');
      } catch (apiErr) {
        console.warn('[Purchase] Failed to complete API purchase record:', apiErr);
        // Don't throw - on-chain was successful
      }
    }

    // Step 4: ALWAYS save game to local library (this is the critical step)
    console.log('[Purchase] Saving game to local library...');
    try {
      await savePurchasedGameToLibrary(gameId);
      console.log('[Purchase] Game saved to local library successfully');
    } catch (libErr) {
      console.error('[Purchase] CRITICAL: Failed to save game to local library:', libErr);
      // Still don't throw - user owns the game on-chain
    }

    console.log('[Purchase] Purchase flow completed successfully');
  };

  const savePurchasedGameToLibrary = async (gameId: string): Promise<void> => {
    console.log('[Purchase] Attempting to save game to library:', gameId);
    
    // Check if already in local library
    const existing = await libraryService.getById(gameId);
    if (existing) {
      console.log('[Purchase] Game already exists in local library');
      return;
    }

    // Try to get from Library API first (best data)
    try {
      console.log('[Purchase] Fetching from Library API...');
      const libraryGame = await getLibraryGame(gameId);
      if (libraryGame) {
        console.log('[Purchase] Found game in Library API');
        const apiGame = convertLibraryGameToPGCGame(libraryGame);
        
        const webDist = apiGame.distribution?.find((d): d is { web: { url: string } } => 'web' in d);
        const webUrl = webDist?.web?.url;
        
        await libraryService.create({
          gameId: apiGame.gameId,
          gameName: apiGame.name,
          description: apiGame.description ?? '',
          coverVerticalImage: apiGame.coverVerticalImage ?? '',
          bannerImage: apiGame.bannerImage ?? '',
          launchType: 'web',
          webUrl,
          status: 'not-installed',
          stats: {
            totalPlayTimeSeconds: 0,
            launchCount: 0,
          },
        });
        console.log('[Purchase] Game saved to local library from API');
        return;
      }
    } catch (err) {
      console.warn('[Purchase] Library API failed:', err);
    }

    // Fallback: use current game data from the page
    if (game) {
      console.log('[Purchase] Using current game data from page');
      const webDist = game.distribution?.find((d): d is { web: { url: string } } => 'web' in d);
      const webUrl = webDist?.web?.url;
      
      await libraryService.create({
        gameId: game.gameId,
        gameName: game.name,
        description: game.description ?? '',
        coverVerticalImage: game.coverVerticalImage ?? '',
        bannerImage: game.bannerImage ?? '',
        launchType: 'web',
        webUrl,
        status: 'not-installed',
        stats: {
          totalPlayTimeSeconds: 0,
          launchCount: 0,
        },
      });
      console.log('[Purchase] Game saved to local library from page data');
      return;
    }

    throw new Error('No game data available to save');
  };

  const handleBuyClick = async () => {
    setPurchaseState(null);

    if (!wallet?.encryptedSeedPhrase) {
      setPurchaseState({ status: 'error', message: 'Please connect your wallet first.' });
      return;
    }

    // Check if wallet is unlocked
    const isLockOpen = await walletService.isLockOpen();
    if (!isLockOpen) {
      setPurchaseState({
        status: 'error',
        message: 'Please unlock your wallet to make a purchase.',
      });
      return;
    }

    if (buying) return;

    try {
      setBuying(true);
      await finalizePurchase();
      setPurchaseState({
        status: 'success',
        message: 'Purchase successful! The game has been added to your library.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Purchase] Purchase failed:', err);
      
      // Check if it's an "already purchased" message - treat as success
      if (message.includes('already purchased') || message.includes('already owned')) {
        setPurchaseState({
          status: 'success',
          message: 'You already own this game! It has been added to your library.',
        });
      } else {
        setPurchaseState({ status: 'error', message });
      }
    } finally {
      setBuying(false);
    }
  };

  const KRow = ({ label, value }: { label: string; value?: React.ReactNode }) => {
    if (!value) return null;
    return (
      <tr className="align-top">
        <td className="pr-6 py-2 text-muted-foreground">{label}</td>
        <td className="py-2 wrap-break-word">{value}</td>
      </tr>
    );
  };

  const renderHardwareCard = (tab: PlatformTab) => {
    const specs = (dist as Record<string, NativeSpec[] | WebSpec[] | undefined>)[tab];
    if (!Array.isArray(specs) || specs.length === 0) {
      return <p>No hardware requirements provided.</p>;
    }

    return specs.map((spec, index) => {
      const note = 'notes' in spec ? spec.notes : undefined;
      return (
        <div
          key={`${tab}-${index}`}
          className="rounded-lg border border-border bg-card px-6 py-4 shadow-flat-sm space-y-2"
        >
          {'os' in spec ? <KRow label="OS" value={spec.os} /> : null}
          <KRow label="Processor" value={spec.processor} />
          <KRow label="Graphics" value={spec.graphics} />
          <KRow label="Memory" value={'memory' in spec ? spec.memory : undefined} />
          <KRow label="Storage" value={'storage' in spec ? spec.storage : undefined} />
          <KRow label="Notes" value={note} />
        </div>
      );
    });
  };

  if (!game) {
    return (
      <main className="flex justify-center py-24">
        <div className="max-w-180 text-center">
          <h1 className="text-3xl font-semibold mb-4">Game not found</h1>
          <p className="text-muted-foreground">
            We could not find the game you are looking for. It might be unpublished or removed from
            the catalog.
          </p>
        </div>
      </main>
    );
  }

  const bannerImage =
    game.bannerImage ??
    metadata?.bannerImage ??
    metadata?.banner_image ??
    metadata?.coverHorizontalImage ??
    metadata?.cover_horizontal_image ??
    ImageLoading;

  const coverImage =
    game.coverVerticalImage ??
    metadata?.coverVerticalImage ??
    metadata?.cover_vertical_image ??
    metadata?.coverImage ??
    metadata?.cover_image ??
    ImageLoading;

  return (
    <main className="flex justify-center duration-300">
      <div className="max-w-350 w-full flex flex-col gap-10 duration-300 px-6 sm:px-8 md:px-12">
        {/* Hero */}
        <section className="relative w-full min-h-80 overflow-hidden shadow-flat-lg">
          <img
            src={bannerImage}
            alt={game.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />
          <div className="relative z-10 flex flex-col md:flex-row gap-6 justify-between items-end px-8 md:px-12 py-10 h-full">
            <div className="flex flex-col gap-4 md:w-3/5">
              <div className="flex flex-wrap gap-2 text-sm">
                {categories.map((item) => (
                  <span
                    key={item}
                    className="bg-white/10 px-4 py-1 rounded-full border border-white/10 uppercase tracking-wide text-foreground backdrop-blur-sm font-semibold"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                {game.name ?? 'PeridotVault Game'}
              </h1>
            </div>
            <div className="flex flex-col md:flex-row gap-4 items-center md:w-2/5 justify-end">
              <PriceCoin amount={rawPrice} tokenCanister={tokenCanister} textSize="lg" />
              <button
                type="button"
                className={`px-10 font-semibold py-2 rounded-md bg-accent transition ${
                  buying ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-flat-lg'
                }`}
                onClick={handleBuyClick}
                disabled={buying}
              >
                {buying ? 'Processing…' : rawPrice === 0 ? 'Get Free' : 'Buy Now'}
              </button>
              {purchaseState ? (
                <span
                  className={`text-sm font-medium ${
                    purchaseState.status === 'success' ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {purchaseState.message}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {/* Body */}
        <div className="grid gap-12 lg:grid-cols-[3fr_1.25fr]">
          <div className="flex flex-col gap-12">
            {/* Previews */}
            <section className="overflow-hidden">
              <CarouselPreview
                items={
                  previews.length
                    ? previews
                    : [
                        {
                          kind: 'image',
                          src: coverImage,
                        },
                      ]
                }
              />
            </section>

            {/* About */}
            <section className="space-y-6">
              <div className="space-y-3">
                <TypographyH2 text="About" />
                <p className="">
                  {game.description ?? metadata?.description ?? 'No description available.'}
                </p>
              </div>
              <table className="w-full text-sm md:text-base">
                <tbody>
                  <KRow
                    label="Released"
                    value={releaseDate ? new Date(releaseDate).toLocaleDateString() : undefined}
                  />
                  <KRow
                    label="Website"
                    value={
                      website ? (
                        <a
                          href={website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-2"
                        >
                          <FontAwesomeIcon icon={faGlobe} />
                          {website}
                        </a>
                      ) : undefined
                    }
                  />
                  <KRow
                    label="Supported Platforms"
                    value={availablePlatforms.length ? availablePlatforms.join(', ') : undefined}
                  />
                  <KRow
                    label="Tags"
                    value={tags.length ? tags.map((t) => `#${t}`).join(' ') : undefined}
                  />
                </tbody>
              </table>
            </section>

            {/* Hardware requirements */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <TypographyH2 text="Hardware Requirements" />
                <div className="flex gap-2 flex-wrap">
                  {PLATFORM_ORDER.filter((tab) => {
                    const specs = (dist as Record<string, NativeSpec[] | WebSpec[] | undefined>)[
                      tab
                    ];
                    return Array.isArray(specs) && specs.length > 0;
                  }).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={[
                        'px-4 py-2 rounded-md border transition flex items-center gap-2 text-sm',
                        tab === activeTab
                          ? 'bg-primary text-primary-foreground shadow-flat-md'
                          : 'bg-muted hover:bg-muted/80',
                      ].join(' ')}
                    >
                      <FontAwesomeIcon icon={PLATFORM_ICON[tab]} />
                      <span>{tab}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4">
                {activeTab ? (
                  renderHardwareCard(activeTab)
                ) : (
                  <p>Hardware information will appear here once configured.</p>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-8">
            <div className="rounded-lg shadow-arise-sm p-6 space-y-6">
              <div className="flex gap-4">
                <img
                  src={game.coverHorizontalImage}
                  alt={game.name}
                  className="w-full aspect-video object-cover rounded-md"
                />
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faAngleRight} />
                  <span>
                    Required age:{' '}
                    {metadata?.requiredAge ??
                      metadata?.required_age ??
                      game.requiredAge ??
                      'All ages'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faAngleRight} />
                  <span>Total purchased: {game.totalPurchased?.toLocaleString() ?? '0'}</span>
                </div>
              </div>
            </div>

            {/* {announcements.length ? (
              <div className="rounded-2xl border border-border bg-card shadow-flat-sm p-6 space-y-4">
                <h2 className="text-xl font-semibold">Latest Announcements</h2>
                <div className="flex flex-col gap-4">
                  {announcements.map((ann) => (
                    <AnnouncementContainer key={ann.announcementId} item={ann} />
                  ))}
                </div>
              </div>
            ) : null} */}
          </aside>
        </div>

        {/* Recommended */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold">More from the vault</h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {otherGames.slice(0, 8).map((item) => {
              const cover =
                item.coverVerticalImage ??
                item.coverHorizontalImage ??
                item.bannerImage ??
                item.metadata?.coverVerticalImage ??
                item.metadata?.cover_vertical_image ??
                ImageLoading;
              return (
                <VerticalCard
                  key={item.gameId}
                  gameId={item.gameId}
                  gameName={item.name ?? 'Unknown Game'}
                  imgUrl={cover}
                  price={item.price ?? 0}
                  tokenCanister={item.tokenPayment}
                />
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
