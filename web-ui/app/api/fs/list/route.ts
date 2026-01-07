import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  let dirPath = searchParams.get('path');

  // Default to home directory if no path provided
  if (!dirPath) {
    dirPath = homedir();
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
    
    const items = await Promise.all(
      entries
        .filter(entry => !entry.name.startsWith('.')) // Hide hidden files by default
        .map(async (entry) => {
            const isDirectory = entry.isDirectory();
            return {
                name: entry.name,
                path: join(dirPath!, entry.name),
                isDirectory,
                // We don't strictly need size/mtime for the picker, but can add if needed.
                // Keeping it simple for speed.
            };
        })
    );

    // Sort: Directories first, then alphabetical
    items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ 
        path: dirPath,
        parent: dirPath === '/' ? null : join(dirPath, '..'),
        items 
    });

  } catch (error) {
    console.error('List fs error:', error);
    return NextResponse.json({ error: 'Failed to list directory', details: String(error) }, { status: 500 });
  }
}
