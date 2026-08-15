import { NodeInfo, NodeServerItem, FileItem, InstallNodeParams, CreateServerParams } from './types';

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

// Fetch registered nodes
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
    // Backend offline
  }

  const localNodes = getLocalNodes();
  if (localNodes.length > 0) {
    return localNodes;
  }

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
    // Fallback
  }

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
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers`);
    if (res.ok) {
      const data = await res.json();
      return data.servers || [];
    }
  } catch {
    // Fallback
  }

  try {
    const directRes = await fetch(`http://${node.host}:${node.daemonPort}/api/servers`);
    if (directRes.ok) {
      const data = await directRes.json();
      return data.servers || [];
    }
  } catch {
    // Unreachable
  }

  return [];
}

// Create new Minecraft server instance on a node
export async function createNodeServer(node: NodeInfo, params: CreateServerParams): Promise<{ success: boolean; serverId?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
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
    // Fallback
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
    // Fallback
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
    // Fallback
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

// File Management APIs

// 1. List files in directory
export async function getNodeServerFiles(node: NodeInfo, serverId: string, path: string = ''): Promise<{ files: FileItem[]; currentPath: string }> {
  const query = path ? `?path=${encodeURIComponent(path)}` : '';
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/${serverId}/files${query}`);
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/files${query}`);
    if (res.ok) return await res.json();
  } catch {
    // Unreachable
  }

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
  } catch {
    // Fallback
  }

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/files/content${query}`);
    if (res.ok) {
      const data = await res.json();
      return data.content || '';
    }
  } catch {
    // Unreachable
  }

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
  } catch {
    // Fallback
  }

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
  } catch {
    // Fallback
  }

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
  } catch {
    // Fallback
  }

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
