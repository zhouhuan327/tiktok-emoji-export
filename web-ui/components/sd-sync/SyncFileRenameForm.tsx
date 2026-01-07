import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SyncFileRenameFormProps {
  file: { name: string; path: string };
  deviceId: string;
  onSuccess: () => void;
}

export function SyncFileRenameForm({ file, deviceId, onSuccess }: SyncFileRenameFormProps) {
  const [renameSuffix, setRenameSuffix] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !renameSuffix.trim() || !deviceId) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
    const newName = `${nameWithoutExt}_${renameSuffix.trim()}.${ext}`;

    setIsRenaming(true);
    try {
        const res = await fetch('/api/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                oldPath: file.path,
                newName: newName,
                originalName: file.name,
                deviceId: deviceId
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Rename failed');

        toast.success(`重命名已保存，同步时将自动重命名为: ${newName}`);
        onSuccess();
        setRenameSuffix('');
        
    } catch (err) {
        toast.error('重命名失败: ' + (err as Error).message);
    } finally {
        setIsRenaming(false);
    }
  }

  return (
    <form onSubmit={handleRename} className="flex gap-3 items-center">
       <div className="text-sm text-zinc-400 whitespace-nowrap">追加后缀:</div>
       <div className="flex-1 flex items-center bg-zinc-950 rounded-md px-3 py-2 border border-zinc-800 focus-within:border-blue-500 transition-colors">
           <span className="text-zinc-500 text-sm select-none">{file.name.substring(0, file.name.lastIndexOf('.'))}_</span>
           <input 
              type="text" 
              value={renameSuffix}
              onChange={e => setRenameSuffix(e.target.value)}
              placeholder="输入内容"
              className="bg-transparent border-none outline-none text-white text-sm flex-1 min-w-0 placeholder-zinc-700"
              autoFocus
           />
           <span className="text-zinc-500 text-sm select-none">.{file.name.split('.').pop()}</span>
       </div>
       <Button 
          type="submit" 
          disabled={!renameSuffix.trim() || isRenaming}
          className="bg-blue-600 hover:bg-blue-700 text-white"
       >
          {isRenaming ? '保存中...' : '保存'}
       </Button>
    </form>
  );
}
