import { NextRequest, NextResponse } from 'next/server';
import { syncFiles } from '@/lib/sync-utils';

export async function POST(req: NextRequest) {
  try {
    const { sourcePath, targetPath, files } = await req.json();

    if (!sourcePath || !targetPath || !files || !Array.isArray(files)) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (files.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    console.log(`Starting export: ${files.length} files from ${sourcePath} to ${targetPath}`);

    const results = [];
    const errors = [];

    // Use syncFiles generator to perform the copy
    const generator = syncFiles(sourcePath, targetPath, files);

    for await (const progress of generator) {
      if (progress.type === 'file-complete') {
        results.push(progress.file);
      } else if (progress.type === 'error') {
        errors.push({ file: progress.file, error: progress.error });
      }
    }

    return NextResponse.json({
      success: errors.length < files.length,
      count: results.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Export API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
