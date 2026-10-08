import net from "net";

export interface TunnelConfig {
  publicPort: number;
  targetHost: string;
  targetPort: number;
  appId: string;
  serverId?: string;
  name?: string;
  enabled?: boolean;
}

export interface TunnelInfo {
  publicPort: number;
  targetHost: string;
  targetPort: number;
  appId: string;
  serverId?: string | undefined;
  name?: string | undefined;
  status: "active" | "error" | "closed";
  activeConnections: number;
  bytesRx: number;
  bytesTx: number;
  createdAt: number;
  error?: string;
}

interface ActiveTunnelEntry {
  server: net.Server;
  config: TunnelConfig;
  sockets: Set<{ client: net.Socket; target: net.Socket }>;
  bytesRx: number;
  bytesTx: number;
  createdAt: number;
}

const activeTunnels = new Map<number, ActiveTunnelEntry>();

// Open a TCP port forward tunnel
export async function openTunnel(config: TunnelConfig): Promise<TunnelInfo> {
  const { publicPort, targetHost, targetPort, appId, serverId, name } = config;

  if (activeTunnels.has(publicPort)) {
    // If already running with same target, return existing
    const existing = activeTunnels.get(publicPort)!;
    if (existing.config.targetHost === targetHost && existing.config.targetPort === targetPort) {
      return getTunnelInfo(publicPort)!;
    }
    // Close previous tunnel on same port
    await closeTunnel(publicPort);
  }

  return new Promise((resolve, reject) => {
    const entry: ActiveTunnelEntry = {
      server: null as any,
      config,
      sockets: new Set(),
      bytesRx: 0,
      bytesTx: 0,
      createdAt: Date.now(),
    };

    const server = net.createServer({ pauseOnConnect: false }, (clientSocket) => {
      let targetSocket: net.Socket | null = null;

      try {
        targetSocket = net.createConnection({ host: targetHost, port: targetPort });
      } catch (err: any) {
        clientSocket.destroy();
        return;
      }

      const pair = { client: clientSocket, target: targetSocket };
      entry.sockets.add(pair);

      clientSocket.on("data", (chunk) => {
        entry.bytesRx += chunk.length;
      });

      targetSocket.on("data", (chunk) => {
        entry.bytesTx += chunk.length;
      });

      clientSocket.pipe(targetSocket);
      targetSocket.pipe(clientSocket);

      const cleanup = () => {
        entry.sockets.delete(pair);
        if (!clientSocket.destroyed) clientSocket.destroy();
        if (targetSocket && !targetSocket.destroyed) targetSocket.destroy();
      };

      clientSocket.on("error", cleanup);
      targetSocket.on("error", cleanup);
      clientSocket.on("close", cleanup);
      targetSocket.on("close", cleanup);
    });

    server.on("error", (err: any) => {
      activeTunnels.delete(publicPort);
      reject(err);
    });

    server.listen(publicPort, "0.0.0.0", () => {
      console.log(`[PortForwardManager] TCP Tunnel listening on 0.0.0.0:${publicPort} -> ${targetHost}:${targetPort} (App: ${appId})`);
      entry.server = server;
      activeTunnels.set(publicPort, entry);
      resolve({
        publicPort,
        targetHost,
        targetPort,
        appId,
        serverId,
        name,
        status: "active",
        activeConnections: 0,
        bytesRx: 0,
        bytesTx: 0,
        createdAt: entry.createdAt,
      });
    });
  });
}

// Close an active tunnel
export async function closeTunnel(publicPort: number): Promise<boolean> {
  const entry = activeTunnels.get(publicPort);
  if (!entry) return false;

  for (const { client, target } of entry.sockets) {
    try { client.destroy(); } catch {}
    try { target.destroy(); } catch {}
  }
  entry.sockets.clear();

  await new Promise<void>((resolve) => {
    entry.server.close(() => resolve());
  });

  activeTunnels.delete(publicPort);
  console.log(`[PortForwardManager] Closed TCP Tunnel on port ${publicPort}`);
  return true;
}

// Get info for a specific tunnel
export function getTunnelInfo(publicPort: number): TunnelInfo | null {
  const entry = activeTunnels.get(publicPort);
  if (!entry) return null;

  return {
    publicPort: entry.config.publicPort,
    targetHost: entry.config.targetHost,
    targetPort: entry.config.targetPort,
    appId: entry.config.appId,
    serverId: entry.config.serverId,
    name: entry.config.name,
    status: "active",
    activeConnections: entry.sockets.size,
    bytesRx: entry.bytesRx,
    bytesTx: entry.bytesTx,
    createdAt: entry.createdAt,
  };
}

// List all active tunnels
export function listTunnels(appId?: string, serverId?: string): TunnelInfo[] {
  const results: TunnelInfo[] = [];
  for (const [port, entry] of activeTunnels) {
    if (appId && entry.config.appId !== appId) continue;
    if (serverId && entry.config.serverId !== serverId) continue;
    const info = getTunnelInfo(port);
    if (info) results.push(info);
  }
  return results;
}
