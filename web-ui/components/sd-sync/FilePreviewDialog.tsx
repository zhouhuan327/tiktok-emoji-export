import { VideoPreview } from './VideoPreview';
import { ImagePreview } from './ImagePreview';

interface PreviewFile {
  name: string;
  path: string;
}

interface FilePreviewDialogProps {
  file: PreviewFile | null;
  onClose: () => void;
  footer?: React.ReactNode;
}

export function FilePreviewDialog({ file, onClose, footer }: FilePreviewDialogProps) {
  if (!file) return null;

  const ext = file.name.split('.').pop()?.toLowerCase();
  const isVideo = ['mp4', 'mov', 'webm'].includes(ext || '');

  if (isVideo) {
    return <VideoPreview file={file} onClose={onClose} footer={footer} />;
  }

  return <ImagePreview file={file} onClose={onClose} footer={footer} />;
}
