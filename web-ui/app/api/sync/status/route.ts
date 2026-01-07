import { NextResponse } from 'next/server';
import { syncManager } from '@/lib/sync-manager';

export async function GET() {
  const status = syncManager.getStatus();
  return NextResponse.json(status);
}

export async function DELETE() {
    await syncManager.stopSync();
    return NextResponse.json({ success: true });
}