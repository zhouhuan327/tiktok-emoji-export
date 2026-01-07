import { NextRequest, NextResponse } from 'next/server';
import { getRenameCache, saveRenameCache } from '@/lib/db';
import { existsSync } from 'fs';

export async function POST(req: NextRequest) {
  try {
    const { oldPath, newName, originalName, deviceId } = await req.json();

    if (!oldPath || !newName || !originalName || !deviceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!existsSync(oldPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Instead of renaming the file physically, we just update the cache
    const cache = await getRenameCache();
    
    // Key format: deviceId:originalFilename
    const cacheKey = `${deviceId}:${originalName}`;
    cache[cacheKey] = newName;
    
    await saveRenameCache(cache);
    
    return NextResponse.json({ 
        success: true, 
        newPath: oldPath, // Path doesn't change
        newName 
    });

  } catch (error) {
    console.error('Rename error:', error);
    return NextResponse.json({ error: 'Failed to rename file' }, { status: 500 });
  }
}
