import { NextResponse } from 'next/server';
import { getDevices, addDevice, updateDevice, deleteDevice, DeviceConfig } from '@/lib/db';
import { existsSync } from 'fs';

export async function GET() {
  const devices = await getDevices();
  
  const devicesWithStatus = Object.entries(devices).map(([name, config]) => ({
    name,
    ...config,
    isConnected: existsSync(config.sourcePath)
  }));
  
  return NextResponse.json(devicesWithStatus);
}

export async function POST(req: Request) {
  try {
    const { action, name, oldName, config } = await req.json();
    
    if (action === 'create') {
      if (!name || !config) return NextResponse.json({ error: 'Missing name or config' }, { status: 400 });
      await addDevice(name, config);
    } else if (action === 'update') {
      if (!name || !config) return NextResponse.json({ error: 'Missing name or config' }, { status: 400 });
      await updateDevice(oldName || name, name, config);
    } else if (action === 'delete') {
      if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });
      await deleteDevice(name);
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in devices API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
