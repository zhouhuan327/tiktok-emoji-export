'use client';

import { useState, useEffect, useCallback } from 'react';
import { SyncFileList } from './SyncFileList';
import { FilePreviewDialog } from './FilePreviewDialog';
import { SyncFileRenameForm } from './SyncFileRenameForm';
import { 
  HardDrive, 
  RefreshCw, 
  CheckCircle, 
  Play,
  Loader2,
  Settings,
  Trash2,
  Plus,
  Edit2
} from 'lucide-react';
import { DeviceConfig } from '@/lib/db';
import { toast } from 'sonner';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function SdSyncPage() {
  // Global State
  const { 
    devices, selectedDevice, loadingDevices,
    scanning, scanResult,
    syncing, syncComplete, syncProgress, syncHistory,
    fetchDevices, setSelectedDevice, scanDevice,
    startSync, stopSync,
    saveDevice, deleteDevice
  } = useStore();

  // Local UI State
  const [editingDevice, setEditingDevice] = useState<Partial<DeviceConfig & { name: string, originalName?: string }> | null>(null);
  const [isEditing, setIsEditing] = useState(false); 
  const [previewFile, setPreviewFile] = useState<{name: string, path: string} | null>(null);

  // Polling devices status
  useEffect(() => {
    // Initial fetch
    fetchDevices();

    // Poll every 5 seconds to check device connectivity
    const interval = setInterval(() => {
        fetchDevices(true); // background=true to avoid loading spinner
    }, 5000);

    return () => clearInterval(interval);
  }, []); // Remove fetchDevices from deps to avoid re-subscription loop, as it's a stable store action

  // Computed
  const currentDevice = devices.find(d => d.name === selectedDevice);
  const totalFiles = scanResult?.missingFiles.length || 0;
  const completedFiles = syncHistory.length;
  const overallProgress = totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0;

  async function handleSaveDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDevice || !editingDevice.name) return;

    const success = await saveDevice(editingDevice, isEditing);
    if (success) {
      setEditingDevice(null);
      setIsEditing(false);
    }
  }

  async function handleDeleteDevice(name: string) {
    if (!confirm(`确定要删除配置 "${name}" 吗？`)) return;
    await deleteDevice(name);
  }

  const handlePreview = useCallback((file: { name: string; path: string }) => {
    setPreviewFile(prev => {
      if (prev) return prev;
      return file;
    });
  }, []);

  return (
    <div className="flex h-full gap-6">
      {/* Sidebar - Device List */}
      <Card className="w-80 flex flex-col h-full border-0 shadow-none bg-transparent">
        <div className="flex items-center justify-between mb-4 px-1">
           <h2 className="text-lg font-semibold tracking-tight">设备列表</h2>
           <div className="flex items-center gap-1">
             <Button variant="ghost" size="icon" onClick={() => fetchDevices()} title="刷新设备">
               <RefreshCw size={16} />
             </Button>
             <Button 
               variant="ghost" 
               size="icon"
               onClick={() => {
                 setEditingDevice({ name: '', sourcePath: '', targetPath: '', ignoreExtensions: [] });
                 setIsEditing(true);
               }}
               title="添加设备"
             >
               <Plus size={16} />
             </Button>
           </div>
        </div>
        
        <ScrollArea className="flex-1 -mx-1 px-1">
           <div className="space-y-2">
             {devices.map(device => (
               <div 
                 key={device.name}
                 onClick={() => setSelectedDevice(device.name)}
                 className={cn(
                   "group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border",
                   selectedDevice === device.name 
                     ? "bg-primary/5 border-primary/20 shadow-sm" 
                     : "bg-card border-transparent hover:bg-accent/50 hover:border-border"
                 )}
               >
                 <div className="flex items-center gap-3 min-w-0">
                   <div className={cn(
                     "w-2 h-2 rounded-full flex-shrink-0 transition-shadow", 
                     device.isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-destructive/50"
                   )} />
                   <div className="min-w-0">
                     <div className={cn("font-medium truncate text-sm", selectedDevice === device.name ? "text-primary" : "text-foreground")}>
                        {device.name}
                     </div>
                     <div className="text-[10px] text-muted-foreground truncate font-mono">{device.sourcePath}</div>
                   </div>
                 </div>
                 
                 <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity", selectedDevice === device.name && "opacity-100")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingDevice({ ...device, originalName: device.name } as any);
                      setIsEditing(true);
                    }}
                  >
                    <Edit2 size={12} />
                  </Button>
               </div>
             ))}
             
             {devices.length === 0 && !loadingDevices && (
               <div className="text-center py-12 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                 点击右上角 "+" 添加设备
               </div>
             )}
           </div>
        </ScrollArea>
      </Card>

      {/* Main Content */}
      <Card className="flex-1 flex flex-col h-full border-0 shadow-none bg-transparent">
        {selectedDevice ? (
          <>
             {/* Header */}
             <div className="flex items-center justify-between mb-6 px-1">
               <div>
                 <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                   {selectedDevice}
                   {currentDevice?.isConnected ? (
                     <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Online</Badge>
                   ) : (
                     <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Offline</Badge>
                   )}
                 </h2>
                 <p className="text-sm text-muted-foreground font-mono mt-1">
                   {currentDevice?.sourcePath}
                 </p>
               </div>
               
               <div className="flex items-center gap-3">
                 <Button 
                   variant="ghost" 
                   size="icon"
                   onClick={() => handleDeleteDevice(selectedDevice)}
                   className="text-destructive hover:text-destructive hover:bg-destructive/10"
                   title="删除此配置"
                 >
                   <Trash2 size={18} />
                 </Button>
                 
                 <Separator orientation="vertical" className="h-6" />
                 
                 {syncing ? (
                   <Button 
                     variant="destructive"
                     onClick={stopSync}
                     className="gap-2"
                   >
                     <Loader2 className="animate-spin" size={16} />
                     停止同步
                   </Button>
                 ) : (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={() => scanDevice()}
                        disabled={scanning || !currentDevice?.isConnected}
                        className="gap-2"
                      >
                        <RefreshCw size={16} className={cn(scanning && "animate-spin")} />
                        扫描文件
                      </Button>
                      
                      {scanResult && scanResult.missingFiles.length > 0 && (
                        <Button 
                          onClick={startSync}
                          disabled={!currentDevice?.isConnected}
                          className="gap-2 shadow-lg shadow-primary/20"
                        >
                          <Play size={16} fill="currentColor" />
                          开始同步 ({scanResult.missingFiles.length})
                        </Button>
                      )}
                    </div>
                 )}
               </div>
             </div>

             <Separator className="mb-6" />

             {/* Content Area */}
             <ScrollArea className="flex-1 -mr-4 pr-4">
                {/* Sync Progress Card */}
                {(syncing || syncComplete) && (
                   <Card className="mb-6 animate-in slide-in-from-top-4 duration-300 border-primary/20 bg-primary/5">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            {syncComplete ? (
                              <div className="bg-green-100 p-2 rounded-full text-green-600">
                                <CheckCircle size={24} />
                              </div>
                            ) : (
                              <div className="bg-primary/10 p-2 rounded-full text-primary">
                                <Loader2 className="animate-spin" size={24} />
                              </div>
                            )}
                            <div>
                              <h3 className="font-bold">
                                {syncComplete ? '同步完成' : '正在同步...'}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {syncComplete 
                                  ? `成功同步 ${syncHistory.length} 个文件` 
                                  : `正在处理: ${syncProgress?.file || '准备中...'}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                             <div className="text-2xl font-bold tabular-nums">
                               {Math.round(overallProgress)}%
                             </div>
                             <div className="text-xs text-muted-foreground font-medium">
                               {completedFiles} / {totalFiles} Files
                             </div>
                          </div>
                        </div>
                        
                        {/* Overall Progress */}
                        <Progress value={overallProgress} className="h-2.5 mb-2" />

                        {/* Current File Progress */}
                        {syncing && syncProgress && !syncComplete && (
                           <div className="mt-4 text-xs space-y-1.5">
                              <div className="flex justify-between text-muted-foreground">
                                 <span className="truncate max-w-[300px] font-mono">{syncProgress.file}</span>
                                 <span>{syncProgress.percentage}%</span>
                              </div>
                              <Progress value={syncProgress.percentage} className="h-1.5 bg-background" />
                           </div>
                        )}
                      </CardContent>
                   </Card>
                )}

                {/* Scan Results */}
                {scanResult ? (
                   <SyncFileList 
                     files={scanResult.missingFiles}
                     sourcePath={scanResult.sourcePath}
                     totalSize={scanResult.totalMissingSize}
                     onPreview={handlePreview}
                   />
                ) : (
                   !syncing && !syncComplete && (
                     <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/30">
                        <HardDrive size={48} className="mb-4 opacity-50" />
                        <p className="font-medium">点击"扫描文件"开始检测</p>
                        <p className="text-sm opacity-70 mt-1">将自动检测源设备中的新文件</p>
                     </div>
                   )
                )}

                {/* Scanning Loader */}
                {scanning && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                       <Card className="p-8 flex flex-col items-center shadow-xl">
                          <Loader2 size={40} className="animate-spin text-primary mb-4" />
                          <p className="font-medium">正在扫描设备...</p>
                          <p className="text-sm text-muted-foreground mt-2">请稍候</p>
                       </Card>
                    </div>
                )}
             </ScrollArea>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
             <div className="bg-muted/50 p-8 rounded-full mb-6">
               <Settings size={64} className="opacity-50" />
             </div>
             <h2 className="text-xl font-bold text-foreground">未选择设备</h2>
             <p className="mt-2">请从左侧列表选择一个设备配置，或创建新配置</p>
          </div>
        )}
      </Card>

      {/* Edit/Create Modal */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDevice?.name ? '编辑配置' : '新建配置'}</DialogTitle>
            <DialogDescription>
              配置相机SD卡与本地存储的映射关系
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">设备名称</Label>
              <Input
                id="name"
                value={editingDevice?.name || ''}
                onChange={e => setEditingDevice(prev => ({ ...(prev || {}), name: e.target.value } as any))}
                placeholder="例如: Sony A7M4"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="source">源目录 (Source Path)</Label>
              <Input
                id="source"
                value={editingDevice?.sourcePath || ''}
                onChange={e => setEditingDevice(prev => ({ ...(prev || {}), sourcePath: e.target.value } as any))}
                placeholder="/Volumes/Untitled"
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">SD卡在电脑上的挂载路径</p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="target">目标目录 (Target Path)</Label>
              <Input
                id="target"
                value={editingDevice?.targetPath || ''}
                onChange={e => setEditingDevice(prev => ({ ...(prev || {}), targetPath: e.target.value } as any))}
                placeholder="/Users/name/Movies/Camera"
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">文件将被同步到此文件夹</p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="ignore">忽略扩展名 (逗号分隔)</Label>
              <Input
                id="ignore"
                value={Array.isArray(editingDevice?.ignoreExtensions) ? editingDevice?.ignoreExtensions.join(', ') : editingDevice?.ignoreExtensions || ''}
                onChange={e => setEditingDevice(prev => ({ ...(prev || {}), ignoreExtensions: e.target.value } as any))}
                placeholder="XML, BIM, THM"
                className="font-mono text-xs"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>取消</Button>
            <Button onClick={handleSaveDevice}>保存配置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <FilePreviewDialog 
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
