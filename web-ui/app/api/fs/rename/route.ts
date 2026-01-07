import { NextRequest, NextResponse } from 'next/server';
import { rename, stat, utimes } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

export async function POST(req: NextRequest) {
  try {
    const { oldPath, newName } = await req.json();

    if (!oldPath || !newName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!existsSync(oldPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stats = await stat(oldPath);
    const dir = dirname(oldPath);
    const newPath = join(dir, newName);

    if (existsSync(newPath)) {
      return NextResponse.json({ error: 'Target file already exists' }, { status: 409 });
    }

    // Rename the file
    await rename(oldPath, newPath);

    // Explicitly restore mtime (and atime) to ensure it doesn't change
    // Although fs.rename usually preserves mtime, this is a safety measure requested by user
    await utimes(newPath, stats.atime, stats.mtime);

    return NextResponse.json({ 
        success: true, 
        oldPath,
        newPath,
        newName,
        mtime: stats.mtime
    });

  } catch (error) {
    console.error('Rename error:', error);
    return NextResponse.json({ error: 'Failed to rename file' }, { status: 500 });
  }
}
