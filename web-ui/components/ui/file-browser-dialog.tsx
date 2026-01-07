'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Folder, File, ArrowUp, Loader2, Home, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface FileSystemItem {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface FileBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
  initialPath?: string;
  title?: string;
}

export function FileBrowserDialog({ 
  open, 
  onOpenChange, 
  onSelect, 
  initialPath = '', 
  title = '选择文件夹' 
}: FileBrowserDialogProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [items, setItems] = useState<FileSystemItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FileSystemItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadPath(initialPath);
    }
  }, [open, initialPath]);

  const loadPath = async (path: string) => {
    setLoading(true);
    setError(null);
    setSelectedItem(null);
    
    try {
      const params = new URLSearchParams();
      if (path) params.set('path', path);
      
      const res = await fetch(`/api/fs/list?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load directory');
      }

      setItems(data.items);
      setCurrentPath(data.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (item: FileSystemItem) => {
    if (item.isDirectory) {
      loadPath(item.path);
    }
  };

  const handleUp = () => {
    // Simple parent calculation, the API also returns 'parent' but we can just pop the last segment
    // But relying on API returned path is safer for cross-platform
    // For now, let's just ask the API for the parent of current path
    // Actually, the API returns `parent` field, let's use it if we stored it.
    // Since we didn't store the full response, let's just use string manipulation or fetch '..'
    // Re-fetching current path's parent:
    if (currentPath === '/') return;
    // We can just go to '..' relative to current path? No, path param needs absolute.
    // Let's use the `join(currentPath, '..')` equivalent on client or just let server handle it?
    // Let's try to parse path.
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadPath(parent);
  };

  const handleConfirm = () => {
    if (selectedItem && selectedItem.isDirectory) {
      onSelect(selectedItem.path);
    } else {
      onSelect(currentPath);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 my-2">
          <Button variant="outline" size="icon" onClick={handleUp} disabled={currentPath === '/' || loading}>
            <ArrowUp size={16} />
          </Button>
          <Input 
            value={currentPath} 
            readOnly 
            className="flex-1 font-mono text-sm bg-muted" 
          />
          <Button variant="ghost" size="icon" onClick={() => loadPath('')} title="Home">
            <Home size={16} />
          </Button>
        </div>

        <div className="flex-1 min-h-0 border rounded-md relative">
          {loading && (
             <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
               <Loader2 className="animate-spin" />
             </div>
          )}
          
          <ScrollArea className="h-[400px]">
            <div className="p-1 space-y-1">
              {error && (
                <div className="p-4 text-center text-destructive text-sm">
                  {error}
                </div>
              )}
              
              {!loading && !error && items.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  空文件夹
                </div>
              )}

              {items.map((item) => (
                <div
                  key={item.path}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-sm cursor-pointer text-sm select-none",
                    selectedItem?.path === item.path 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                  onClick={() => setSelectedItem(item)}
                  onDoubleClick={() => handleNavigate(item)}
                >
                  {item.isDirectory ? (
                    <Folder size={16} className={selectedItem?.path === item.path ? "text-primary-foreground" : "text-blue-500"} />
                  ) : (
                    <File size={16} className="text-muted-foreground" />
                  )}
                  <span className="truncate flex-1">{item.name}</span>
                  {selectedItem?.path === item.path && item.isDirectory && (
                     <ChevronRight size={14} className="opacity-50" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
           <div className="text-xs text-muted-foreground truncate max-w-[300px]">
              {selectedItem ? selectedItem.path : currentPath}
           </div>
           <div className="flex gap-2">
             <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
             <Button onClick={handleConfirm}>
               选择
               {selectedItem ? ` "${selectedItem.name}"` : ' 当前目录'}
             </Button>
           </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
