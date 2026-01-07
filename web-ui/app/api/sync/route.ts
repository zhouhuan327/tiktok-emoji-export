import { NextRequest, NextResponse } from 'next/server';
import { getDevices, getRenameCache } from '@/lib/db';
import { syncManager } from '@/lib/sync-manager';

export async function POST(req: NextRequest) {
  try {
    const { device, files } = await req.json();
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'No files specified' }, { status: 400 });
    }

    const devices = await getDevices();
    const config = devices[device];
    if (!config) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // Get rename cache
    const renameCache = await getRenameCache();
    // Filter cache for current device
    const deviceRenameMap: Record<string, string> = {};
    const prefix = `${device}:`;
    
    for (const [key, value] of Object.entries(renameCache)) {
        if (key.startsWith(prefix)) {
            const originalName = key.substring(prefix.length);
            deviceRenameMap[originalName] = value;
        }
    }

    // Start sync job in background
    try {
        const jobId = syncManager.startSync(device, config, files, deviceRenameMap);
        return NextResponse.json({ success: true, jobId });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 409 });
    }
    
  } catch (error) {
    console.error('Sync start error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
