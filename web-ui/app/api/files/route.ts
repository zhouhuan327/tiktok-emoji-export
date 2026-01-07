import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { existsSync } from 'fs';

const SUPPORTED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', // Images
  '.mp4', '.mov', '.webm', // Videos
  '.raw', '.arw' // RAW
];

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const dirPath = searchParams.get('path');

  if (!dirPath) {
    return NextResponse.json({ error: 'Path is required' }, { status: 400 });
  }

  try {
    if (!existsSync(dirPath)) {
      return NextResponse.json({ error: 'Directory not found' }, { status: 404 });
    }

    const stats = await stat(dirPath);
    if (!stats.isDirectory()) {
      return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 });
    }

    const entries = await readdir(dirPath, { withFileTypes: true });
    
    const files = await Promise.all(
      entries
        .filter(entry => {
          if (entry.isDirectory()) return false; // Currently only listing files, maybe support traversing later
          if (entry.name.startsWith('._')) return false; // Ignore macOS metadata files
          const ext = extname(entry.name).toLowerCase();
          return SUPPORTED_EXTENSIONS.includes(ext);
        })
        .map(async (entry) => {
          const fullPath = join(dirPath, entry.name);
          const fileStats = await stat(fullPath);
          return {
            name: entry.name,
            path: fullPath,
            size: fileStats.size,
            mtime: fileStats.mtime,
            isDirectory: false
          };
        })
    );

    // Sort by mtime desc
    files.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());

    return NextResponse.json({ files });

  } catch (error) {
    console.error('List files error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
