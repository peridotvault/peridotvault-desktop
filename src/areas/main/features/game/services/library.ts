import { libraryService } from '@features/library/services/localDb';
import type { LibraryEntry, CreateLibraryEntryInput } from '@shared/interfaces/library';

export async function getLocalGames(): Promise<LibraryEntry[]> {
  try {
    const entries = await libraryService.getAll();
    console.log(`[getLocalGames] Loaded ${entries.length} games from local DB`);
    return entries;
  } catch (error) {
    console.error('[getLocalGames] Failed to load games:', error);
    return [];
  }
}

export async function addLocalGame(game: CreateLibraryEntryInput): Promise<LibraryEntry | null> {
  try {
    const entry = await libraryService.create(game);
    console.log(`[addLocalGame] Added game to library: ${game.gameId}`);
    return entry;
  } catch (error) {
    console.error('[addLocalGame] Failed to add game:', error);
    return null;
  }
}
