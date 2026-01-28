'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { FolderOpen, Loader2, Plus, Trash2, RefreshCw, Download, MousePointer2 } from 'lucide-react';
import { toast } from 'sonner';
import { ImagePreview } from '@/components/sd-sync/ImagePreview';
import { VideoPreview } from '@/components/sd-sync/VideoPreview';
import { FileBrowserDialog } from '@/components/ui/file-browser-dialog';
import { MediaGrid } from '@/components/shared/MediaGrid';
import { groupMediaFiles } from '@/lib/media-utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface FileInfo {
  name: string;
  path: string;
  size: number;
  mtime: string;
  isDirectory: boolean;
}

interface Bookmark {
  name: string;
  path: string;
}

export default function LocalPreviewPage() {
  // State
  const [path, setPath] = useState('');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  
  // Selection & Export State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [isExportBrowserOpen, setIsExportBrowserOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Bookmarks State
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [selectedBookmark, setSelectedBookmark] = useState<string | null>(null);
  const [isAddingBookmark, setIsAddingBookmark] = useState(false);
  const [newBookmark, setNewBookmark] = useState({ name: '', path: '' });

  // Fetch Bookmarks on Mount
  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    try {
      const res = await fetch('/api/bookmarks');
      const data = await res.json();
      setBookmarks(data);
    } catch (err) {
      console.error('Failed to fetch bookmarks', err);
    }
  };

  const loadFiles = async (dirPath: string) => {
    if (!dirPath) return;
    
    setLoading(true);
    setFiles([]); // Clear previous files
    
    try {
      const params = new URLSearchParams({ path: dirPath });
      const res = await fetch(`/api/files?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load files');
      }

      setFiles(data.files);
      setPath(dirPath); // Update input path
      if (data.files.length === 0) {
        toast.info('该目录下没有找到支持的媒体文件');
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '加载文件失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBookmark = (bookmark: Bookmark) => {
    setSelectedBookmark(bookmark.name);
    setPath(bookmark.path);
    loadFiles(bookmark.path);
  };

  const handleAddBookmark = async () => {
    if (!newBookmark.name || !newBookmark.path) {
      toast.error('请填写名称和路径');
      return;
    }

    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBookmark)
      });
      
      if (!res.ok) throw new Error('保存失败');
      
      await fetchBookmarks();
      toast.success('保存成功');
      setIsAddingBookmark(false);
      setNewBookmark({ name: '', path: '' });
      
      // Auto select new bookmark
      setSelectedBookmark(newBookmark.name);
      loadFiles(newBookmark.path);
      
    } catch (err) {
      toast.error('保存失败');
    }
  };

  const handleDeleteBookmark = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`确定要删除 "${name}" 吗？`)) return;

    try {
      const res = await fetch(`/api/bookmarks?name=${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) throw new Error('删除失败');
      
      await fetchBookmarks();
      toast.success('删除成功');
      
      if (selectedBookmark === name) {
        setSelectedBookmark(null);
        setFiles([]);
        setPath('');
      }
    } catch (err) {
      toast.error('删除失败');
    }
  };

  const isVideo = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    return ['mp4', 'mov', 'webm'].includes(ext || '');
  };

  const handleRename = (updatedFile: { name: string, path: string }) => {
    if (!previewFile) return;
    
    const newFileInfo = { ...previewFile, ...updatedFile };
    setPreviewFile(newFileInfo);
    setFiles(prev => prev.map(f => f.path === previewFile.path ? newFileInfo : f));
  };

  // Navigation Logic based on groups to handle JPG+RAW merging
  const groups = useMemo(() => groupMediaFiles(files), [files]);
  const currentGroupIndex = previewFile 
    ? groups.findIndex(g => g.files.some(f => f.path === previewFile.path)) 
    : -1;
  
  const hasPrevious = currentGroupIndex > 0;
  const hasNext = currentGroupIndex < groups.length - 1;

  const handleNext = useCallback(() => {
    if (hasNext) {
      setPreviewFile(groups[currentGroupIndex + 1].displayFile as FileInfo);
    }
  }, [hasNext, currentGroupIndex, groups]);

  const handlePrevious = useCallback(() => {
    if (hasPrevious) {
      setPreviewFile(groups[currentGroupIndex - 1].displayFile as FileInfo);
    }
  }, [hasPrevious, currentGroupIndex, groups]);

  const handlePreview = useCallback((file: any) => {
    setPreviewFile(prev => {
      if (prev) return prev;
      return file;
    });
  }, []);

  const handleToggleSelection = useCallback((id: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    setSelectedGroups(new Set(groups.map(g => g.id)));
  };

  const handleClearSelection = () => {
    setSelectedGroups(new Set());
  };

  const handleExport = async (targetPath: string) => {
    if (selectedGroups.size === 0) return;
    
    setExporting(true);
    const toastId = toast.loading('正在导出文件...');
    
    try {
      const groupsToExport = groups.filter(g => selectedGroups.has(g.id));
      const filesToExport = groupsToExport.flatMap(g => g.files.map(f => f.name));
      
      const res = await fetch('/api/fs/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePath: path,
          targetPath,
          files: filesToExport
        })
      });
      
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      toast.success(`成功导出 ${data.count} 个文件`, { id: toastId });
      setSelectionMode(false);
      setSelectedGroups(new Set());
    } catch (err) {
      console.error(err);
      toast.error('导出失败: ' + (err as Error).message, { id: toastId });
    } finally {
      setExporting(false);
      setIsExportBrowserOpen(false);
    }
  };

  const emptyMessage = useMemo(() => (
    <div className="flex flex-col items-center justify-center opacity-50">
       <FolderOpen size={48} className="mb-4" />
       <p>选择左侧路径或在上方输入路径查看文件</p>
    </div>
  ), []);

  const previewFooter = useMemo(() => {
    if (!previewFile) return null;
    return (
      <div className="text-center text-zinc-400 mt-2">
        {new Date(previewFile.mtime).toLocaleString()} • {(previewFile.size / 1024 / 1024).toFixed(2)} MB
      </div>
    );
  }, [previewFile?.path, previewFile?.mtime, previewFile?.size]); // Use primitive values for stability

  const memoizedMediaGrid = useMemo(() => {
    return (
      <MediaGrid 
        groups={groups} 
        onPreview={handlePreview} 
        selectionMode={selectionMode}
        selectedIds={selectedGroups}
        onToggleSelection={handleToggleSelection}
        emptyMessage={emptyMessage}
      />
    );
  }, [groups, handlePreview, selectionMode, selectedGroups, handleToggleSelection, emptyMessage]);

  const memoizedSidebar = useMemo(() => (
    <Card className="w-80 flex flex-col h-full border-0 shadow-none bg-transparent">
      <div className="flex items-center justify-between mb-4 px-1">
         <h2 className="text-lg font-semibold tracking-tight">常用路径</h2>
         <div className="flex items-center gap-1">
           <Button variant="ghost" size="icon" onClick={fetchBookmarks} title="刷新">
             <RefreshCw size={16} />
           </Button>
           <Button 
             variant="ghost" 
             size="icon"
             onClick={() => {
               setNewBookmark({ name: '', path: path || '' }); // Pre-fill path if available
               setIsAddingBookmark(true);
             }}
             title="添加路径"
           >
             <Plus size={16} />
           </Button>
         </div>
      </div>
      
      <ScrollArea className="flex-1 -mx-1 px-1">
         <div className="space-y-2">
           {bookmarks.map(bookmark => (
             <div 
               key={bookmark.name}
               onClick={() => handleSelectBookmark(bookmark)}
               className={cn(
                 "group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border",
                 selectedBookmark === bookmark.name 
                   ? "bg-primary/5 border-primary/20 shadow-sm" 
                   : "bg-card border-transparent hover:bg-accent/50 hover:border-border"
               )}
             >
               <div className="flex items-center gap-3 min-w-0">
                 <div className="bg-primary/10 p-2 rounded-md text-primary">
                   <FolderOpen size={16} />
                 </div>
                 <div className="min-w-0">
                   <div className={cn("font-medium truncate text-sm", selectedBookmark === bookmark.name ? "text-primary" : "text-foreground")}>
                      {bookmark.name}
                   </div>
                   <div className="text-[10px] text-muted-foreground truncate font-mono" title={bookmark.path}>
                      {bookmark.path}
                   </div>
                 </div>
               </div>
               
               <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={(e) => handleDeleteBookmark(bookmark.name, e)}
                >
                  <Trash2 size={14} />
                </Button>
             </div>
           ))}
           
           {bookmarks.length === 0 && (
             <div className="text-center py-12 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
               点击右上角 "+" 添加常用路径
             </div>
           )}
         </div>
      </ScrollArea>
    </Card>
  ), [bookmarks, selectedBookmark, path, fetchBookmarks, handleSelectBookmark, handleDeleteBookmark]);

  return (
    <div className="flex h-full gap-6 overflow-hidden px-1">
      {/* Sidebar - Bookmarks */}
      {memoizedSidebar}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full gap-4 overflow-hidden">
        {/* Top Bar with Input */}
        <Card className="p-4 flex gap-4 items-center shrink-0 border-0 shadow-none bg-transparent px-0">
            <div className="flex-1 flex gap-2">
            <Input 
                placeholder="输入绝对路径 (例如 /Users/username/Photos)" 
                value={path}
                onChange={(e) => setPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadFiles(path)}
                className="bg-card"
            />
            <Button variant="secondary" onClick={() => setIsBrowserOpen(true)} title="选择文件夹">
               <FolderOpen className="mr-2" size={16} />
               选择
            </Button>
            <Button onClick={() => loadFiles(path)} disabled={loading}>
                {loading ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw className="mr-2" />}
                加载
            </Button>
            </div>

            <div className="flex items-center gap-2 px-2 border-l pl-4">
              <Switch 
                id="selection-mode" 
                checked={selectionMode} 
                onCheckedChange={(checked) => {
                  setSelectionMode(checked);
                  if (!checked) setSelectedGroups(new Set());
                }} 
              />
              <Label htmlFor="selection-mode" className="cursor-pointer font-medium text-sm whitespace-nowrap">
                多选
              </Label>
            </div>
        </Card>

        {/* Floating Selection Toolbar */}
        {selectionMode && (
          <div className="flex items-center justify-between bg-accent/30 p-2 px-4 rounded-lg mb-2 animate-in fade-in slide-in-from-top-2 duration-200 border">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                已选中 <span className="text-primary">{selectedGroups.size}</span> 个项目
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={handleSelectAll} className="h-7 px-2 text-xs">
                  全选
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClearSelection} className="h-7 px-2 text-xs">
                  取消
                </Button>
              </div>
            </div>

            <Button 
              size="sm" 
              onClick={() => setIsExportBrowserOpen(true)} 
              disabled={selectedGroups.size === 0 || exporting}
              className="h-8 gap-2"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              导出到...
            </Button>
          </div>
        )}

        {/* File Grid */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-background/50 rounded-lg border p-4">
            {memoizedMediaGrid}
        </div>
      </div>

      {/* Add Bookmark Dialog */}
      <Dialog open={isAddingBookmark} onOpenChange={setIsAddingBookmark}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加常用路径</DialogTitle>
            <DialogDescription>
              保存常用文件夹路径以便快速访问
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                value={newBookmark.name}
                onChange={(e) => setNewBookmark({ ...newBookmark, name: e.target.value })}
                placeholder="例如：我的照片"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="path">路径</Label>
              <Input
                id="path"
                value={newBookmark.path}
                onChange={(e) => setNewBookmark({ ...newBookmark, path: e.target.value })}
                placeholder="/Users/username/Photos"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingBookmark(false)}>取消</Button>
            <Button onClick={handleAddBookmark}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Previews */}
      {previewFile && isVideo(previewFile.name) ? (
        <VideoPreview 
          file={previewFile} 
          onClose={() => setPreviewFile(null)} 
          onRename={handleRename}
          onPrevious={hasPrevious ? handlePrevious : undefined}
          onNext={hasNext ? handleNext : undefined}
          footer={
            <div className="text-sm text-zinc-400 text-center mt-2">
               {new Date(previewFile.mtime).toLocaleString()} • {(previewFile.size / 1024 / 1024).toFixed(2)} MB
            </div>
          }
        />
      ) : (
        <ImagePreview 
          file={previewFile} 
          onClose={() => setPreviewFile(null)}
          onPrevious={hasPrevious ? handlePrevious : undefined}
          onNext={hasNext ? handleNext : undefined}
          footer={previewFooter}
        />
      )}
      {/* File Browser Dialog */}
      <FileBrowserDialog 
        open={isBrowserOpen} 
        onOpenChange={setIsBrowserOpen}
        onSelect={(selectedPath) => {
          setPath(selectedPath);
          loadFiles(selectedPath);
        }}
        initialPath={path}
      />
      {/* Export Target Browser Dialog */}
      <FileBrowserDialog 
        open={isExportBrowserOpen} 
        onOpenChange={setIsExportBrowserOpen}
        onSelect={(selectedPath) => {
          handleExport(selectedPath);
        }}
        title="选择导出目标目录"
      />
    </div>
  );
}
