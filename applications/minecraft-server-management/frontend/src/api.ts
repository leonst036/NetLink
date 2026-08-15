import {
  NodeInfo,
  NodeServerItem,
  FileItem,
  InstallNodeParams,
  CreateServerParams,
  ServerStats,
} from './types';

const API_BASE = '/api/custom/minecraft-server-management';

// Get all connected Wings nodes
export async function getNodes(): Promise<NodeInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/nodes`);
    if (res.ok) {
      const data = await res.json();
      if (data.nodes && Array.isArray(data.nodes) && data.nodes.length > 0) {
        return data.nodes;
      }
    }
  } catch {}

  // Persistent browser fallback
  try {
    const saved = localStorage.getItem('netlink_wings_nodes');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  return [];
}

// Save nodes persistently
export function saveLocalNodes(nodes: NodeInfo[]): void {
  try {
    localStorage.setItem('netlink_wings_nodes', JSON.stringify(nodes));
  } catch {}
}

// Install or connect daemon on node
export async function installNodeOverSsh(params: InstallNodeParams): Promise<{ success: boolean; nodeId?: string; output?: string; error?: string }> {
  const daemonPort = params.daemonPort || 9080;

  // 1. Check if daemon is already running directly on the host
  try {
    const checkRes = await fetch(`http://${params.host}:${daemonPort}/api/status`);
    if (checkRes.ok) {
      const data = await checkRes.json();
      if (data.status === 'online') {
        const nodeId = `node-${Date.now()}`;
        return {
          success: true,
          nodeId,
          output: `Connected to active Wings daemon v${data.version || '1.0.1'} on ${params.host}:${daemonPort}.`,
        };
      }
    }
  } catch {
    // Daemon not reachable directly
  }

  // 2. SSH install via edge backend
  try {
    const res = await fetch(`${API_BASE}/nodes/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  return {
    success: false,
    error: `Could not connect to Wings daemon on http://${params.host}:${daemonPort}. Please ensure daemon is started.`,
  };
}

export const installNode = installNodeOverSsh;

// Get all servers on a specific Wings node
export async function getNodeServers(node: NodeInfo): Promise<NodeServerItem[]> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers`);
    if (res.ok) {
      const data = await res.json();
      return data.servers || [];
    }
  } catch {}

  // Direct fetch fallback to node daemon
  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers`);
    if (res.ok) {
      const data = await res.json();
      return data.servers || [];
    }
  } catch {}

  return [];
}

// Create new Minecraft server instance on node
export async function createNodeServer(node: NodeInfo, params: CreateServerParams): Promise<{ success: boolean; serverId?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) return await res.json();
  } catch {}

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

// Power action: start, stop, restart, kill
export async function powerNodeServer(node: NodeInfo, serverId: string, action: 'start' | 'stop' | 'restart' | 'kill'): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/${serverId}/power`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) return await res.json();
  } catch {}

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
  } catch {}

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
  } catch {}

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/logs`);
    if (res.ok) {
      const data = await res.json();
      return data.logs || [];
    }
  } catch {}

  return [];
}

// Get real-time server telemetry stats (CPU, RAM, Disk, Uptime)
export async function getNodeServerStats(node: NodeInfo, serverId: string): Promise<ServerStats | null> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/${serverId}/stats`);
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/stats`);
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  return null;
}

// Update server resource limits (RAM & CPU allocation)
export async function updateNodeServerResources(
  node: NodeInfo,
  serverId: string,
  limits: { ramMb?: number; cpuLimitPercent?: number }
): Promise<{ success: boolean; ramMb?: number; cpuLimitPercent?: number; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/${serverId}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(limits),
    });
    if (res.ok) return await res.json();
  } catch {}

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(limits),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}


// File Management APIs

// 1. List files in directory
export async function getNodeServerFiles(node: NodeInfo, serverId: string, path: string = ''): Promise<{ files: FileItem[]; currentPath: string }> {
  const query = path ? `?path=${encodeURIComponent(path)}` : '';
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/${serverId}/files${query}`);
    if (res.ok) return await res.json();
  } catch {}

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/files${query}`);
    if (res.ok) return await res.json();
  } catch {}

  return { files: [], currentPath: path };
}

// 2. Read file content
export async function getNodeServerFileContent(node: NodeInfo, serverId: string, path: string): Promise<string> {
  const query = `?path=${encodeURIComponent(path)}`;
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/${serverId}/files/content${query}`);
    if (res.ok) {
      const data = await res.json();
      return data.content || '';
    }
  } catch {}

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/files/content${query}`);
    if (res.ok) {
      const data = await res.json();
      return data.content || '';
    }
  } catch {}

  return '';
}

// 3. Save file content
export async function saveNodeServerFile(node: NodeInfo, serverId: string, path: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/${serverId}/files/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
    if (res.ok) return await res.json();
  } catch {}

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/files/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 4. Delete file or directory
export async function deleteNodeServerFile(node: NodeInfo, serverId: string, path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/${serverId}/files/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (res.ok) return await res.json();
  } catch {}

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/files/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 5. Create folder
export async function createNodeServerFolder(node: NodeInfo, serverId: string, path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/${serverId}/files/create-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (res.ok) return await res.json();
  } catch {}

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/files/create-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
