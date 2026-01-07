import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'devices.json');

export interface DeviceConfig {
  sourcePath: string;
  targetPath: string;
  ignoreExtensions: string[];
}

export interface Device extends DeviceConfig {
  name: string;
}

const INITIAL_CONFIG: Record<string, DeviceConfig> = {
  'action6-SD': {
    sourcePath: '/Volumes/action6/DCIM/DJI_001',
    targetPath: '/Volumes/T7/运动相机',
    ignoreExtensions: ['.LRF']
  },
  'action6': {
    sourcePath: '/Volumes/OsmoAction/DCIM/DJI_001',
    targetPath: '/Volumes/T7/运动相机',
    ignoreExtensions: ['.LRF']
  },
  'Pocket 3': {
    sourcePath: '/Volumes/SD_Card/DCIM/DJI_001',
    targetPath: '/Volumes/T7/pocket3录制',
    ignoreExtensions: ['.LRF']
  },
  'Go Ultra': {
    sourcePath: '/Volumes/goultra/DCIM/Camera01',
    targetPath: '/Volumes/T7/运动相机',
    ignoreExtensions: ['.lrv']
  },
  '相机视频': {
    sourcePath: '/Volumes/zve1/PRIVATE/M4ROOT/CLIP',
    targetPath: '/Volumes/T7/相机/视频',
    ignoreExtensions: ['.XML']
  },
  '相机照片': {
    sourcePath: '/Volumes/zve1/DCIM/100MSDCF',
    targetPath: '/Volumes/T7/相机/照片',
    ignoreExtensions: ['.XML']
  }
};

async function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
}

export async function getDevices(): Promise<Record<string, DeviceConfig>> {
  await ensureDataDir();
  if (!existsSync(DATA_FILE)) {
    await fs.writeFile(DATA_FILE, JSON.stringify(INITIAL_CONFIG, null, 2));
    return INITIAL_CONFIG;
  }
  
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading devices file:', error);
    return INITIAL_CONFIG;
  }
}

const RENAME_CACHE_FILE = path.join(process.cwd(), 'data', 'rename_cache.json');
const BOOKMARKS_FILE = path.join(process.cwd(), 'data', 'bookmarks.json');

export interface Bookmark {
  name: string;
  path: string;
}

export async function getRenameCache(): Promise<Record<string, string>> {
    await ensureDataDir();
    if (!existsSync(RENAME_CACHE_FILE)) {
        return {};
    }
    try {
        const data = await fs.readFile(RENAME_CACHE_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

export async function saveRenameCache(cache: Record<string, string>) {
    await ensureDataDir();
    await fs.writeFile(RENAME_CACHE_FILE, JSON.stringify(cache, null, 2));
}

export async function getBookmarks(): Promise<Bookmark[]> {
  await ensureDataDir();
  if (!existsSync(BOOKMARKS_FILE)) {
    return [];
  }
  try {
    const data = await fs.readFile(BOOKMARKS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

export async function saveBookmarks(bookmarks: Bookmark[]) {
  await ensureDataDir();
  await fs.writeFile(BOOKMARKS_FILE, JSON.stringify(bookmarks, null, 2));
}

export async function addBookmark(bookmark: Bookmark) {
  const bookmarks = await getBookmarks();
  // Check if exists
  const index = bookmarks.findIndex(b => b.name === bookmark.name);
  if (index >= 0) {
    bookmarks[index] = bookmark;
  } else {
    bookmarks.push(bookmark);
  }
  await saveBookmarks(bookmarks);
  return bookmarks;
}

export async function deleteBookmark(name: string) {
  const bookmarks = await getBookmarks();
  const newBookmarks = bookmarks.filter(b => b.name !== name);
  await saveBookmarks(newBookmarks);
  return newBookmarks;
}

export async function saveDevices(devices: Record<string, DeviceConfig>) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(devices, null, 2));
}

export async function addDevice(name: string, config: DeviceConfig) {
  const devices = await getDevices();
  devices[name] = config;
  await saveDevices(devices);
  return devices;
}

export async function updateDevice(oldName: string, newName: string, config: DeviceConfig) {
  const devices = await getDevices();
  if (oldName !== newName) {
    delete devices[oldName];
  }
  devices[newName] = config;
  await saveDevices(devices);
  return devices;
}

export async function deleteDevice(name: string) {
  const devices = await getDevices();
  delete devices[name];
  await saveDevices(devices);
  return devices;
}
