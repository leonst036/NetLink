// Backup Manager Module for Minecraft Wings Daemon
// Handles compressed .tar.gz backup creation, listing, restoration, lock toggles, and deletion.

export interface BackupItem {
  id: string;
  name: string;
  fileName: string;
  createdAt: number;
  sizeBytes: number;
  isLocked: boolean;
}

interface BackupMetadataFile {
  backups: BackupItem[];
}

// Get metadata path
function getMetadataPath(serverPath: string): string {
  return `${serverPath}/backups/metadata.json`;
}

// Read metadata
async function readMetadata(serverPath: string): Promise<BackupMetadataFile> {
  try {
    const raw = await Deno.readTextFile(getMetadataPath(serverPath));
    return JSON.parse(raw);
  } catch {
    return { backups: [] };
  }
}

// Write metadata
async function writeMetadata(serverPath: string, data: BackupMetadataFile): Promise<void> {
  const backupsDir = `${serverPath}/backups`;
  try {
    await Deno.mkdir(backupsDir, { recursive: true });
  } catch {}
  await Deno.writeTextFile(getMetadataPath(serverPath), JSON.stringify(data, null, 2));
}

// List all backups for a server
export async function listBackups(serverPath: string): Promise<BackupItem[]> {
  const meta = await readMetadata(serverPath);
  const backupsDir = `${serverPath}/backups`;

  // Verify actual files exist and sync sizes
  const validBackups: BackupItem[] = [];
  for (const b of meta.backups) {
    try {
      const stat = await Deno.stat(`${backupsDir}/${b.fileName}`);
      if (stat.isFile) {
        validBackups.push({
          ...b,
          sizeBytes: stat.size,
        });
      }
    } catch {
      // File deleted externally
    }
  }

  if (validBackups.length !== meta.backups.length) {
    await writeMetadata(serverPath, { backups: validBackups });
  }

  return validBackups.sort((a, b) => b.createdAt - a.createdAt);
}

// Create a new backup archive (.tar.gz)
export async function createBackup(serverPath: string, backupName?: string): Promise<BackupItem> {
  const backupsDir = `${serverPath}/backups`;
  try {
    await Deno.mkdir(backupsDir, { recursive: true });
  } catch {}

  const id = `backup-${Date.now()}`;
  const fileName = `${id}.tar.gz`;
  const name = backupName?.trim() || `Backup ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  const archivePath = `${backupsDir}/${fileName}`;

  // Execute tar to package server directory excluding the backups directory
  const cmd = new Deno.Command("tar", {
    args: [
      "-czf",
      archivePath,
      "--exclude=./backups",
      "-C",
      serverPath,
      ".",
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stderr } = await cmd.output();
  if (code !== 0) {
    const errText = new TextDecoder().decode(stderr);
    throw new Error(`Tar backup failed with code ${code}: ${errText}`);
  }

  const stat = await Deno.stat(archivePath);
  const newBackup: BackupItem = {
    id,
    name,
    fileName,
    createdAt: Date.now(),
    sizeBytes: stat.size,
    isLocked: false,
  };

  const meta = await readMetadata(serverPath);
  meta.backups.push(newBackup);
  await writeMetadata(serverPath, meta);

  return newBackup;
}

// Restore server from a backup archive
export async function restoreBackup(serverPath: string, backupId: string): Promise<boolean> {
  const backups = await listBackups(serverPath);
  const backup = backups.find((b) => b.id === backupId);
  if (!backup) throw new Error("Backup archive not found");

  const archivePath = `${serverPath}/backups/${backup.fileName}`;

  // Extract tar archive back into server directory
  const cmd = new Deno.Command("tar", {
    args: [
      "-xzf",
      archivePath,
      "-C",
      serverPath,
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stderr } = await cmd.output();
  if (code !== 0) {
    const errText = new TextDecoder().decode(stderr);
    throw new Error(`Tar extraction failed: ${errText}`);
  }

  return true;
}

// Delete a backup archive
export async function deleteBackup(serverPath: string, backupId: string): Promise<boolean> {
  const meta = await readMetadata(serverPath);
  const index = meta.backups.findIndex((b) => b.id === backupId);
  if (index === -1) return false;

  const backup = meta.backups[index];
  if (backup.isLocked) {
    throw new Error("Cannot delete a locked backup archive. Please unlock it first.");
  }

  const filePath = `${serverPath}/backups/${backup.fileName}`;
  try {
    await Deno.remove(filePath);
  } catch {}

  meta.backups.splice(index, 1);
  await writeMetadata(serverPath, meta);

  return true;
}

// Toggle lock status of a backup
export async function toggleLockBackup(serverPath: string, backupId: string): Promise<BackupItem> {
  const meta = await readMetadata(serverPath);
  const backup = meta.backups.find((b) => b.id === backupId);
  if (!backup) throw new Error("Backup not found");

  backup.isLocked = !backup.isLocked;
  await writeMetadata(serverPath, meta);

  return backup;
}
