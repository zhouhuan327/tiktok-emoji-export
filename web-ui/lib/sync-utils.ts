import { createReadStream, createWriteStream, utimes } from 'fs';
import { stat, mkdir, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { Readable, Writable } from 'stream';

export type SyncProgress = {
  type: 'progress' | 'file-start' | 'file-complete' | 'complete' | 'error';
  file?: string;
  transferred?: number;
  total?: number;
  speed?: number; // MB/s
  percentage?: number;
  currentFileIndex?: number;
  totalFiles?: number;
  error?: string;
};

const HIGH_WATER_MARK = 64 * 1024; // 64KB

export async function* syncFiles(
  sourceBase: string,
  targetBase: string,
  files: string[],
  renameMap: Record<string, string> = {},
  signal?: AbortSignal
): AsyncGenerator<SyncProgress> {
  
  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) break;

    const relPath = files[i];
    const sourcePath = join(sourceBase, relPath);
    
    // Check if there is a renamed version for this file
    // The key in renameMap is the original filename (relPath)
    // If found, use the new name for the target
    const targetName = renameMap[relPath] || relPath;
    const targetPath = join(targetBase, targetName);

    let readStream: Readable | null = null;
    let writeStream: Writable | null = null;
    let isComplete = false;

    const onAbort = () => {
        readStream?.destroy();
        writeStream?.destroy();
    };
    if (signal) signal.addEventListener('abort', onAbort);

    try {
      const stats = await stat(sourcePath);
      const totalSize = stats.size;
      const originalMtime = stats.mtime;

      yield { 
        type: 'file-start', 
        file: relPath, 
        currentFileIndex: i + 1, 
        totalFiles: files.length,
        total: totalSize
      };

      const targetDir = dirname(targetPath);
      await mkdir(targetDir, { recursive: true });

      readStream = createReadStream(sourcePath, { highWaterMark: HIGH_WATER_MARK });
      writeStream = createWriteStream(targetPath);

      let transferred = 0;
      let lastTime = Date.now();
      let lastTransferred = 0;

      // Create a promise to handle writing completion and errors
      const writePromise = new Promise<void>((resolve, reject) => {
        writeStream!.on('finish', resolve);
        writeStream!.on('error', reject);
      });

      // Read stream iterator
      try {
        for await (const chunk of readStream) {
          if (writeStream.destroyed) break; // Check if write stream was destroyed externally (e.g. abort)
          if (signal?.aborted) throw new Error('Aborted');

          const canWrite = writeStream.write(chunk);
          if (!canWrite) {
            await new Promise<void>((resolve, reject) => {
              let timeoutId: NodeJS.Timeout;

              const onDrain = () => {
                cleanup();
                resolve();
              };
              const onError = (err: Error) => {
                cleanup();
                reject(err);
              };
              const onTimeout = () => {
                cleanup();
                reject(new Error('Write stream drain timeout'));
              };

              const cleanup = () => {
                writeStream?.removeListener('drain', onDrain);
                writeStream?.removeListener('error', onError);
                if (timeoutId) clearTimeout(timeoutId);
              };

              writeStream!.once('drain', onDrain);
              writeStream!.once('error', onError);
              timeoutId = setTimeout(onTimeout, 30000); // 30s timeout
            });
          }
  
          transferred += chunk.length;
          const now = Date.now();
          
          // Yield progress every 500ms or so to avoid spamming
          if (now - lastTime >= 500) {
            const delta = transferred - lastTransferred;
            const timeDelta = (now - lastTime) / 1000;
            const speed = timeDelta > 0 ? (delta / (1024 * 1024)) / timeDelta : 0;
            
            yield {
              type: 'progress',
              file: relPath,
              transferred,
              total: totalSize,
              percentage: Math.round((transferred / totalSize) * 100),
              speed,
              currentFileIndex: i + 1,
              totalFiles: files.length
            };
            
            lastTime = now;
            lastTransferred = transferred;
          }
        }
      } catch (streamErr) {
          // If aborted, cleanup target file
          if ((streamErr as any).code === 'ABORT_ERR' || writeStream.destroyed || signal?.aborted || (streamErr as Error).message === 'Aborted') {
              await unlink(targetPath).catch((err) => console.error(`Failed to cleanup aborted file ${targetPath}:`, err));
              throw new Error('Aborted');
          }
          throw streamErr;
      }
  
      writeStream.end();
      await writePromise;
  
      // Preserve mtime
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
             reject(new Error('Utimes timeout'));
        }, 10000);

        utimes(targetPath, originalMtime, originalMtime, (err) => {
          clearTimeout(timeoutId);
          if (err) reject(err);
          else resolve();
        });
      });

      isComplete = true;

      yield { 
        type: 'file-complete', 
        file: relPath,
        currentFileIndex: i + 1, 
        totalFiles: files.length 
      };

    } catch (err) {
      console.error(`Error syncing ${relPath}:`, err);
      
      // Check for Disk Full Error
      if ((err as any).code === 'ENOSPC') {
        throw new Error(`目标磁盘空间已满，无法继续同步`);
      }

      // Check if source base still exists (device might be disconnected)
      try {
          await stat(sourceBase);
      } catch (statErr) {
          throw new Error(`Device disconnected: ${sourceBase}`);
      }

      yield { type: 'error', error: (err as Error).message, file: relPath };
      // Continue to next file? Yes.
    } finally {
      if (signal) signal.removeEventListener('abort', onAbort);
      readStream?.destroy();
      writeStream?.destroy();

      // If aborted during processing this file, clean up the partial file
      if (signal?.aborted && !isComplete) {
        await unlink(targetPath).catch((err) => console.error(`Failed to cleanup partial file ${targetPath}:`, err));
      }
    }
  }

  if (!signal?.aborted) {
      yield { type: 'complete' };
  }
}
