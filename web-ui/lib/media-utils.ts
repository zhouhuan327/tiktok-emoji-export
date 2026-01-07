export interface MediaFile {
  name: string;
  path: string;
  size?: number;
  mtime?: string | Date;
}

export interface MediaGroup {
  id: string; // unique identifier (path without extension)
  baseName: string;
  displayFile: MediaFile; // The main file to show (JPG preferred)
  files: MediaFile[]; // All files in this group
  hasRaw: boolean;
  hasJpg: boolean;
  hasVideo: boolean;
  isMerged: boolean;
}

export function groupMediaFiles(files: MediaFile[]): MediaGroup[] {
  if (!files) return [];
  
  const groups: Record<string, MediaGroup> = {};

  files.forEach(file => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    // Use path without extension as ID to group related files
    // If path is absolute, this works. If relative, this works.
    const id = file.path.substring(0, file.path.lastIndexOf('.'));
    const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
    
    if (!ext) {
      // Files without extension, treat as separate
      groups[file.path] = {
          id: file.path,
          baseName: file.name,
          displayFile: file,
          files: [file],
          hasRaw: false,
          hasJpg: false,
          hasVideo: false,
          isMerged: false
      };
      return;
    }

    if (!groups[id]) {
      groups[id] = {
        id,
        baseName,
        displayFile: file,
        files: [],
        hasRaw: false,
        hasJpg: false,
        hasVideo: false,
        isMerged: false
      };
    }
    
    groups[id].files.push(file);
    
    if (['arw', 'raw', 'dng', 'cr2', 'nef'].includes(ext)) {
        groups[id].hasRaw = true;
    } else if (['jpg', 'jpeg', 'heic'].includes(ext)) {
        groups[id].hasJpg = true;
        groups[id].displayFile = file; // Always prefer JPG for display/preview
    } else if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) {
        groups[id].hasVideo = true;
    }
    
    groups[id].isMerged = groups[id].hasRaw && groups[id].hasJpg;
  });

  // Convert map to array and sort by mtime desc (if available) or name
  return Object.values(groups).sort((a, b) => {
      // Try to sort by mtime of display file
      const dateA = a.displayFile.mtime ? new Date(a.displayFile.mtime).getTime() : 0;
      const dateB = b.displayFile.mtime ? new Date(b.displayFile.mtime).getTime() : 0;
      
      if (dateA !== dateB) return dateB - dateA; // Descending
      
      return a.id.localeCompare(b.id);
  });
}
