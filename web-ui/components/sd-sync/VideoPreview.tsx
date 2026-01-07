import { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface PreviewFile {
  name: string;
  path: string;
}

interface VideoPreviewProps {
  file: PreviewFile | null;
  onClose: () => void;
  onRename?: (newFile: PreviewFile) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  footer?: React.ReactNode;
}

export function VideoPreview({ file, onClose, footer, onRename, onPrevious, onNext }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    if (file) {
      setEditingName(file.name);
    }
  }, [file]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      
      if (isInput) return;

      if (e.code === 'Space') {
        if (videoRef.current) {
          e.preventDefault();
          if (videoRef.current.paused) {
            videoRef.current.play();
          } else {
            videoRef.current.pause();
          }
        }
      } else if (e.code === 'ArrowLeft') {
        if (onPrevious) {
          e.preventDefault();
          onPrevious();
        }
      } else if (e.code === 'ArrowRight') {
        if (onNext) {
          e.preventDefault();
          onNext();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrevious, onNext]);

  const handleStartRename = () => {
    if (file) {
      // Extract name without extension
      const lastDotIndex = file.name.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        setEditingName(file.name.substring(0, lastDotIndex));
      } else {
        setEditingName(file.name);
      }
      setIsEditing(true);
    }
  };

  const handleRename = async () => {
    if (!file || !editingName) {
      setIsEditing(false);
      return;
    }

    // Reconstruct full name with extension
    let newFullName = editingName;
    const lastDotIndex = file.name.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      const ext = file.name.substring(lastDotIndex);
      newFullName = editingName + ext;
    }

    if (newFullName === file.name) {
       setIsEditing(false);
       return;
    }

    try {
      const res = await fetch('/api/fs/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPath: file.path,
          newName: newFullName
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '重命名失败');
      }

      const data = await res.json();
      toast.success('重命名成功');
      setIsEditing(false);
      
      onRename?.({
        name: data.newName,
        path: data.newPath
      });
      
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '重命名失败');
      // Reset name on error (just the base name for UI consistency if we stayed in edit mode, 
      // but we are exiting edit mode so file.name will be used by the view mode)
    }
  };

  if (!file) return null;

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden bg-black border-zinc-800">
        <DialogTitle className="sr-only">{file.name}</DialogTitle>
         <div className="relative aspect-video flex items-center justify-center bg-black group">
            <video  
               key={file.path} // Add key to force reload video if path changes
               ref={videoRef}
               src={`/api/media?path=${encodeURIComponent(file.path)}`} 
               poster={`/api/media?path=${encodeURIComponent(file.path)}&width=1280`}
               controls 
               autoPlay
               className="w-full h-full object-contain focus:outline-none"
            />
             <Button 
               variant="ghost" 
               size="icon" 
               className="absolute top-4 right-4 text-white/70 hover:text-white hover:bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
               onClick={onClose}
             >
               <X size={24} />
             </Button>

             {/* Navigation Buttons */}
             {onPrevious && (
               <Button
                 variant="ghost"
                 size="icon"
                 className="absolute left-[20%] top-1/2 -translate-y-1/2 text-white/50 hover:text-white hover:bg-black/60 rounded-full w-20 h-20 opacity-0 group-hover:opacity-100 transition-all z-10"
                 onClick={(e) => {
                   e.stopPropagation();
                   onPrevious();
                 }}
               >
                 <ChevronLeft size={64} />
               </Button>
             )}
             
             {onNext && (
               <Button
                 variant="ghost"
                 size="icon"
                 className="absolute right-[20%] top-1/2 -translate-y-1/2 text-white/50 hover:text-white hover:bg-black/60 rounded-full w-20 h-20 opacity-0 group-hover:opacity-100 transition-all z-10"
                 onClick={(e) => {
                   e.stopPropagation();
                   onNext();
                 }}
               >
                 <ChevronRight size={64} />
               </Button>
             )}
         </div>
         
         <div className="p-4 bg-zinc-900/95 text-white border-t border-zinc-800 backdrop-blur-sm">
            {isEditing ? (
              <div className="flex items-center gap-1 mb-2">
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename();
                    if (e.key === 'Escape') {
                      setIsEditing(false);
                      // Reset not strictly needed as view mode uses file.name, but good for safety
                    }
                    e.stopPropagation();
                  }}
                  onBlur={() => {
                     // Cancel on blur
                     setIsEditing(false);
                  }}
                  autoFocus
                  className="h-8 bg-zinc-800 border-zinc-700 text-white focus-visible:ring-zinc-500"
                />
                <span className="text-zinc-400 text-sm font-mono shrink-0">
                  {file.name.includes('.') ? `.${file.name.split('.').pop()}` : ''}
                </span>
              </div>
            ) : (
              <h3 
                className="font-medium text-lg truncate mb-2 cursor-pointer hover:bg-white/10 rounded px-1 -mx-1 transition-colors" 
                title="点击重命名"
                onClick={handleStartRename}
              >
                  {file.name}
              </h3>
            )}
            {footer}
         </div>
      </DialogContent>
    </Dialog>
  );
}
