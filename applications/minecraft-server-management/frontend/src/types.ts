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
