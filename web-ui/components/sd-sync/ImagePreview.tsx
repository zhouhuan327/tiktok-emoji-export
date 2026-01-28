import { useEffect, useState } from 'react';
import { PhotoSlider } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface PreviewFile {
  name: string;
  path: string;
}

interface ImagePreviewProps {
  file: PreviewFile | null;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  footer?: React.ReactNode;
}

export function ImagePreview({ file, onClose, onPrevious, onNext, footer }: ImagePreviewProps) {
  const [lastImages, setLastImages] = useState<any[]>([]);

  useEffect(() => {
    if (file) {
      setLastImages([{ src: `/api/media?path=${encodeURIComponent(file.path)}`, key: file.path }]);
    }
  }, [file]);

  // Handle Space key to close and Arrows for navigation
  useEffect(() => {
    if (!file) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      
      if (isInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        onClose();
      } else if (e.code === 'ArrowLeft' && onPrevious) {
        e.preventDefault();
        onPrevious();
      } else if (e.code === 'ArrowRight' && onNext) {
        e.preventDefault();
        onNext();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [file, onClose, onPrevious, onNext]);

  // if (!file) return null;

  return (
    <PhotoSlider
      images={lastImages}
      visible={!!file}
      onClose={onClose}
      index={0}
      speed={() => 0} // Disable animation for efficiency
      onIndexChange={() => {}}
      overlayRender={() => (
        <div className="absolute inset-0 pointer-events-none z-50 group">
          {/* Navigation Buttons */}
          {onPrevious && (
             <button
               className="absolute left-[10%] top-1/2 -translate-y-1/2 pointer-events-auto text-white/40 hover:text-white hover:bg-white/10 rounded-full w-48 h-48 transition-all flex items-center justify-center z-[60] focus:outline-none"
               onClick={(e) => {
                 e.stopPropagation();
                 onPrevious();
               }}
             >
               <ChevronLeft size={160} strokeWidth={1} />
             </button>
           )}
           {onNext && (
             <button
               className="absolute right-[10%] top-1/2 -translate-y-1/2 pointer-events-auto text-white/40 hover:text-white hover:bg-white/10 rounded-full w-48 h-48 transition-all flex items-center justify-center z-[60] focus:outline-none"
               onClick={(e) => {
                 e.stopPropagation();
                 onNext();
               }}
             >
               <ChevronRight size={160} strokeWidth={1} />
             </button>
           )}

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-zinc-900/90 text-white border-t border-zinc-800 backdrop-blur-sm">
             <h3 className="font-medium text-lg truncate mb-4 text-center" title={file?.name}>
                 {file?.name}
             </h3>
             <div className="max-w-2xl mx-auto pointer-events-auto">
               {footer}
             </div>
          </div>
        </div>
      )}
      toolbarRender={({ onRotate, onScale, scale }) => {
        return (
          <div className="flex gap-4 text-white opacity-75 hover:opacity-100 transition-opacity">
            {/* Custom Toolbar if needed, or rely on default */}
          </div>
        );
      }}
    />
  );
}
