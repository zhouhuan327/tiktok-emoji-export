import { SyncProgress, syncFiles } from './sync-utils';
import { DeviceConfig } from './db';

// Global singleton to hold the active sync job
// We attach it to globalThis to survive HMR in dev mode
const globalForSync = globalThis as unknown as { syncManager: SyncManager };

type SyncStatus = 'idle' | 'scanning' | 'syncing' | 'paused' | 'error' | 'completed';

interface SyncJob {
  id: string;
  deviceId: string;
  files: string[];
  status: SyncStatus;
  progress: SyncProgress | null;
  history: SyncProgress[];
  error: string | null;
  abortController: AbortController;
  startTime: number;
  loopPromise?: Promise<void>;
}

export class SyncManager {
  private currentJob: SyncJob | null = null;

  constructor() {
    if (this.currentJob) return;
  }

  public getStatus() {
    if (!this.currentJob) {
      return { status: 'idle' as SyncStatus, job: null };
    }
    return {
      status: this.currentJob.status,
      job: {
        ...this.currentJob,
        abortController: undefined // Don't expose internal controller
      }
    };
  }

  public startSync(deviceId: string, config: DeviceConfig, files: string[], renameMap: Record<string, string>) {
    // If a job is already running for this device, return it
    if (this.currentJob && this.currentJob.status === 'syncing') {
      if (this.currentJob.deviceId === deviceId) {
        return this.currentJob.id; // Already syncing this device
      } else {
        throw new Error(`Another sync job is running for device: ${this.currentJob.deviceId}`);
      }
    }

    const id = Date.now().toString();
    const controller = new AbortController();

    this.currentJob = {
      id,
      deviceId,
      files,
      status: 'syncing',
      progress: null,
      history: [],
      error: null,
      abortController: controller,
      startTime: Date.now()
    };

    // Start the async process without awaiting it (fire and forget)
    const loopPromise = this.runSyncLoop(config, files, renameMap).catch(err => {
      console.error('Fatal sync loop error:', err);
      if (this.currentJob) {
        this.currentJob.status = 'error';
        this.currentJob.error = err.message;
      }
    });
    
    this.currentJob.loopPromise = loopPromise;

    return id;
  }

  private async runSyncLoop(config: DeviceConfig, files: string[], renameMap: Record<string, string>) {
    if (!this.currentJob) return;

    try {
      // Pass the signal to syncFiles to handle cleanup on abort
      const generator = syncFiles(
        config.sourcePath, 
        config.targetPath, 
        files, 
        renameMap, 
        this.currentJob.abortController.signal
      );
      
      for await (const progress of generator) {
        if (!this.currentJob) break;
        
        // Check for cancellation
        if (this.currentJob.abortController.signal.aborted) {
          // Break the loop, the catch block or final cleanup will handle the rest
          break; 
        }

        this.currentJob.progress = progress;
        
        if (progress.type === 'error') {
            console.error('Sync Error:', progress.error, 'File:', progress.file);
        }

        if (progress.type === 'file-complete') {
            this.currentJob.history.push(progress);
        }
      }

      if (this.currentJob && !this.currentJob.abortController.signal.aborted) {
        this.currentJob.status = 'completed';
      }

    } catch (error: any) {
      if (this.currentJob) {
        if (error.message === 'Aborted' || error.name === 'AbortError') {
            this.currentJob.status = 'idle'; // Reset to idle or showing 'cancelled' state
        } else {
            console.error('Sync Job Failed:', error);
            this.currentJob.status = 'error';
            this.currentJob.error = error.message;
        }
      }
    }
  }

  public async stopSync() {
    if (this.currentJob && this.currentJob.status === 'syncing') {
      this.currentJob.abortController.abort();
      
      // Wait for the loop to finish (cleanup)
      if (this.currentJob.loopPromise) {
          // Add timeout to prevent hanging if loop is stuck
          const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 2000));
          await Promise.race([this.currentJob.loopPromise, timeoutPromise]);
      }

      this.currentJob.status = 'idle'; // Or 'cancelled'
      // We keep the job object for a moment so UI can see it stopped?
      // Or just null it out?
      // Better to keep it but mark as idle/cancelled so user can clear it.
      // For simplicity, let's reset.
      this.currentJob = null;
    }
  }
  
  public clearJob() {
      this.currentJob = null;
  }
}

export const syncManager = globalForSync.syncManager || new SyncManager();

if (process.env.NODE_ENV !== 'production') {
  globalForSync.syncManager = syncManager;
}
