import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, statSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { Readable } from 'stream';
import sharp from 'sharp';
import { exiftool } from 'exiftool-vendored';
import ffmpeg from 'fluent-ffmpeg';
import crypto from 'crypto';

const CACHE_DIR = join(process.cwd(), '.cache', 'thumbnails');

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.raw': 'image/x-panasonic-raw',
  '.arw': 'image/x-sony-arw',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const path = searchParams.get('path');
  const widthParam = searchParams.get('width');
  const width = widthParam ? parseInt(widthParam, 10) : null;

  if (!path) {
    return NextResponse.json({ error: 'Path is required' }, { status: 400 });
  }

  try {
    // Basic security check: ensure it's an absolute path
    if (!path.startsWith('/')) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    if (!existsSync(path)) {
       return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Ignore macOS metadata files
    if (basename(path).startsWith('._')) {
        return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    const stats = statSync(path);
    if (!stats.isFile()) {
      return NextResponse.json({ error: 'Not a file' }, { status: 404 });
    }

    const ext = extname(path).toLowerCase();
    const isRaw = ext === '.raw' || ext === '.arw';
    const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
    const isVideo = ['.mp4', '.mov', '.webm'].includes(ext);

    // 1. Handle Thumbnail Generation (Resize) or RAW Processing
    // We enter this block if:
    // a) It is a RAW file (always needs processing)
    // b) It is a standard image AND a specific width is requested (needs resizing)
    // c) It is a Video file AND a specific width is requested (needs thumbnail)
    if (isRaw || (isImage && width) || (isVideo && width)) {
      try {
        // Generate Cache Key
        // Include width in key if present, otherwise 'full'
        const cacheKeyStr = `${path}-${stats.mtimeMs}-${width || 'full'}`;
        const cacheKey = crypto
          .createHash('md5')
          .update(cacheKeyStr)
          .digest('hex');
        const cachePath = join(CACHE_DIR, `${cacheKey}.jpg`);

        // Check Cache Hit
        if (existsSync(cachePath)) {
           const cachedBuffer = readFileSync(cachePath);
           return new NextResponse(cachedBuffer as unknown as BodyInit, {
            headers: {
              'Content-Type': 'image/jpeg',
              'Content-Length': cachedBuffer.length.toString(),
              'Cache-Control': 'public, max-age=31536000, immutable',
              'X-Cache': 'HIT'
            },
          });
        }

        // Cache Miss - Process Image
        console.log(`[MediaAPI] Processing ${isRaw ? 'RAW' : (isVideo ? 'Video' : 'Image')}: ${path} (Target Width: ${width || 'Full'})`);
        
        let imageBuffer: Buffer | null = null;

        if (isRaw) {
            // Try to extract embedded preview using exiftool
            imageBuffer = await exiftool.extractBinaryTagToBuffer('PreviewImage', path);
            
            if (!imageBuffer) {
               console.log(`[MediaAPI] PreviewImage not found, trying JpgFromRaw: ${path}`);
               imageBuffer = await exiftool.extractBinaryTagToBuffer('JpgFromRaw', path);
            }
    
            if (!imageBuffer) {
                console.error('[MediaAPI] Failed to extract preview from RAW file');
                return NextResponse.json({ error: 'No preview found in RAW file' }, { status: 404 });
            }
        } else if (isVideo) {
             // Extract frame from video
             const chunks: any[] = [];
             await new Promise((resolve, reject) => {
                 ffmpeg(path)
                 .seekInput(1.0) // Capture at 1s
                 .frames(1)
                 .outputFormat('image2')
                 .outputOptions(['-vcodec mjpeg', '-q:v 2']) // JPEG, high quality
                 .on('error', (err) => {
                     console.error('FFmpeg error:', err);
                     reject(err);
                 })
                 .pipe()
                 .on('data', (chunk) => chunks.push(chunk))
                 .on('end', resolve);
             });
             imageBuffer = Buffer.concat(chunks);
        } else {
            // Standard image - read directly
            imageBuffer = readFileSync(path);
        }

        // Process with Sharp
        if (!imageBuffer || imageBuffer.length === 0) {
             console.error(`[MediaAPI] Empty buffer for: ${path}`);
             return NextResponse.json({ error: 'Empty image buffer' }, { status: 500 });
        }

        let pipeline = sharp(imageBuffer).rotate(); // Auto-rotate
        
        if (width) {
            pipeline = pipeline.resize(width, null, { withoutEnlargement: true });
        }
        
        // Convert to JPEG
        const jpegBuffer = await pipeline
          .jpeg({ quality: 80 })
          .toBuffer();

        // Write to Cache
        writeFileSync(cachePath, jpegBuffer);
        console.log(`[MediaAPI] Cached thumbnail for: ${path}`);

        return new NextResponse(jpegBuffer as unknown as BodyInit, {
          headers: {
            'Content-Type': 'image/jpeg',
            'Content-Length': jpegBuffer.length.toString(),
            'Cache-Control': 'public, max-age=3600',
            'X-Cache': 'MISS'
          },
        });
      } catch (err) {
        console.error('Error converting file:', err);
        return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
      }
    }

    // 2. Fallback: Stream original file (Video or Full-size standard image)
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const fileSize = stats.size;

    const range = req.headers.get('range');

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      const stream = createReadStream(path, { start, end });
      
      // Convert fs.ReadStream to Web ReadableStream
      const readable = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk) => controller.enqueue(chunk));
          stream.on('end', () => controller.close());
          stream.on('error', (err) => controller.error(err));
        },
        cancel() {
          stream.destroy();
        },
      });

      return new NextResponse(readable, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600'
        },
      });
    }

    const stream = createReadStream(path);
    
    // Convert fs.ReadStream to Web ReadableStream
    const readable = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
      cancel() {
        stream.destroy();
      },
    });

    return new NextResponse(readable, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileSize.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600'
      },
    });
  } catch (error) {
    console.error('Error serving media:', error);
    return NextResponse.json({ error: 'File not found or unreadable' }, { status: 404 });
  }
}
