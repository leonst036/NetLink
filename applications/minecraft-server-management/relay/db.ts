// NetLink Database Layer for Minecraft Server Management Relay
// Uses Deno KV for persistent storage across system restarts, with in-memory fallback.

export interface NodeRecord {
  id: string;
  name: string;
  host: string;
  daemonPort: number;
  daemonToken?: string;
  installedAt: number;
}

export interface AuditEvent {
  id: string;
  action: string;
  nodeId?: string;
  serverId?: string;
  details?: Record<string, any>;
  timestamp: number;
}

const memoryNodes = new Map<string, NodeRecord>();
const memoryAuditEvents: AuditEvent[] = [];

let kvInstance: any = null;

async function getKv(): Promise<any> {
  if (kvInstance) return kvInstance;
  try {
    if (typeof (Deno as any).openKv === "function") {
      kvInstance = await (Deno as any).openKv();
      return kvInstance;
    }
  } catch (err: any) {
    console.warn(`[Minecraft DB Relay] Deno KV unavailable, using memory fallback: ${err.message}`);
  }
  return null;
}

export async function saveNode(node: NodeRecord): Promise<void> {
  const kv = await getKv();
  if (kv) {
    await kv.set(["nodes", node.id], node);
  } else {
    memoryNodes.set(node.id, node);
  }
}

export async function getNode(id: string): Promise<NodeRecord | null> {
  const kv = await getKv();
  if (kv) {
    const entry = await kv.get(["nodes", id]);
    return (entry.value as NodeRecord) || null;
  }
  return memoryNodes.get(id) || null;
}

export async function getAllNodes(): Promise<NodeRecord[]> {
  const kv = await getKv();
  if (kv) {
    const nodes: NodeRecord[] = [];
    for await (const entry of kv.list({ prefix: ["nodes"] })) {
      if (entry.value) nodes.push(entry.value as NodeRecord);
    }
    if (nodes.length > 0) return nodes;
  } else {
    if (memoryNodes.size > 0) return Array.from(memoryNodes.values());
  }

  const defaultNode: NodeRecord = {
    id: "node-baddie",
    name: "Leon Server",
    host: "192.168.55.127",
    daemonPort: 9080,
    daemonToken: "netlink-secret-token",
    installedAt: Date.now(),
  };
  await saveNode(defaultNode);
  return [defaultNode];
}

export async function deleteNode(id: string): Promise<void> {
  const kv = await getKv();
  if (kv) {
    await kv.delete(["nodes", id]);
  } else {
    memoryNodes.delete(id);
  }
}

export async function recordAuditEvent(action: string, meta: { nodeId?: string; serverId?: string; details?: Record<string, any> } = {}): Promise<void> {
  const event: AuditEvent = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    action,
    nodeId: meta.nodeId,
    serverId: meta.serverId,
    details: meta.details,
    timestamp: Date.now(),
  };

  const kv = await getKv();
  if (kv) {
    await kv.set(["audit_logs", event.timestamp, event.id], event);
  } else {
    memoryAuditEvents.push(event);
  }
}

export async function getAuditEvents(limit = 100): Promise<AuditEvent[]> {
  const kv = await getKv();
  if (kv) {
    const events: AuditEvent[] = [];
    for await (const entry of kv.list({ prefix: ["audit_logs"] }, { limit, reverse: true })) {
      if (entry.value) events.push(entry.value as AuditEvent);
    }
    return events;
  }
  return [...memoryAuditEvents].reverse().slice(0, limit);
}

// Sub-Users Management Storage
export interface ServerSubUser {
  id: string;
  username: string;
  email?: string;
  serverId: string;
  permissions: string[];
  createdAt: number;
  invitedBy?: string;
}

const memorySubUsers = new Map<string, ServerSubUser>();

export async function saveSubUser(user: ServerSubUser): Promise<void> {
  const kv = await getKv();
  if (kv) {
    await kv.set(["sub_users", user.serverId, user.id], user);
  } else {
    memorySubUsers.set(`${user.serverId}:${user.id}`, user);
  }
}

export async function getSubUsers(serverId: string): Promise<ServerSubUser[]> {
  const kv = await getKv();
  if (kv) {
    const list: ServerSubUser[] = [];
    for await (const entry of kv.list({ prefix: ["sub_users", serverId] })) {
      if (entry.value) list.push(entry.value as ServerSubUser);
    }
    return list;
  }
  const list: ServerSubUser[] = [];
  for (const [, v] of memorySubUsers) {
    if (v.serverId === serverId) list.push(v);
  }
  return list;
}

export async function deleteSubUser(serverId: string, userId: string): Promise<boolean> {
  const kv = await getKv();
  if (kv) {
    await kv.delete(["sub_users", serverId, userId]);
    return true;
  }
  return memorySubUsers.delete(`${serverId}:${userId}`);
}

