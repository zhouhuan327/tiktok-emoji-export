import { NextRequest, NextResponse } from 'next/server';
import { getBookmarks, addBookmark, deleteBookmark } from '@/lib/db';

export async function GET() {
  const bookmarks = await getBookmarks();
  return NextResponse.json(bookmarks);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, path } = body;

    if (!name || !path) {
      return NextResponse.json({ error: 'Name and path are required' }, { status: 400 });
    }

    const bookmarks = await addBookmark({ name, path });
    return NextResponse.json(bookmarks);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add bookmark' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const bookmarks = await deleteBookmark(name);
    return NextResponse.json(bookmarks);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete bookmark' }, { status: 500 });
  }
}
