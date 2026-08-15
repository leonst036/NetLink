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
