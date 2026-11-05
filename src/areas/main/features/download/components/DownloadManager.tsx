import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  DownloadTask,
  EnqueueDownloadInput,
  NativeDownloadInfo,
} from '../interfaces/download';
import { downloadFile } from '../lib/downloadFile';
import { selectInstallDirectory } from '../lib/selectInstallDir';
import { upsertInstalledEntry } from '@shared/utils/installedStorage';
import type { GameId } from '@shared/interfaces/game';
import { libraryService } from '@main/features/library/services/localDb';

type RequestInstallOptions = Omit<EnqueueDownloadInput, 'installDir'>;

type DownloadQueueContextValue = {
  tasks: DownloadTask[];
  enqueue: (input: EnqueueDownloadInput) => Promise<DownloadTask>;
  requestInstall: (input: RequestInstallOptions) => Promise<void>;
  getTaskForGame: (gameId: string) => DownloadTask | undefined;
};

const DownloadQueueContext = createContext<DownloadQueueContextValue | null>(null);

export const useDownloadQueue = () => {
  const ctx = useContext(DownloadQueueContext);
  if (!ctx) {
    throw new Error('useDownloadQueue must be used within DownloadProvider');
  }
  return ctx;
};

const buildTask = async (input: EnqueueDownloadInput): Promise<DownloadTask> => {
  return {
    id: `${input.gameId}-${Date.now()}`,
    gameId: input.gameId,
    title: input.title,
    os: input.download.os,
    url: input.download.url,
    status: 'queued',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: input.download.sizeBytes,
    destinationDir: input.installDir,
    fileName: input.download.fileName,
    version: input.download.version,
  };
};

export const DownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const processingRef = useRef(false);
  const tasksRef = useRef<DownloadTask[]>([]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const enqueue = useCallback(async (input: EnqueueDownloadInput) => {
    const task = await buildTask(input);
    setTasks((prev) => [...prev, task]);
    return task;
  }, []);

  const getTaskForGame = useCallback(
    (gameId: string) => tasks.find((t) => t.gameId === gameId && t.status !== 'completed'),
    [tasks],
  );

  const persistInstall = useCallback(
    async (task: DownloadTask, filePath: string, sizeBytes?: number) => {
      const installedAt = Date.now();
      await upsertInstalledEntry(
        task.gameId,
        {
          version: task.version ?? 'latest',
          os: task.os,
          filePath,
          installDir: task.destinationDir,
          launchPath: filePath,
          fileName: task.fileName,
          sizeBytes,
          checksumVerified: false,
          installedAt,
        },
        { title: task.title },
      );

      // Keep library table in sync so list/detail pages show installed info.
      try {
        await libraryService.setInstallInfo(
          task.gameId as GameId,
          {
            installPath: task.destinationDir,
            executableRelativePath: task.fileName,
            sizeBytes: sizeBytes ?? 0,
          },
          'installed',
        );
      } catch (error) {
        console.warn('[download] failed to update library install info', error);
      }
    },
    [],
  );

  const processNext = useCallback(async () => {
    if (processingRef.current) return;
    const next = tasksRef.current.find((t) => t.status === 'queued');
    if (!next) return;

    processingRef.current = true;
    setTasks((prev) =>
      prev.map((t) => (t.id === next.id ? { ...t, status: 'downloading', progress: 0 } : t)),
    );

    try {
      const result = await downloadFile({
        url: next.url,
        destinationDir: next.destinationDir,
        fileName: next.fileName,
        onProgress: (downloaded, total) => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === next.id
                ? {
                    ...t,
                    downloadedBytes: downloaded,
                    totalBytes: total ?? t.totalBytes,
                    progress: total ? Math.min(1, downloaded / total) : 0,
                  }
                : t,
            ),
          );
        },
      });

      const finalSize = result.totalBytes ?? next.totalBytes ?? next.downloadedBytes;
      await persistInstall(next, result.filePath, finalSize);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === next.id
            ? {
                ...t,
                status: 'completed',
                progress: 1,
                downloadedBytes: finalSize ?? t.downloadedBytes,
                totalBytes: finalSize ?? t.totalBytes,
                filePath: result.filePath,
              }
            : t,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[download] task failed', message);
      setTasks((prev) =>
        prev.map((t) => (t.id === next.id ? { ...t, status: 'error', error: message } : t)),
      );
    } finally {
      processingRef.current = false;
    }
  }, [persistInstall]);

  useEffect(() => {
    if (processingRef.current) return;
    const hasQueued = tasks.some((t) => t.status === 'queued');
    if (hasQueued) {
      void processNext();
    }
  }, [tasks, processNext]);

  const requestInstall = useCallback(
    async (input: RequestInstallOptions) => {
      const installDir = await selectInstallDirectory();
      if (!installDir) return;
      await enqueue({ ...input, installDir });
    },
    [enqueue],
  );

  const value = useMemo<DownloadQueueContextValue>(
    () => ({
      tasks,
      enqueue,
      requestInstall,
      getTaskForGame,
    }),
    [tasks, enqueue, requestInstall, getTaskForGame],
  );

  const activeTasks = tasks.filter((t) => t.status !== 'completed').slice(-3);

  return (
    <DownloadQueueContext.Provider value={value}>
      {children}
      {activeTasks.length > 0 ? (
        <div className="fixed right-4 bottom-4 z-40 w-80 space-y-2">
          {activeTasks.map((task) => (
            <div
              key={task.id}
              className="rounded-xl border border-white/10 bg-background_primary/80 backdrop-blur p-3 shadow-flat-sm"
            >
              <div className="text-xs opacity-80 mb-1">
                {task.title} · {task.os} {task.version ? `v${task.version}` : ''}
              </div>
              <div className="w-full h-2 rounded bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-white/70 transition-all"
                  style={{ width: `${Math.round(task.progress * 100)}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] opacity-70">
                {task.status}
                {task.totalBytes
                  ? ` · ${(task.downloadedBytes / 1024 / 1024).toFixed(1)} / ${(task.totalBytes / 1024 / 1024).toFixed(1)} MB`
                  : ''}
                {task.error ? ` · ${task.error}` : ''}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </DownloadQueueContext.Provider>
  );
};

export type { NativeDownloadInfo };
