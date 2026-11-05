import type {
  Distribution,
  Manifest,
  MediaItem,
  NativeDistribution,
  WebDistribution,
} from '@shared/interfaces/game';
export type { MediaItem };
import { OSKey, Timestamp, UserId } from '../CoreInterface';

/** Jika kamu punya enum/variant final, impor dari file lain */
export type AppStatus = { publish: null } | { notPublish: null };

export type Media = { image: null } | { video: null };

export type Tag = string;
export type Category = string;
/** =========================
 *  Preview
 *  ========================= */
export interface Preview {
  kind: Media;
  url: string;
}

/** =========================
 *  App Rating
 *  ========================= */
export interface GameRating {
  userPrincipalId: UserId;
  rating: bigint; // Nat
  comment: string;
  createdAt: Timestamp;
}

/** =========================
 *  App
 *  ========================= */

export type GameStatusCode = 'publish' | 'notPublish';
export type ManifestsByOS = Record<OSKey, Manifest[]>;

export type HardwareFields = {
  processor: string;
  memory: string; // as string, nanti di-convert ke BigInt
  storage: string; // as string
  graphics: string;
  notes: string;
};

export type WebHardwareFields = {
  processor: string;
  memory: string;
  storage: string;
  graphics: string;
  notes?: string;
};

export type Option = {
  value: string;
  label: string;
};

export type PublishInfo = { status: GameStatusCode; releasedAt?: Timestamp };

export interface HydratedGameInterface {
  // ===== general
  gameId: string;
  name: string;
  description: string;
  coverImage?: string;
  bannerImage?: string;
  price?: string;
  requiredAge?: string;
  website?: string;
  distribution?: Option[]; // { value: 'web'|'windows'|'macos'|'linux', label: string }[]

  // inside metadata
  tags?: Tag[];
  categories?: Category[];
  previews?: MediaItem[];
  publishInfo?: PublishInfo; // { isPublished: true, releaseDate: Timestamp }

  manifestsByOS?: Record<OSKey, Manifest[]>;
  webHardware?: WebHardwareFields | null;
  hardwareByOS?: Record<OSKey, HardwareFields>;

  // Launcher-specific metadata
  platformType?: 'web' | 'native';
  isWeb?: boolean;
  downloadUrl?: string;
  installPath?: string;
}

/** =========================
 *  Type Guards
 *  ========================= */
export const isWeb = (d: Distribution): d is { web: WebDistribution } => 'web' in d;
export const isNative = (d: Distribution): d is { native: NativeDistribution } => 'native' in d;
