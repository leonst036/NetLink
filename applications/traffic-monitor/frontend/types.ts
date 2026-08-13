// Data structures for traffic monitor application

export interface NetworkInterfaceStats {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxSpeed: number;
  txSpeed: number;
}

export interface LocalTrafficStats {
  timestamp: number;
  totalRxBytes: number;
  totalTxBytes: number;
  rxSpeed: number;
  txSpeed: number;
  activeConnections: number;
  latencyMs: number;
  interfaces: NetworkInterfaceStats[];
}

export interface RelayTrafficStats {
  timestamp: number;
  relayRxBytes: number;
  relayTxBytes: number;
  rxSpeed: number;
  txSpeed: number;
  activeSockets: number;
  activeTunnels: number;
  latencyMs: number;
  uptimeSeconds: number;
}

export interface TrafficHistoryPoint {
  timeLabel: string;
  timestamp: number;
  localRxSpeed: number;
  localTxSpeed: number;
  relayRxSpeed: number;
  relayTxSpeed: number;
}

export type ActiveTab = 'overview' | 'local' | 'relay' | 'interfaces';
