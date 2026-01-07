import { useRef, useState } from 'react';
import { Film, FileText, Play } from 'lucide-react';

interface FileThumbnailProps {
  path: string;
  name: string;
}

export function FileThumbnail({ path, name }: FileThumbnailProps) {
  const ext = name.split('.').pop()?.toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'raw', 'arw'].includes(ext || '');
  const isVideo = ['mp4', 'mov', 'webm'].includes(ext || '');
  const encodedPath = encodeURIComponent(path);
  const [isHovering, setIsHovering] = useState(false);

  if (isImage) {
    return (
      <div className="w-full h-full bg-muted/50 flex items-center justify-center overflow-hidden rounded-md border">
        <img 
          src={`/api/media?path=${encodedPath}&width=400`} 
          alt={name}
          loading="lazy"
          className="w-full h-full object-contain"
        />
      </div>
    );
  }
  
  if (isVideo) {
    return (
      <div 
        className="w-full h-full bg-black flex items-center justify-center relative group rounded-md border overflow-hidden"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
         {isHovering ? (
             <video 
               src={`/api/media?path=${encodedPath}`} 
               className="w-full h-full object-contain"
               autoPlay
               muted
               playsInline
               loop
             />
         ) : (
             <>
                 <img 
                    src={`/api/media?path=${encodedPath}&width=400`} 
                    alt={name}
                    loading="lazy"
                    className="w-full h-full object-contain opacity-90"
                 />
                 <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                    <div className="bg-black/50 p-2 rounded-full backdrop-blur-sm">
                        <Play className="text-white fill-white" size={16} />
                    </div>
                 </div>
             </>
         )}
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground rounded-md border">
      <FileText size={32} />
    </div>
  );
}
