import {
  NodeInfo,
  NodeServerItem,
  FileItem,
  InstallNodeParams,
  CreateServerParams,
  ServerStats,
} from './types';

const API_BASE = '/api/minecraft-server-management';


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

// 6. Get overall Node host machine telemetry and resource utilization
export async function getNodeSystemStats(node: NodeInfo): Promise<import('./types').NodeSystemStats | null> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/system-stats`);
    if (res.ok) return await res.json();
  } catch {}

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/node/system-stats`);
    if (res.ok) return await res.json();
  } catch {}

  return null;
}

// 7. Backup Management APIs

// List backups
export async function getNodeServerBackups(node: NodeInfo, serverId: string): Promise<import('./types').BackupItem[]> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/${serverId}/backups`);
    if (res.ok) {
      const data = await res.json();
      return data.backups || [];
    }
  } catch {}

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/backups`);
    if (res.ok) {
      const data = await res.json();
      return data.backups || [];
    }
  } catch {}

  return [];
}

// Create backup
export async function createNodeServerBackup(
  node: NodeInfo,
  serverId: string,
  name?: string
): Promise<{ success: boolean; backup?: import('./types').BackupItem; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/${serverId}/backups/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) return await res.json();
  } catch {}

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/backups/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Restore backup
export async function restoreNodeServerBackup(
  node: NodeInfo,
  serverId: string,
  backupId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/${serverId}/backups/${backupId}/restore`, {
      method: 'POST',
    });
    if (res.ok) return await res.json();
  } catch {}

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/backups/${backupId}/restore`, {
      method: 'POST',
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Toggle lock backup
export async function toggleLockNodeServerBackup(
  node: NodeInfo,
  serverId: string,
  backupId: string
): Promise<{ success: boolean; backup?: import('./types').BackupItem; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/${serverId}/backups/${backupId}/lock`, {
      method: 'POST',
    });
    if (res.ok) return await res.json();
  } catch {}

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/backups/${backupId}/lock`, {
      method: 'POST',
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Delete backup
export async function deleteNodeServerBackup(
  node: NodeInfo,
  serverId: string,
  backupId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/node/${node.id}/servers/${serverId}/backups/${backupId}`, {
      method: 'DELETE',
    });
    if (res.ok) return await res.json();
  } catch {}

  try {
    const res = await fetch(`http://${node.host}:${node.daemonPort}/api/servers/${serverId}/backups/${backupId}`, {
      method: 'DELETE',
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 8. Port Forwarding / Relay Tunnel APIs

export async function getServerTunnels(serverId?: string): Promise<import('./types').TunnelInfo[]> {
  try {
    const token = localStorage.getItem('netlink_token');
    const query = serverId ? `?appId=minecraft-server-management&serverId=${encodeURIComponent(serverId)}` : '?appId=minecraft-server-management';
    const res = await fetch(`/api/tunnels${query}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    if (res.ok) {
      const data = await res.json();
      return data.tunnels || [];
    }
  } catch (err) {
    console.warn('Failed to fetch tunnels:', err);
  }
  return [];
}

export async function openServerTunnel(params: {
  publicPort: number;
  targetHost: string;
  targetPort: number;
  serverId: string;
  name?: string;
}): Promise<{ success: boolean; tunnel?: import('./types').TunnelInfo; error?: string }> {
  try {
    const token = localStorage.getItem('netlink_token');
    const res = await fetch('/api/tunnels/open', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        ...params,
        appId: 'minecraft-server-management'
      })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function closeServerTunnel(publicPort: number): Promise<{ success: boolean; error?: string }> {
  try {
    const token = localStorage.getItem('netlink_token');
    const res = await fetch('/api/tunnels/close', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ publicPort })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 9. Sub-Users Management APIs (Pterodactyl-Style)

const getSubUserStorageKey = (serverId: string) => `netlink_mc_subusers_${serverId}`;

function getLocalSubUsers(serverId: string): import('./types').ServerSubUser[] {
  try {
    const raw = localStorage.getItem(getSubUserStorageKey(serverId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveLocalSubUsers(serverId: string, users: import('./types').ServerSubUser[]) {
  try {
    localStorage.setItem(getSubUserStorageKey(serverId), JSON.stringify(users));
  } catch {}
}

export async function getServerSubUsers(serverId: string): Promise<import('./types').ServerSubUser[]> {
  try {
    const res = await fetch(`${API_BASE}/servers/${serverId}/users`);
    if (res.ok) {
      const data = await res.json();
      if (data.users && Array.isArray(data.users)) {
        saveLocalSubUsers(serverId, data.users);
        return data.users;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch server sub-users from backend:', err);
  }
  return getLocalSubUsers(serverId);
}

export async function addServerSubUser(
  serverId: string,
  data: { username: string; email?: string; permissions: string[] }
): Promise<{ success: boolean; user?: import('./types').ServerSubUser; error?: string }> {
  const newUser: import('./types').ServerSubUser = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    username: data.username,
    email: data.email,
    serverId,
    permissions: data.permissions,
    createdAt: Date.now(),
    invitedBy: 'admin',
  };

  try {
    const res = await fetch(`${API_BASE}/servers/${serverId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const respData = await res.json();
      if (respData.user) {
        const local = getLocalSubUsers(serverId);
        saveLocalSubUsers(serverId, [respData.user, ...local.filter((u) => u.id !== respData.user.id)]);
        return respData;
      }
    }
  } catch {}

  // Fallback to local storage
  const current = getLocalSubUsers(serverId);
  const updated = [newUser, ...current];
  saveLocalSubUsers(serverId, updated);
  return { success: true, user: newUser };
}

export async function updateServerSubUser(
  serverId: string,
  userId: string,
  data: { permissions: string[]; email?: string }
): Promise<{ success: boolean; user?: import('./types').ServerSubUser; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/servers/${serverId}/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const respData = await res.json();
      if (respData.user) {
        const local = getLocalSubUsers(serverId);
        saveLocalSubUsers(serverId, local.map((u) => (u.id === userId ? respData.user : u)));
        return respData;
      }
    }
  } catch {}

  // Fallback to local storage
  const current = getLocalSubUsers(serverId);
  const user = current.find((u) => u.id === userId);
  if (user) {
    user.permissions = data.permissions;
    if (data.email !== undefined) user.email = data.email;
    saveLocalSubUsers(serverId, current);
    return { success: true, user };
  }
  return { success: false, error: 'User not found' };
}

export async function deleteServerSubUser(
  serverId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/servers/${serverId}/users/${userId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const local = getLocalSubUsers(serverId);
      saveLocalSubUsers(serverId, local.filter((u) => u.id !== userId));
      return { success: true };
    }
  } catch {}

  // Fallback to local storage
  const current = getLocalSubUsers(serverId);
  saveLocalSubUsers(serverId, current.filter((u) => u.id !== userId));
  return { success: true };
}





