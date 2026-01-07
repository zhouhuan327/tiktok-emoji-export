import { readdir, stat } from 'fs/promises';
import { join, relative, extname } from 'path';

export interface FileInfo {
  size: number;
  mtime: Date;
}

export async function collectFiles(dir: string, ignoreExtensions: string[]): Promise<Map<string, FileInfo>> {
  const lowerIgnoreExtensions = ignoreExtensions.map(ext => ext.toLowerCase());
  const fileMap = new Map<string, FileInfo>();
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(dir, fullPath);
      if (entry.isDirectory()) {
        const subFiles = await collectFiles(fullPath, ignoreExtensions);
        subFiles.forEach((info, path) => fileMap.set(path, info));
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (!lowerIgnoreExtensions.includes(ext)) {
          const stats = await stat(fullPath);
          fileMap.set(relPath, { size: stats.size, mtime: stats.mtime });
        }
      }
    }
  } catch (err) {
    console.warn(`警告：无法访问目录 ${dir}，已跳过`, err);
  }
  return fileMap;
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}
