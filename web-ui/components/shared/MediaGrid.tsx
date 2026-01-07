'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, Play } from 'lucide-react';
import { FileThumbnail } from '@/components/sd-sync/FileThumbnail';
import { cn } from '@/lib/utils';
import { MediaFile, groupMediaFiles } from '@/lib/media-utils';

interface MediaGridProps {
  files: MediaFile[];
  onPreview?: (file: MediaFile) => void;
  className?: string;
  emptyMessage?: React.ReactNode;
}

export function MediaGrid({ files, onPreview, className, emptyMessage }: MediaGridProps) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  const groups = useMemo(() => groupMediaFiles(files), [files]);

  // Handle Space key to open preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && hoveredGroup && !e.repeat && onPreview) {
         const activeElement = document.activeElement;
         const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
         
         if (!isInput) {
             e.preventDefault();
             const group = groups.find(g => g.id === hoveredGroup);
             if (group) {
                 onPreview(group.displayFile);
             }
         }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hoveredGroup, onPreview, groups]);

  if (!files || files.length === 0) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            {emptyMessage || <p>暂无文件</p>}
        </div>
      );
  }

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4", className)}>
        {groups.map((group) => (
        <div 
            key={group.id} 
            className="aspect-square cursor-pointer hover:ring-2 ring-primary rounded-md overflow-hidden transition-all bg-card border relative group"
            onClick={() => onPreview?.(group.displayFile)}
            onMouseEnter={() => setHoveredGroup(group.id)}
            onMouseLeave={() => setHoveredGroup(null)}
        >
            <FileThumbnail path={group.displayFile.path} name={group.displayFile.name} />
            
            {/* Badges */}
            <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                {group.isMerged && (
                    <Badge variant="secondary" className="h-5 px-1.5 gap-1 bg-white/90 text-black backdrop-blur-sm shadow-sm border-0">
                        <Layers size={10} />
                        <span className="text-[10px] font-bold">RAW+J</span>
                    </Badge>
                )}
                {group.hasVideo && (
                    <Badge variant="secondary" className="h-5 px-1.5 gap-1 bg-white/90 text-black backdrop-blur-sm shadow-sm border-0">
                        <Play size={10} />
                        <span className="text-[10px] font-bold">VIDEO</span>
                    </Badge>
                )}
            </div>

            {/* Overlay Info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs truncate font-medium">{group.baseName}</p>
                <div className="flex justify-between items-center mt-0.5">
                    {group.displayFile.mtime && (
                        <span className="text-white/60 text-[10px]">
                            {new Date(group.displayFile.mtime).toLocaleDateString()}
                        </span>
                    )}
                    {group.displayFile.size && (
                        <span className="text-white/60 text-[10px]">
                            {(group.displayFile.size / 1024 / 1024).toFixed(1)}MB
                        </span>
                    )}
                </div>
            </div>
        </div>
        ))}
    </div>
  );
}
