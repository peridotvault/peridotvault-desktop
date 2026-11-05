// src/shared/workers/library.worker.ts
// Web Worker for heavy library operations (image compression)

export interface CompressOptions {
  maxWidth: number;
  maxHeight: number;
  quality?: number;
  mimeType?: string;
}

export interface WorkerMessage {
  id: string;
  type: 'compressImage' | 'batchCompressImages';
  payload: unknown;
}

export interface WorkerResponse {
  id: string;
  type: 'success' | 'error';
  result?: unknown;
  error?: string;
}

interface CompressImagePayload {
  url: string;
  options: CompressOptions;
}

interface BatchCompressPayload {
  items: Array<{
    gameId: string;
    coverUrl?: string;
    bannerUrl?: string;
  }>;
  options: CompressOptions;
}

// Image compression function that runs in worker
async function compressImage(url: string, options: CompressOptions): Promise<string> {
  try {
    // Fetch image as blob
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    const blob = await response.blob();

    // Create bitmap from blob
    const bitmap = await createImageBitmap(blob);

    const origWidth = bitmap.width;
    const origHeight = bitmap.height;

    const widthRatio = options.maxWidth / origWidth;
    const heightRatio = options.maxHeight / origHeight;
    const ratio = Math.min(widthRatio, heightRatio, 1);

    const targetWidth = Math.round(origWidth * ratio);
    const targetHeight = Math.round(origHeight * ratio);

    // Use OffscreenCanvas in worker
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close(); // Release memory

    // Convert to blob
    const mimeType = options.mimeType || 'image/jpeg';
    const quality = options.quality || 0.8;
    const compressedBlob = await canvas.convertToBlob({
      type: mimeType,
      quality: quality,
    });

    // Create object URL (more efficient than data URL for large images)
    const objectUrl = URL.createObjectURL(compressedBlob);

    return objectUrl;
  } catch (err) {
    console.error('[Worker] Compression failed:', err);
    return url; // Return original on failure
  }
}

// Batch compress multiple game images
async function batchCompressImages(
  items: BatchCompressPayload['items'],
  options: CompressOptions,
): Promise<Array<{ gameId: string; cover?: string; banner?: string }>> {
  const results: Array<{ gameId: string; cover?: string; banner?: string }> = [];

  for (const item of items) {
    const result: { gameId: string; cover?: string; banner?: string } = {
      gameId: item.gameId,
    };

    if (item.coverUrl && !item.coverUrl.startsWith('data:') && !item.coverUrl.startsWith('blob:')) {
      result.cover = await compressImage(item.coverUrl, options);
    }

    if (
      item.bannerUrl &&
      !item.bannerUrl.startsWith('data:') &&
      !item.bannerUrl.startsWith('blob:')
    ) {
      result.banner = await compressImage(item.bannerUrl, options);
    }

    results.push(result);

    // Small delay between items to prevent overwhelming
    if (items.length > 5) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  return results;
}

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;

  try {
    switch (type) {
      case 'compressImage': {
        const { url, options } = payload as CompressImagePayload;
        const result = await compressImage(url, options);
        self.postMessage({ id, type: 'success', result } as WorkerResponse);
        break;
      }

      case 'batchCompressImages': {
        const { items, options } = payload as BatchCompressPayload;
        const result = await batchCompressImages(items, options);
        self.postMessage({ id, type: 'success', result } as WorkerResponse);
        break;
      }

      default:
        self.postMessage({
          id,
          type: 'error',
          error: `Unknown message type: ${type}`,
        } as WorkerResponse);
    }
  } catch (err) {
    self.postMessage({
      id,
      type: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
    } as WorkerResponse);
  }
};

export {};
