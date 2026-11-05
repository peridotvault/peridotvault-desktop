import { create } from 'zustand';
import type {
  LibraryEntry,
  LibraryStatus,
  CreateLibraryEntryInput,
} from '@shared/interfaces/library';
import { libraryService } from '../services/localDb';

interface LibraryState {
  entries: LibraryEntry[];
  isLoading: boolean;
  isSyncing: boolean;
  error?: string;

  // Actions
  loadAll: () => Promise<void>;
  addEntry: (entry: CreateLibraryEntryInput) => Promise<void>;
  updateEntry: (gameId: string, patch: Partial<LibraryEntry>) => Promise<void>;
  clearAll: () => Promise<void>;
  setSyncing: (syncing: boolean) => void;
  setError: (error?: string) => void;

  // Getters
  getByStatus: (status: LibraryStatus) => LibraryEntry[];
  getById: (gameId: string) => LibraryEntry | undefined;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  entries: [],
  isLoading: true, // Start with loading true
  isSyncing: false,
  error: undefined,

  async loadAll() {
    console.log('[useLibraryStore] Loading all entries from local DB...');
    try {
      const entries = await libraryService.getAll();
      console.log(`[useLibraryStore] Loaded ${entries.length} entries`);
      set({ entries, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load library';
      console.error('[useLibraryStore] loadAll error:', err);
      set({ error: message, isLoading: false });
    }
  },

  async addEntry(input: CreateLibraryEntryInput) {
    console.log(`[useLibraryStore] addEntry called for: ${input.gameId}`, input);
    try {
      // Check if entry already exists
      const existing = get().entries.find((e) => e.gameId === input.gameId);
      if (existing) {
        console.log(`[useLibraryStore] Entry ${input.gameId} already exists, skipping`);
        return;
      }

      console.log(`[useLibraryStore] Creating entry in DB for: ${input.gameId}`);
      const entry = await libraryService.create(input);
      console.log(`[useLibraryStore] DB entry created:`, entry);

      set((state) => {
        const newEntries = [...state.entries, entry].sort((a, b) =>
          a.gameName.localeCompare(b.gameName, undefined, { sensitivity: 'base' }),
        );
        console.log(`[useLibraryStore] Store updated, entries count: ${newEntries.length}`);
        return { entries: newEntries };
      });
    } catch (err) {
      console.error(`[useLibraryStore] addEntry error for ${input.gameId}:`, err);
    }
  },

  async updateEntry(gameId: string, patch: Partial<LibraryEntry>) {
    try {
      await libraryService.update(gameId as any, patch);
      set((state) => ({
        entries: state.entries.map((e) =>
          e.gameId === gameId ? { ...e, ...patch, updatedAt: Date.now() } : e,
        ),
      }));
    } catch (err) {
      console.error('[useLibraryStore] updateEntry error:', err);
    }
  },

  async clearAll() {
    console.log('[useLibraryStore] Clearing all entries...');
    try {
      await libraryService.clear();
      set({ entries: [], isLoading: true, isSyncing: false, error: undefined });
      console.log('[useLibraryStore] All entries cleared');
    } catch (err) {
      console.error('[useLibraryStore] clearAll error:', err);
    }
  },

  setSyncing(syncing: boolean) {
    set({ isSyncing: syncing });
  },

  setError(error?: string) {
    set({ error });
  },

  getByStatus(status) {
    return get().entries.filter((e) => e.status === status);
  },

  getById(gameId: string) {
    return get().entries.find((e) => e.gameId === gameId);
  },
}));
