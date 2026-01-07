import { NextResponse } from 'next/server';
import { getDevices } from '@/lib/db';
import { collectFiles } from '@/lib/file-utils';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';

export async function POST(req: Request) {
  try {
    const { device } = await req.json();
    const devices = await getDevices();
    const config = devices[device];

    if (!config) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const { sourcePath, targetPath, ignoreExtensions } = config;

    if (!existsSync(sourcePath)) {
      return NextResponse.json({ error: `Source path does not exist: ${sourcePath}` }, { status: 400 });
    }

    if (!existsSync(targetPath)) {
      await mkdir(targetPath, { recursive: true });
    }

    const sourceFiles = await collectFiles(sourcePath, ignoreExtensions);
    const targetFiles = await collectFiles(targetPath, ignoreExtensions);

    const missingFiles: string[] = [];
    for (const [relPath] of sourceFiles) {
      if (!targetFiles.has(relPath)) {
        missingFiles.push(relPath);
      }
    }

    return NextResponse.json({ 
      missingFiles, 
      sourcePath, 
      targetPath,
      totalMissingSize: missingFiles.reduce((acc, file) => acc + (sourceFiles.get(file)?.size || 0), 0)
    });

  } catch (error) {
    console.error('Scan error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
