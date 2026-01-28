'use client';

import { useMemo, useState, useEffect, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, Play, Check } from 'lucide-react';
import { FileThumbnail } from '@/components/sd-sync/FileThumbnail';
import { cn } from '@/lib/utils';
import { MediaFile, MediaGroup } from '@/lib/media-utils';

interface MediaGridProps {
  groups: MediaGroup[];
  onPreview?: (file: MediaFile) => void;
  className?: string;
  emptyMessage?: React.ReactNode;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
}

const EMPTY_SET = new Set<string>();

export const MediaGrid = memo(({ 
  groups, 
  onPreview, 
  className, 
  emptyMessage,
  selectionMode = false,
  selectedIds = EMPTY_SET,
  onToggleSelection
}: MediaGridProps) => {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  // Handle Space key to open preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && hoveredGroup && !e.repeat && onPreview) {
         const activeElement = document.activeElement;
         const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
         
         if (!isInput) {
             // If a dialog is already open, don't trigger preview
             if (document.querySelector('[role="dialog"]') || document.querySelector('.PhotoView-Slider')) {
                 return;
             }
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

  if (!groups || groups.length === 0) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            {emptyMessage || <p>暂无文件</p>}
        </div>
      );
  }

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4", className)}>
        {groups.map((group) => {
          const isSelected = selectedIds.has(group.id);
          
          return (
            <div 
                key={group.id} 
                className={cn(
                  "aspect-square cursor-pointer hover:ring-2 rounded-md overflow-hidden bg-card border relative group",
                  isSelected ? "ring-2 ring-primary border-primary" : "ring-primary"
                )}
                onClick={() => {
                  if (selectionMode && onToggleSelection) {
                    onToggleSelection(group.id);
                  } else {
                    onPreview?.(group.displayFile);
                  }
                }}
                onMouseEnter={() => setHoveredGroup(group.id)}
            >
                <FileThumbnail path={group.displayFile.path} name={group.displayFile.name} />
                
                {/* Selection Indicator */}
                {selectionMode && (
                  <div className={cn(
                    "absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center z-20 transition-all",
                    isSelected 
                      ? "bg-primary border-primary text-primary-foreground shadow-sm" 
                      : "bg-black/20 border-white/50 text-transparent hover:border-white"
                  )}>
                    <Check size={14} strokeWidth={3} />
                  </div>
                )}
                
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
          );
        })}
    </div>
  );
});
