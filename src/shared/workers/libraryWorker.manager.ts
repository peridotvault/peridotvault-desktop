// src/shared/workers/libraryWorker.manager.ts
// Manager for library worker - handles worker lifecycle and message passing

import type { CompressOptions, WorkerMessage, WorkerResponse } from './library.worker';

let worker: Worker | null = null;
let messageId = 0;
const pendingPromises = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    // Create worker using inline blob to avoid bundling issues
    const workerCode = `
      self.onmessage = async (event) => {
        const { id, type, payload } = event.data;
        
        try {
          if (type === 'compressImage') {
            const { url, options } = payload;
            const result = await compressImage(url, options);
            self.postMessage({ id, type: 'success', result });
          } else if (type === 'batchCompressImages') {
            const { items, options } = payload;
            const result = await batchCompressImages(items, options);
            self.postMessage({ id, type: 'success', result });
          }
        } catch (err) {
          self.postMessage({ id, type: 'error', error: err.message });
        }
      };
      
      async function compressImage(url, options) {
        try {
          const response = await fetch(url, { mode: 'cors' });
          if (!response.ok) throw new Error('Failed to fetch');
          const blob = await response.blob();
          const bitmap = await createImageBitmap(blob);
          
          const ratio = Math.min(
            options.maxWidth / bitmap.width,
            options.maxHeight / bitmap.height,
            1
          );
          
          const width = Math.round(bitmap.width * ratio);
          const height = Math.round(bitmap.height * ratio);
          
          const canvas = new OffscreenCanvas(width, height);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(bitmap, 0, 0, width, height);
          bitmap.close();
          
          const compressed = await canvas.convertToBlob({
            type: options.mimeType || 'image/jpeg',
            quality: options.quality || 0.8,
          });
          
          return URL.createObjectURL(compressed);
        } catch (err) {
          return url;
        }
      }
      
      async function batchCompressImages(items, options) {
        const results = [];
        for (const item of items) {
          const result = { gameId: item.gameId };
          if (item.coverUrl && !item.coverUrl.startsWith('data:') && !item.coverUrl.startsWith('blob:')) {
            result.cover = await compressImage(item.coverUrl, options);
          }
          if (item.bannerUrl && !item.bannerUrl.startsWith('data:') && !item.bannerUrl.startsWith('blob:')) {
            result.banner = await compressImage(item.bannerUrl, options);
          }
          results.push(result);
          if (items.length > 5) await new Promise(r => setTimeout(r, 10));
        }
        return results;
      }
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { id, type, result, error } = event.data;
      const pending = pendingPromises.get(id);

      if (pending) {
        if (type === 'success') {
          pending.resolve(result);
        } else {
          pending.reject(new Error(error || 'Worker error'));
        }
        pendingPromises.delete(id);
      }
    };

    worker.onerror = (err) => {
      console.error('[LibraryWorker] Worker error:', err);
    };
  }

  return worker;
}

function sendMessage<T>(type: WorkerMessage['type'], payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = `${++messageId}`;
    pendingPromises.set(id, { resolve: resolve as (value: unknown) => void, reject });

    try {
      getWorker().postMessage({ id, type, payload });
    } catch (err) {
      pendingPromises.delete(id);
      reject(err);
    }
  });
}

export const libraryWorker = {
  async compressImage(url: string, options: CompressOptions): Promise<string> {
    return sendMessage('compressImage', { url, options });
  },

  async batchCompressImages(
    items: Array<{ gameId: string; coverUrl?: string; bannerUrl?: string }>,
    options: CompressOptions,
  ): Promise<Array<{ gameId: string; cover?: string; banner?: string }>> {
    return sendMessage('batchCompressImages', { items, options });
  },

  terminate() {
    if (worker) {
      worker.terminate();
      worker = null;
      pendingPromises.clear();
    }
  },
};
