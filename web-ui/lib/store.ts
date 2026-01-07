import { create } from 'zustand';
import { DeviceConfig } from './db';
import { SyncProgress } from './sync-utils';
import { toast } from 'sonner';

interface DeviceItem extends DeviceConfig {
  name: string;
  isConnected: boolean;
}

interface ScanResult {
  missingFiles: string[];
  sourcePath: string;
  targetPath: string;
  totalMissingSize: number;
}

interface SyncJob {
    id: string;
    deviceId: string;
    files: string[];
    status: 'idle' | 'scanning' | 'syncing' | 'paused' | 'error' | 'completed';
    progress: SyncProgress | null;
    history: SyncProgress[];
    error: string | null;
    startTime: number;
}

interface AppState {
  devices: DeviceItem[];
  selectedDevice: string;
  loadingDevices: boolean;
  
  scanning: boolean;
  scanResult: ScanResult | null;
  
  syncing: boolean;
  syncComplete: boolean;
  syncJob: SyncJob | null; // Currently tracked job from server
  syncProgress: SyncProgress | null;
  syncHistory: SyncProgress[];
  
  // Actions
  fetchDevices: (background?: boolean) => Promise<void>;
  setSelectedDevice: (name: string) => void;
  
  scanDevice: (deviceName?: string) => Promise<void>;
  
  startSync: () => Promise<void>;
  stopSync: () => Promise<void>;
  
  // CRUD
  saveDevice: (device: Partial<DeviceItem>, isEditing: boolean) => Promise<boolean>;
  deleteDevice: (name: string) => Promise<boolean>;

  // Polling
  pollSyncStatus: () => Promise<void>;
  restoreSession: () => Promise<void>;
  
  // UI helpers
  resetSyncState: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  devices: [],
  selectedDevice: '',
  loadingDevices: false,
  
  scanning: false,
  scanResult: null,
  
  syncing: false,
  syncComplete: false,
  syncJob: null,
  syncProgress: null,
  syncHistory: [],
  
  fetchDevices: async (background = false) => {
    if (!background) set({ loadingDevices: true });
    try {
      const res = await fetch('/api/devices');
      const data: DeviceItem[] = await res.json();
      set({ devices: data });
    } catch (err) {
      console.error(err);
    } finally {
      if (!background) set({ loadingDevices: false });
    }
  },
  
  setSelectedDevice: (name) => {
      set({ selectedDevice: name, scanResult: null, syncComplete: false });
  },
  
  scanDevice: async (deviceName?: string) => {
    const device = deviceName || get().selectedDevice;
    if (!device) return;

    if (deviceName && deviceName !== get().selectedDevice) {
        set({ selectedDevice: deviceName });
    }

    set({ scanning: true, scanResult: null, syncComplete: false, syncProgress: null, syncHistory: [] });
    
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        body: JSON.stringify({ device }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      set({ scanResult: data });
      
      if (data.missingFiles.length === 0) {
          toast.info('没有发现需要同步的文件');
      } else {
          toast.success(`扫描完成，发现 ${data.missingFiles.length} 个新文件`);
      }
    } catch (err) {
      toast.error('扫描失败: ' + (err as Error).message);
    } finally {
      set({ scanning: false });
    }
  },
  
  startSync: async () => {
      const { selectedDevice, scanResult } = get();
      if (!selectedDevice || !scanResult || scanResult.missingFiles.length === 0) return;
      
      set({ syncing: true, syncComplete: false, syncHistory: [] });
      
      try {
          // 1. Start Job
          const res = await fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  device: selectedDevice, 
                  files: scanResult.missingFiles 
              })
          });
          
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to start sync');
          
          // 2. Start Polling
          // We rely on pollSyncStatus to update state
          toast.info('同步任务已后台启动');
          
      } catch (err) {
          toast.error('启动同步失败: ' + (err as Error).message);
          set({ syncing: false });
      }
  },
  
  stopSync: async () => {
      try {
          await fetch('/api/sync/status', { method: 'DELETE' });
          set({ syncing: false });
          toast.info('已请求停止同步');
      } catch (err) {
          console.error(err);
      }
  },

  saveDevice: async (device: Partial<DeviceItem>, isEditing: boolean) => {
    if (!device.name) return false;
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isEditing ? 'update' : 'create',
          name: device.name,
          oldName: isEditing ? (device as any).originalName : undefined,
          config: {
            sourcePath: device.sourcePath,
            targetPath: device.targetPath,
            ignoreExtensions: typeof device.ignoreExtensions === 'string' 
              ? (device.ignoreExtensions as string).split(',').map(s => s.trim()) 
              : device.ignoreExtensions || []
          }
        })
      });
      
      if (!res.ok) throw new Error('Failed to save');
      
      await get().fetchDevices();
      toast.success('保存成功');
      return true;
    } catch (err) {
      toast.error('保存失败');
      return false;
    }
  },

  deleteDevice: async (name: string) => {
    try {
      await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', name })
      });
      await get().fetchDevices();
      if (get().selectedDevice === name) set({ selectedDevice: '' });
      toast.success('删除成功');
      return true;
    } catch (err) {
      toast.error('删除失败');
      return false;
    }
  },
  
  pollSyncStatus: async () => {
      try {
          const res = await fetch('/api/sync/status');
          const { status, job } = await res.json();
          
          if (status === 'idle') {
              if (get().syncing) {
                  // If we were syncing and now idle, maybe it finished or was cancelled?
                  // We should check if we just finished
                  set({ syncing: false });
              }
              return;
          }
          
          // Update state from job
          if (job) {
              set({ 
                  syncJob: job,
                  syncProgress: job.progress,
                  syncHistory: job.history,
                  syncing: status === 'syncing',
                  selectedDevice: job.deviceId // Ensure UI shows the syncing device
              });
              
              if (status === 'completed' && !get().syncComplete) {
                  set({ syncComplete: true, syncing: false, scanResult: null });
                  toast.success('同步完成！');
                  // get().scanDevice(job.deviceId); // Refresh scan
              } else if (status === 'error' && get().syncing) {
                  set({ syncing: false });
                  toast.error('同步出错: ' + job.error);
              }
          }
      } catch (err) {
          console.error('Poll error', err);
      }
  },
  
  restoreSession: async () => {
      try {
          // Check if there's an active job on server directly
          // We don't use pollSyncStatus here to avoid side effects (like "Sync Complete" toast on reload)
          const res = await fetch('/api/sync/status');
          const { status, job } = await res.json();
          
          if (status === 'syncing' && job) {
              console.log('Restored active session for device:', job.deviceId);
              set({ 
                  syncJob: job,
                  syncProgress: job.progress,
                  syncHistory: job.history,
                  syncing: true,
                  selectedDevice: job.deviceId,
                  // Reconstruct scan result to show progress context
                  scanResult: {
                      missingFiles: job.files,
                      sourcePath: '...', // We don't have this in job, but can fetch device config
                      targetPath: '...',
                      totalMissingSize: 0 
                  }
              });
              
              // If we don't have device config loaded yet, fetch it
              if (get().devices.length === 0) {
                  await get().fetchDevices(true);
              }
          }
      } catch (err) {
          console.error('Failed to restore session:', err);
      }
  },
  
  resetSyncState: () => {
      set({ 
          syncing: false, 
          syncComplete: false, 
          syncProgress: null, 
          syncHistory: [] 
      });
  }
}));