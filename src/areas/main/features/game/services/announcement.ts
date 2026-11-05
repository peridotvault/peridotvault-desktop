import type { GameAnnouncementType } from '@shared/interfaces/game';

export interface CreateAnnouncementPayload {
  headline: string;
  content: string;
  coverImage?: string;
  pinned?: boolean;
  status?: string;
}

const announcementStore = new Map<string, GameAnnouncementType[]>();

const nowNs = (): bigint => BigInt(Date.now()) * 1_000_000n;

export async function getAllAnnouncementsByGameId({
  gameId,
}: {
  gameId: string;
  wallet?: any;
}): Promise<GameAnnouncementType[]> {
  return announcementStore.get(gameId) ?? [];
}

export async function getAnnouncementsByAnnouncementId({
  announcementId,
}: {
  announcementId: bigint | number;
  wallet?: any;
}): Promise<GameAnnouncementType | null> {
  for (const announcements of announcementStore.values()) {
    const found = announcements.find((ann) => ann.announcementId === announcementId.toString());
    if (found) return found;
  }
  return null;
}

export async function createAnnouncement({
  gameId,
  payload,
}: {
  payload: CreateAnnouncementPayload;
  wallet?: any;
  gameId: string;
}): Promise<GameAnnouncementType> {
  const record: GameAnnouncementType = {
    announcementId: `${gameId}-${Date.now()}`,
    headline: payload.headline,
    content: payload.content,
    coverImage: payload.coverImage,
    pinned: !!payload.pinned,
    createdAt: nowNs(),
    status: payload.status ? { status: payload.status } : undefined,
  };

  const list = announcementStore.get(gameId) ?? [];
  list.push(record);
  announcementStore.set(gameId, list);
  return record;
}

export async function commentByAnnouncementId({
  annId,
  comment,
}: {
  annId: bigint | number;
  wallet?: any;
  comment: string;
}): Promise<void> {
  console.info('commentByAnnouncementId stub', { annId: annId.toString(), comment });
}
