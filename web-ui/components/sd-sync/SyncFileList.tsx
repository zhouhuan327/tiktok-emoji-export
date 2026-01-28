import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatBytes } from '@/lib/utils';
import { FileThumbnail } from './FileThumbnail';
import { Layers } from 'lucide-react';

interface SyncFileListProps {
  files: string[];
  sourcePath: string;
  totalSize: number;
  onPreview: (file: { name: string; path: string }) => void;
}

interface FileGroup {
  id: string; // usually path without extension
  baseName: string; // just the filename without extension
  displayFile: string; // The file to show (JPG preferred)
  hasRaw: boolean;
  hasJpg: boolean;
  files: string[]; // All files in this group
}

export function SyncFileList({ files, sourcePath, totalSize, onPreview }: SyncFileListProps) {
  const [hoveredFile, setHoveredFile] = useState<{name: string, path: string} | null>(null);

  // Handle Space key to open preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if Space is pressed, we have a hovered file, and it's not a repeat event
      if (e.code === 'Space' && hoveredFile && !e.repeat) {
         // Check if focus is in an input
         const activeElement = document.activeElement;
         const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
         
         if (!isInput) {
             e.preventDefault();
             onPreview(hoveredFile);
         }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hoveredFile, onPreview]);

  const fileGroups = useMemo(() => {
    if (!files) return [];
    
    const groups: Record<string, FileGroup> = {};

    files.forEach(file => {
      const ext = file.split('.').pop()?.toLowerCase();
      // Group by the full path without extension to avoid collisions in different folders
      const id = file.substring(0, file.lastIndexOf('.'));
      const baseName = id.split('/').pop() || id;
      
      if (!ext) {
        // Files without extension, treat as separate
        groups[file] = {
            id: file,
            baseName: file,
            displayFile: file,
            hasRaw: false,
            hasJpg: false,
            files: [file]
        };
        return;
      }

      if (!groups[id]) {
        groups[id] = {
          id,
          baseName,
          displayFile: file,
          hasRaw: false,
          hasJpg: false,
          files: []
        };
      }
      
      groups[id].files.push(file);
      
      if (['arw', 'raw'].includes(ext)) {
          groups[id].hasRaw = true;
          // If we already have a display file and it's NOT jpg (e.g. it was initialized with this raw), 
          // we don't need to do anything. 
          // But if we initialized with a video or something else, we stick to it.
      } else if (['jpg', 'jpeg'].includes(ext)) {
          groups[id].hasJpg = true;
          groups[id].displayFile = file; // Always prefer JPG for display/preview
      }
    });

    // Convert map to array and sort by ID (path)
    return Object.values(groups).sort((a, b) => a.id.localeCompare(b.id));
  }, [files]);

  if (!files || files.length === 0) return null;

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
         <h3 className="text-lg font-bold flex items-center gap-2">
           待同步文件 
           <Badge variant="secondary" className="font-mono">
             {files.length}
           </Badge>
         </h3>
         <span className="text-sm text-muted-foreground font-mono">
           总大小: {formatBytes(totalSize)}
         </span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {fileGroups.map((group) => {
           const isMerged = group.hasRaw && group.hasJpg;
           // If merged, displayFile is guaranteed to be the JPG one due to logic above
           
           return (
              <Card 
                key={group.id} 
                className="overflow-hidden group hover:shadow-md transition-all cursor-pointer border-muted"
                onMouseEnter={() => setHoveredFile({ 
                    name: group.displayFile.split('/').pop()!, 
                    path: sourcePath + '/' + group.displayFile 
                })}
                onClick={() => onPreview({ 
                    name: group.displayFile.split('/').pop()!, 
                    path: sourcePath + '/' + group.displayFile 
                })}
              >
                 <div className="aspect-square relative bg-muted">
                   <FileThumbnail path={sourcePath + '/' + group.displayFile} name={group.displayFile} />
                   
                   {/* Merged Indicator */}
                   {isMerged && (
                       <div className="absolute top-2 right-2 z-10">
                           <Badge variant="secondary" className="h-5 px-1.5 gap-1 bg-white/90 text-black backdrop-blur-sm shadow-sm border-0">
                               <Layers size={10} />
                               <span className="text-[10px] font-bold">RAW+J</span>
                           </Badge>
                       </div>
                   )}
                   
                   {/* Overlay info */}
                   <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-xs truncate font-medium">{group.baseName}</p>
                      {isMerged && <p className="text-white/70 text-[10px] truncate">包含 RAW 和 JPG</p>}
                   </div>
                 </div>
              </Card>
           );
        })}
      </div>
    </div>
  );
}
