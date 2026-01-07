import { useEffect } from 'react';
import { PhotoSlider } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface PreviewFile {
  name: string;
  path: string;
}

interface ImagePreviewProps {
  file: PreviewFile | null;
  onClose: () => void;
  footer?: React.ReactNode;
}

export function ImagePreview({ file, onClose, footer }: ImagePreviewProps) {
  // Handle Space key to close
  useEffect(() => {
    if (!file) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        // Don't close if user is typing in an input
        const activeElement = document.activeElement;
        const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
        
        if (!isInput) {
          e.preventDefault();
          onClose();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [file, onClose]);

  if (!file) return null;

  return (
    <PhotoSlider
      images={[{ src: `/api/media?path=${encodeURIComponent(file.path)}`, key: file.path }]}
      visible={!!file}
      onClose={onClose}
      index={0}
      speed={() => 0} // Disable animation for instant open/close
      onIndexChange={() => {}}
      overlayRender={() => (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-zinc-900/90 text-white border-t border-zinc-800 backdrop-blur-sm z-50">
           <h3 className="font-medium text-lg truncate mb-4 text-center" title={file.name}>
               {file.name}
           </h3>
           <div className="max-w-2xl mx-auto pointer-events-auto">
             {footer}
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
