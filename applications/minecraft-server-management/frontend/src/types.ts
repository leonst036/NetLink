export interface NodeInfo {
  id: string;
  name: string;
  host: string;
  daemonPort: number;
  installedAt: number;
}

export interface NodeServerItem {
  id: string;
  name: string;
  status: 'online' | 'offline';
  path: string;
}

export interface ServerStats {
  cpuPercent: number;
  cpuLimitPercent?: number;
  memoryMb: number;
  memoryLimitMb: number;
  diskMb: number;
  uptimeSeconds: number;
  status: 'online' | 'offline';
}

export interface NodeSystemStats {
  cpuPercent: number;
  cpuCores: number;
  memoryTotalMb: number;
  memoryUsedMb: number;
  memoryFreeMb: number;
  memoryPercent: number;
  diskTotalMb: number;
  diskUsedMb: number;
  diskFreeMb: number;
  diskPercent: number;
  loadAvg: [number, number, number];
  activeServersCount: number;
  totalAllocatedRamMb: number;
  daemonUptimeSeconds: number;
}

export interface BackupItem {
  id: string;
  name: string;
  fileName: string;
  createdAt: number;
  sizeBytes: number;
  isLocked: boolean;
}

export interface TunnelInfo {
  publicPort: number;
  targetHost: string;
  targetPort: number;
  appId: string;
  serverId?: string;
  name?: string;
  status: 'active' | 'error' | 'closed';
  activeConnections: number;
  bytesRx: number;
  bytesTx: number;
  createdAt: number;
  error?: string;
}


export interface FileItem {
  name: string;
  isDirectory: boolean;
  size: number;
  modifiedTime: number;
  path: string;
}

export interface InstallNodeParams {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  nodeName?: string;
  daemonPort?: number;
}

export interface CreateServerParams {
  id?: string;
  name?: string;
  port?: number;
  motd?: string;
  maxPlayers?: number;
  gamemode?: string;
  difficulty?: string;
  pvp?: boolean;
  onlineMode?: boolean;
}

export interface ServerSubUser {
  id: string;
  username: string;
  email?: string;
  serverId: string;
  permissions: string[];
  createdAt: number;
  invitedBy?: string;
}

export interface PermissionItem {
  key: string;
  label: string;
  description: string;
}

export interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  permissions: PermissionItem[];
}

export const SUBUSER_PERMISSIONS_SCHEMA: PermissionGroup[] = [
  {
    id: 'control',
    name: 'Server Control',
    description: 'Permissions for power actions and real-time state management.',
    permissions: [
      { key: 'control.start', label: 'Start Server', description: 'Start the Minecraft server process.' },
      { key: 'control.stop', label: 'Stop Server', description: 'Gracefully shutdown the Minecraft server process.' },
      { key: 'control.restart', label: 'Restart Server', description: 'Restart the Minecraft server instance.' },
      { key: 'control.console', label: 'Access Console', description: 'View live logs and send commands to the server console.' },
    ],
  },
  {
    id: 'file',
    name: 'File Manager',
    description: 'Permissions to view and manage instance directory contents.',
    permissions: [
      { key: 'file.read', label: 'View Files', description: 'Browse directories and view file contents.' },
      { key: 'file.write', label: 'Edit & Create Files', description: 'Save edits, create new files, and upload content.' },
      { key: 'file.delete', label: 'Delete Files', description: 'Permanently remove files and subdirectories.' },
    ],
  },
  {
    id: 'backup',
    name: 'Backup System',
    description: 'Permissions to create, restore, lock, and manage snapshots.',
    permissions: [
      { key: 'backup.view', label: 'View Backups', description: 'Inspect available backup archives and metadata.' },
      { key: 'backup.create', label: 'Create Backups', description: 'Take new tar archive snapshots.' },
      { key: 'backup.restore', label: 'Restore Backups', description: 'Extract and restore server state from snapshots.' },
      { key: 'backup.delete', label: 'Delete Backups', description: 'Delete unlocked backup snapshots.' },
    ],
  },
  {
    id: 'settings',
    name: 'Settings & Network',
    description: 'Permissions for resource allocations and public tunnel access.',
    permissions: [
      { key: 'settings.resources', label: 'Resource Limits', description: 'Adjust RAM memory and CPU core limits.' },
      { key: 'settings.network', label: 'Port Forwarding', description: 'Open and close public internet relay tunnels.' },
    ],
  },
];

export interface OnlinePlayerItem {
  name: string;
  uuid: string;
  joinedAt: number;
  isOp: boolean;
  isWhitelisted: boolean;
  gamemode?: string;
  ping?: number;
}

export interface WhitelistPlayerItem {
  name: string;
  uuid: string;
}

export interface OpPlayerItem {
  name: string;
  uuid: string;
  level: number;
  bypassesPlayerLimit: boolean;
}

export interface BannedPlayerItem {
  name: string;
  uuid: string;
  created: string;
  source: string;
  expires: string;
  reason: string;
}

export interface BannedIpItem {
  ip: string;
  created: string;
  source: string;
  expires: string;
  reason: string;
}

export interface KnownPlayerItem {
  name: string;
  uuid: string;
  isOnline: boolean;
  isOp: boolean;
  isWhitelisted: boolean;
  isBanned: boolean;
  lastSeen?: number;
}

export interface PlayersOverviewResponse {
  onlinePlayers: OnlinePlayerItem[];
  whitelist: WhitelistPlayerItem[];
  ops: OpPlayerItem[];
  bannedPlayers: BannedPlayerItem[];
  bannedIps: BannedIpItem[];
  knownPlayers: KnownPlayerItem[];
  whitelistEnabled: boolean;
  maxPlayers: number;
}

export interface SoftwareOption {
  id: string;
  name: string;
  description: string;
  recommendedVersion: string;
  supportedVersions: string[];
  supportsBuilds?: boolean;
  buildLabel?: string;
}

export interface InstanceSoftwareConfig {
  software: string;
  version: string;
  build?: string;
  jarFile: string;
  updatedAt?: number;
}

export interface ServerSoftwareResponse {
  current: InstanceSoftwareConfig;
  supportedSoftwares: SoftwareOption[];
}

export interface SoftwareBuildsResponse {
  builds: string[];
  latest: string;
}

export interface ChangeSoftwarePayload {
  software: string;
  version: string;
  build?: string;
  jarFile?: string;
}


