import { appDb } from '@core/storage/storage.db';
import { GameId } from '@shared/interfaces/game';
import {
  CreateLibraryEntryInput,
  InstallInfo,
  LibraryEntry,
  LibraryStatus,
  PlayStats,
  UpdateLibraryEntryInput,
} from '@shared/interfaces/library';

function buildDefaultStats(partial?: Partial<PlayStats>): PlayStats {
  const now = Date.now();

  return {
    totalPlayTimeSeconds: partial?.totalPlayTimeSeconds ?? 0,
    lastLaunchedAt: partial?.lastLaunchedAt,
    installedAt: partial?.installedAt ?? now,
    launchCount: partial?.launchCount ?? 0,
  };
}

/**
 sidebar : gameId, image, gameName
 library: 
 - recently play => gameId, verticalImage,
 - all game => gameId, verticalImage
 */

export const libraryService = {
  /**
   * Create / upsert LibraryEntry.
   * - Kalau gameId sudah ada, akan di-overwrite (upsert).
   */
  async create(input: CreateLibraryEntryInput): Promise<LibraryEntry> {
    const now = Date.now();

    const entry: LibraryEntry = {
      gameId: input.gameId,
      gameName: input.gameName,
      description: input.description,
      coverVerticalImage: input.coverVerticalImage,
      bannerImage: input.bannerImage,

      launchType: input.launchType,
      install: input.install,
      webUrl: input.webUrl,

      stats: buildDefaultStats(input.stats),
      status: input.status ?? 'installed', // default: installed (bisa kamu ganti)

      createdAt: now,
      updatedAt: now,
    };

    await appDb.library.put(entry); // put = add or update by primaryKey
    return entry;
  },

  /**
   * Read: get satu entry berdasarkan gameId.
   */
  async getById(gameId: GameId): Promise<LibraryEntry | undefined> {
    return appDb.library.get(gameId);
  },

  /**
   * Read: ambil semua library, bisa di-sort by createdAt desc.
   */
  async getAll(): Promise<LibraryEntry[]> {
    return appDb.library.orderBy('createdAt').reverse().toArray();
  },

  /**
   * Read: ambil semua game dengan status tertentu (misalnya "installed").
   */
  async getByStatus(status: LibraryStatus): Promise<LibraryEntry[]> {
    return appDb.library.where('status').equals(status).toArray();
  },

  /**
   * Update: patch sebagian field berdasarkan gameId.
   * - otomatis update updatedAt.
   */
  async update(gameId: GameId, patch: UpdateLibraryEntryInput): Promise<void> {
    const existing = await appDb.library.get(gameId);
    if (!existing) return;

    const mergedStats: PlayStats = {
      ...existing.stats,
      ...(patch.stats ?? {}),
    };

    let mergedInstall: InstallInfo | undefined = existing.install;

    if (patch.install) {
      if (!existing.install) {
        // Kalau belum ada install sama sekali, cek dulu apakah patch.install cukup lengkap
        const { installPath, executableRelativePath, sizeBytes } = patch.install;

        if (installPath && executableRelativePath && typeof sizeBytes === 'number') {
          mergedInstall = {
            installPath,
            executableRelativePath,
            sizeBytes,
          };
        } else {
          // kalau tidak lengkap, boleh:
          // - abaikan, atau
          // - throw error
          console.warn(
            '[libraryService.update] patch.install tidak lengkap untuk membuat InstallInfo baru',
            patch.install,
          );
        }
      } else {
        // existing.install sudah ada → merge partial
        mergedInstall = {
          ...existing.install,
          ...patch.install,
        };
      }
    }

    const updated: LibraryEntry = {
      ...existing,
      ...patch,
      stats: mergedStats,
      install: mergedInstall,
      updatedAt: Date.now(),
    };

    await appDb.library.put(updated);
  },

  /**
   * Delete: hapus game dari library.
   */
  async remove(gameId: GameId): Promise<void> {
    await appDb.library.delete(gameId);
  },

  // ===== Helpers khusus PeridotVault =====

  /**
   * Set / update informasi instalasi game.
   * Cocok dipanggil setelah proses install selesai.
   */
  async setInstallInfo(
    gameId: GameId,
    installInfo: InstallInfo,
    status: LibraryStatus = 'installed',
  ): Promise<void> {
    const now = Date.now();

    await appDb.library
      .where('gameId')
      .equals(gameId)
      .modify((entry) => {
        entry.install = installInfo;
        entry.status = status;
        entry.stats.installedAt ??= now;
        entry.updatedAt = now;
      });
  },

  /**
   * Record sesi bermain:
   * - tambah totalPlayTimeSeconds
   * - update lastLaunchedAt
   * - increment launchCount
   */
  async recordGameSession(gameId: GameId, durationSeconds: number): Promise<void> {
    const now = Date.now();

    await appDb.library
      .where('gameId')
      .equals(gameId)
      .modify((entry) => {
        entry.stats.totalPlayTimeSeconds += durationSeconds;
        entry.stats.lastLaunchedAt = now;
        entry.stats.launchCount += 1;
        entry.updatedAt = now;
      });
  },

  /**
   * Update status game (misalnya setelah install, uninstall, error, dsb).
   */
  async setStatus(gameId: GameId, status: LibraryStatus): Promise<void> {
    await appDb.library.update(gameId, {
      status,
      updatedAt: Date.now(),
    });
  },

  /**
   * Clear all library entries.
   * Used when logging out to ensure clean state for new user.
   */
  async clear(): Promise<void> {
    await appDb.library.clear();
    console.log('[libraryService] All library entries cleared');
  },
};
