import { NodeInfo, NodeServerItem, InstallNodeParams, CreateServerParams } from './types';

const API_BASE = '/api/minecraft-server-management';
const STORAGE_KEY = 'netlink_mc_nodes';

function getLocalNodes(): NodeInfo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore parse error
  }
  return [];
}

export function saveLocalNode(node: NodeInfo): void {
  const nodes = getLocalNodes().filter((n) => n.id !== node.id && n.host !== node.host);
  nodes.push(node);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
}

export function removeLocalNode(nodeId: string): void {
  const nodes = getLocalNodes().filter((n) => n.id !== nodeId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
}

// Fetch registered nodes (from backend with local storage fallback)
export async function getNodes(): Promise<NodeInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/nodes`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.nodes) && data.nodes.length > 0) {
        return data.nodes;
      }
    }
  } catch {
    // Backend offline or route 404
  }

  const localNodes = getLocalNodes();
  if (localNodes.length > 0) {
    return localNodes;
  }

  // If Leon's server is known and accessible, provide it as default active node
  const defaultNode: NodeInfo = {
    id: 'node-baddie',
    name: 'Leon Server',
    host: '192.168.55.127',
    daemonPort: 9080,
    installedAt: Date.now(),
  };
  saveLocalNode(defaultNode);
  return [defaultNode];
}

// Provision new node via SSH
export async function installNode(params: InstallNodeParams): Promise<{ success: boolean; nodeId?: string; output?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/nodes/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.nodeId) {
        saveLocalNode({
          id: data.nodeId,
          name: params.nodeName || params.host,
          host: params.host,
          daemonPort: params.daemonPort || 9080,
          installedAt: Date.now(),
        });
      }
      return data;
    }
  } catch {
    // Backend router not reachable
  }

  // Direct check if daemon is already responding on target host
  const daemonPort = params.daemonPort || 9080;
  try {
    const directStatus = await fetch(`http://${params.host}:${daemonPort}/api/status`, { mode: 'cors' });
    if (directStatus.ok) {
      const nodeId = `node-${Date.now()}`;
      const node: NodeInfo = {
        id: nodeId,
        name: params.nodeName || params.host,
        host: params.host,
        daemonPort,
        installedAt: Date.now(),
      };
      saveLocalNode(node);
      return {
        success: true,
        nodeId,
        output: `Connected directly to Wings daemon running on ${params.host}:${daemonPort}.`,
      };
    }
  } catch {
    // Direct check failed
  }

  return {
    success: false,
    error: `Unable to reach Wings daemon on ${params.host}:${daemonPort}. Please verify SSH installer or port access.`,
  };
}

// Get servers on a specific node
export async function getNodeServers(node: NodeInfo): Promise<NodeServerItem[]> {
  // Try proxy first
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers`);
    if (res.ok) {
      const data = await res.json();
      return data.servers || [];
    }
  } catch {
    // Fallback to direct daemon communication
  }

  // Direct query to wings daemon
  try {
    const directRes = await fetch(`http://${node.host}:${node.daemonPort}/api/servers`);
    if (directRes.ok) {
      const data = await directRes.json();
      return data.servers || [];
    }
  } catch {
    // Daemon unreachable
  }

  return [];
}

// Create new Minecraft server instance on a node
export async function createNodeServer(node: NodeInfo, params: CreateServerParams): Promise<{ success: boolean; serverId?: string; error?: string }> {
  // Try proxy first
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to direct
  }

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Power action on server (start | stop | restart | kill)
export async function powerNodeServer(node: NodeInfo, serverId: string, action: 'start' | 'stop' | 'restart' | 'kill'): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/${serverId}/power`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to direct
  }

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/power`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Send console command to server
export async function sendNodeServerCommand(node: NodeInfo, serverId: string, command: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/${serverId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to direct
  }

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Get recent server logs
export async function getNodeServerLogs(node: NodeInfo, serverId: string): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/${serverId}/logs`);
    if (res.ok) {
      const data = await res.json();
      return data.logs || [];
    }
  } catch {
    // Fallback to direct
  }

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/logs`);
    if (res.ok) {
      const data = await res.json();
      return data.logs || [];
    }
  } catch {
    // Unreachable
  }

  return [];
}
