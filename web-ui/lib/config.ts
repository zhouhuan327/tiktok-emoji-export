export const DEVICES_CONFIG: Record<string, {
  sourcePath: string;
  targetPath: string;
  ignoreExtensions: string[];
}> = {
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
