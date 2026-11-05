export type Timestamp = number | bigint;
export type Tag = string;
export type Category = string;

export type Platform =
    | 'web'
    | 'windows'
    | 'macos'
    | 'linux'
    | 'android'
    | 'ios'
    | 'other';

export type ViewMode = 'live' | 'web' | Platform;

export type Opt<T> = [] | [T];

export type StorageRef =
    | { s3: { bucket: string; basePath: string; objectKey?: string } }
    | { url: { url: string } }
    | { ipfs: { cid: string; path?: string } };

export interface Manifest {
    listing: string;
    createdAt: Timestamp;
    sizeBytes: number | bigint;
    version: string;
    storageRef: StorageRef;
    checksum: string | number[] | Uint8Array;

    /**
     * Optional aliases for legacy consumers while migration is underway.
     */
    size_bytes?: number | bigint;
    storage?: StorageRef;
}

type AdditionalNotes = string | string[] | null | undefined;

export interface WebDistribution {
    url: string;
    processor?: string;
    graphics?: string;
    memory?: number | bigint;
    storage?: number | bigint;
    additionalNotes?: AdditionalNotes;
}

export interface NativeDistribution {
    os: Platform;
    processor?: string;
    graphics?: string;
    memory?: number | bigint;
    storage?: number | bigint;
    manifests: Manifest[];
    liveVersion?: string;
    additionalNotes?: AdditionalNotes;
}

export type Distribution = { web: WebDistribution } | { native: NativeDistribution };

export interface MediaItemBase {
    id?: string;
    src?: string;
    url?: string;
    alt?: string;
    poster?: string;
    storageKey?: string;
    primary?: boolean;
    file?: File;
}

export type MediaItem =
    | (MediaItemBase & { kind: 'image' })
    | (MediaItemBase & { kind: 'video'; poster?: string });

export interface PublishInfo {
    isPublished: boolean;
    releaseDate?: Timestamp;
}

export interface Metadata {
    gameId?: GameId;
    game_id?: GameId;
    name?: string;
    description?: string;
    requiredAge?: number;
    required_age?: number;
    price?: number;
    website?: string;
    bannerImage?: string;
    banner_image?: string;
    coverVerticalImage?: string;
    cover_vertical_image?: string;
    coverHorizontalImage?: string;
    cover_horizontal_image?: string;
    coverImage?: string;
    cover_image?: string;
    previews?: MediaItem[];
    distribution?: Distribution[];
    distributions?: Distribution[];
    categories?: Category[];
    tags?: Tag[];
    publishInfo?: PublishInfo;
    is_published?: boolean;
    status?: string;
    releaseDate?: Timestamp;
    release_date?: Timestamp;
    release_date_ns?: number | bigint;
    draftStatus?: string;
    draft_status?: string;
    createdAt?: string;
    created_at?: string;
    updatedAt?: string;
    updated_at?: string;
    tokenPayment?: string;
    token_payment?: string;
    totalPurchased?: number;
    total_purchased?: number;
    [key: string]: unknown;
}

export interface PGCGame {
    gameId: GameId;
    name: string;
    description: string;
    published: boolean;
    price: number;
    tokenPayment: string;
    totalPurchased: number;
    maxSupply: number;
    requiredAge?: number;
    coverVerticalImage?: string;
    coverHorizontalImage?: string;
    bannerImage?: string;
    website?: string;
    metadata: Metadata | null;
    distribution: Distribution[];
    previews: MediaItem[];
}

export type GameId = string;

export interface DraftPGC {
  gameId?: GameId;
  requiredAge?: number;
  coverVerticalImage?: string;
  coverHorizontalImage?: string;
  bannerImage?: string;
  distribution?: Array<Distribution>;
  description?: string;
  name?: string;
  metadata?: Metadata | null;
  website?: string;
  price?: number;
  previews?: MediaItem[];
  categories?: Category[];
  tags?: Tag[];
  publishInfo?: PublishInfo;
}

export type DraftMetadata = {
  status?: PublishInfo;
  previews?: MediaItem[];
  categories?: Category[];
  tags?: Tag[];
};

export type DraftStatus = 'draft' | 'ready' | 'published';
export type DraftCompositeKey = [string, number];

export type GamePublish = {
  gameId: string;
  chainId: number;
  isPublished: boolean;
  releaseDate?: number;
};

export interface PGCContractMeta {
  gameId: GameId;
  name: string;
  description?: string;
  coverVerticalImage?: string;
  coverHorizontalImage?: string;
  bannerImage?: string;
  price?: number;
  requiredAge?: number;
  website?: string;
  metadata?: Metadata;
  distribution?: Array<Distribution>;
}

export type PreviewItem = MediaItem & {
  id: string;
  url: string;
  src: string;
  file?: File;
};
