// File Manager Module for Minecraft Wings Daemon
// Provides directory traversal, safe path resolution, file reading/writing/deletion.

export interface DaemonFileItem {
  name: string;
  isDirectory: boolean;
  size: number;
  modifiedTime: number;
  path: string;
}

// Path safety resolver (prevents traversal outside base directory)
export function resolveSafePath(baseDir: string, relPath: string = ""): string | null {
  const normalized = relPath.replace(/^(\.\.(\/|\\|$))+/, "").replace(/^\/+/, "");
  const parts = normalized.split(/[\/\\]/).filter((p) => p && p !== "." && p !== "..");
  const safePath = parts.length > 0 ? `${baseDir}/${parts.join("/")}` : baseDir;
  return safePath.startsWith(baseDir) ? safePath : null;
}

// List files in server directory
export async function listServerFiles(serverPath: string, subPath: string = ""): Promise<DaemonFileItem[]> {
  const targetDir = resolveSafePath(serverPath, subPath);
  if (!targetDir) throw new Error("Invalid path");

  const files: DaemonFileItem[] = [];
  for await (const entry of Deno.readDir(targetDir)) {
    let size = 0;
    let modifiedTime = Date.now();
    try {
      const stat = await Deno.stat(`${targetDir}/${entry.name}`);
      size = stat.size;
      if (stat.mtime) modifiedTime = stat.mtime.getTime();
    } catch {
      // Ignore stat error
    }

    const relFilePath = subPath ? `${subPath}/${entry.name}` : entry.name;
    files.push({
      name: entry.name,
      isDirectory: entry.isDirectory,
      size,
      modifiedTime,
      path: relFilePath,
    });
  }

  // Folders first, then alphabetically
  files.sort((a, b) => {
    if (a.isDirectory === b.isDirectory) {
      return a.name.localeCompare(b.name);
    }
    return a.isDirectory ? -1 : 1;
  });

  return files;
}

// Read text file content
export async function readServerFileContent(serverPath: string, filePath: string): Promise<string> {
  const targetFile = resolveSafePath(serverPath, filePath);
  if (!targetFile) throw new Error("Invalid file path");
  return await Deno.readTextFile(targetFile);
}

// Save text file content
export async function saveServerFileContent(serverPath: string, filePath: string, content: string): Promise<void> {
  const targetFile = resolveSafePath(serverPath, filePath);
  if (!targetFile) throw new Error("Invalid file path");
  await Deno.writeTextFile(targetFile, content);
}

// Delete file or folder
export async function deleteServerFileItem(serverPath: string, itemPath: string): Promise<void> {
  if (!itemPath || itemPath === "/" || itemPath === ".") {
    throw new Error("Cannot delete server root");
  }
  const target = resolveSafePath(serverPath, itemPath);
  if (!target) throw new Error("Invalid path");
  await Deno.remove(target, { recursive: true });
}

// Create directory
export async function createServerDirectory(serverPath: string, folderPath: string): Promise<void> {
  const target = resolveSafePath(serverPath, folderPath);
  if (!target) throw new Error("Invalid path");
  await Deno.mkdir(target, { recursive: true });
}
