'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FolderOpen, Loader2, Plus, Trash2, Bookmark as BookmarkIcon, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { FileThumbnail } from '@/components/sd-sync/FileThumbnail';
import { ImagePreview } from '@/components/sd-sync/ImagePreview';
import { VideoPreview } from '@/components/sd-sync/VideoPreview';
import { FileBrowserDialog } from '@/components/ui/file-browser-dialog';
import { MediaGrid } from '@/components/shared/MediaGrid';
import { groupMediaFiles } from '@/lib/media-utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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

  const handlePrevious = () => {
    if (hasPrevious) {
      setPreviewFile(groups[currentGroupIndex - 1].displayFile as FileInfo);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      setPreviewFile(groups[currentGroupIndex + 1].displayFile as FileInfo);
    }
  };

  return (
    <div className="flex h-full gap-6">
      {/* Sidebar - Bookmarks */}
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
        </Card>

        {/* File Grid */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-background/50 rounded-lg border p-4">
            <MediaGrid 
              files={files} 
              onPreview={(file) => setPreviewFile(file as FileInfo)} 
              emptyMessage={
                <div className="flex flex-col items-center justify-center opacity-50">
                   <FolderOpen size={48} className="mb-4" />
                   <p>选择左侧路径或在上方输入路径查看文件</p>
                </div>
              }
            />
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
            <div className="text-sm text-zinc-400">
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
          footer={
             previewFile && (
                <div className="text-center text-zinc-400 mt-2">
                  {new Date(previewFile.mtime).toLocaleString()} • {(previewFile.size / 1024 / 1024).toFixed(2)} MB
                </div>
             )
          }
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
    </div>
  );
}
