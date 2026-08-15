// Player Manager Module for Minecraft Wings Daemon
// Handles online player tracking, whitelist, ops, banned players/IPs, usercache, and in-game player actions.

import { sendCommand, activeServers, registerLogListener, registerExitListener } from "./process_manager.ts";

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

export interface PlayersOverview {
  onlinePlayers: OnlinePlayerItem[];
  whitelist: WhitelistPlayerItem[];
  ops: OpPlayerItem[];
  bannedPlayers: BannedPlayerItem[];
  bannedIps: BannedIpItem[];
  knownPlayers: KnownPlayerItem[];
  whitelistEnabled: boolean;
  maxPlayers: number;
}

// In-memory active players map per server instance: serverId -> (lowercase name -> OnlinePlayerItem)
const serverOnlinePlayers = new Map<string, Map<string, OnlinePlayerItem>>();

// Helper to safely read JSON files
async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await Deno.readTextFile(filePath);
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// Helper to safely write JSON files
async function writeJsonFile(filePath: string, data: any): Promise<void> {
  await Deno.writeTextFile(filePath, JSON.stringify(data, null, 2));
}

// Read server.properties key-values
export async function readServerProperties(serverPath: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  try {
    const raw = await Deno.readTextFile(`${serverPath}/server.properties`);
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        result[key] = val;
      }
    }
  } catch {
    // Missing file
  }
  return result;
}

// Write server.properties key-values
export async function updateServerProperty(serverPath: string, key: string, value: string): Promise<void> {
  const propPath = `${serverPath}/server.properties`;
  let lines: string[] = [];
  try {
    const raw = await Deno.readTextFile(propPath);
    lines = raw.split("\n");
  } catch {
    lines = [];
  }

  let found = false;
  const updatedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1 && trimmed.slice(0, eqIdx).trim() === key) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    updatedLines.push(`${key}=${value}`);
  }

  await Deno.writeTextFile(propPath, updatedLines.join("\n"));
}

// Generate offline UUID v3 fallback
function generateOfflineUuid(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash << 5) - hash + username.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-3${hex.slice(0, 3)}-8${hex.slice(0, 3)}-${hex.repeat(2).slice(0, 12)}`;
}

// Fetch UUID from Mojang API with fallback
export async function lookupPlayerUuid(username: string, serverPath?: string): Promise<string> {
  // Check usercache.json first if serverPath provided
  if (serverPath) {
    const cache = await readJsonFile<Array<{ name: string; uuid: string }>>(`${serverPath}/usercache.json`, []);
    const cached = cache.find((c) => c.name.toLowerCase() === username.toLowerCase());
    if (cached && cached.uuid) return cached.uuid;
  }

  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        // Format undashed UUID to standard 8-4-4-4-12 format
        const id = data.id;
        return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
      }
    }
  } catch {
    // Mojang API unavailable or player offline mode
  }

  return generateOfflineUuid(username);
}

// Hook called by process_manager on stdout log line
export function handlePlayerLogLine(serverId: string, line: string): void {
  if (!serverOnlinePlayers.has(serverId)) {
    serverOnlinePlayers.set(serverId, new Map());
  }
  const players = serverOnlinePlayers.get(serverId)!;

  // 1. Join patterns
  // Examples:
  // "[12:00:00] [Server thread/INFO]: Notch[/127.0.0.1:54321] logged in with entity id 123"
  // "[12:00:00] [Server thread/INFO]: Notch joined the game"
  const joinMatch =
    line.match(/\b([A-Za-z0-9_]{2,16})\s*(?:\[\/[0-9.:]+\])?\s+(?:joined the game|logged in with entity id)/i);

  if (joinMatch) {
    const playerName = joinMatch[1];
    const key = playerName.toLowerCase();
    if (!players.has(key)) {
      players.set(key, {
        name: playerName,
        uuid: generateOfflineUuid(playerName),
        joinedAt: Date.now(),
        isOp: false,
        isWhitelisted: false,
        gamemode: "survival",
      });
    }
  }

  // 2. Leave patterns
  // Examples:
  // "[12:00:00] [Server thread/INFO]: Notch left the game"
  // "[12:00:00] [Server thread/INFO]: Notch lost connection: Disconnected"
  const leaveMatch =
    line.match(/\b([A-Za-z0-9_]{2,16})\s+(?:left the game|lost connection:)/i);

  if (leaveMatch) {
    const playerName = leaveMatch[1];
    players.delete(playerName.toLowerCase());
  }
}

// Clear players when server stops
export function clearOnlinePlayers(serverId: string): void {
  serverOnlinePlayers.delete(serverId);
}

// Register real-time listeners
registerLogListener(handlePlayerLogLine);
registerExitListener(clearOnlinePlayers);

// Get online players
export function getOnlinePlayers(serverId: string): OnlinePlayerItem[] {
  const map = serverOnlinePlayers.get(serverId);
  if (!map) return [];
  return Array.from(map.values());
}

// --- Whitelist Management ---

export async function getWhitelist(serverPath: string): Promise<WhitelistPlayerItem[]> {
  return await readJsonFile<WhitelistPlayerItem[]>(`${serverPath}/whitelist.json`, []);
}

export async function addToWhitelist(
  serverPath: string,
  serverId: string,
  username: string
): Promise<WhitelistPlayerItem> {
  const current = await getWhitelist(serverPath);
  const exists = current.find((p) => p.name.toLowerCase() === username.toLowerCase());
  if (exists) return exists;

  const uuid = await lookupPlayerUuid(username, serverPath);
  const item: WhitelistPlayerItem = { name: username, uuid };
  current.push(item);
  await writeJsonFile(`${serverPath}/whitelist.json`, current);

  // If server is online, execute console commands to sync in real time
  if (activeServers.has(serverId)) {
    await sendCommand(serverId, `whitelist add ${username}`);
    await sendCommand(serverId, "whitelist reload");
  }

  return item;
}

export async function removeFromWhitelist(
  serverPath: string,
  serverId: string,
  username: string
): Promise<boolean> {
  const current = await getWhitelist(serverPath);
  const next = current.filter((p) => p.name.toLowerCase() !== username.toLowerCase());
  await writeJsonFile(`${serverPath}/whitelist.json`, next);

  if (activeServers.has(serverId)) {
    await sendCommand(serverId, `whitelist remove ${username}`);
    await sendCommand(serverId, "whitelist reload");
  }

  return true;
}

export async function toggleWhitelistState(
  serverPath: string,
  serverId: string,
  enabled: boolean
): Promise<boolean> {
  await updateServerProperty(serverPath, "white-list", enabled ? "true" : "false");

  if (activeServers.has(serverId)) {
    await sendCommand(serverId, enabled ? "whitelist on" : "whitelist off");
    await sendCommand(serverId, "whitelist reload");
  }

  return enabled;
}

// --- Operators (OPs) Management ---

export async function getOps(serverPath: string): Promise<OpPlayerItem[]> {
  return await readJsonFile<OpPlayerItem[]>(`${serverPath}/ops.json`, []);
}

export async function addOrUpdateOp(
  serverPath: string,
  serverId: string,
  username: string,
  level: number = 4,
  bypassesPlayerLimit: boolean = false
): Promise<OpPlayerItem> {
  const current = await getOps(serverPath);
  const existingIdx = current.findIndex((p) => p.name.toLowerCase() === username.toLowerCase());
  const uuid = existingIdx !== -1 ? current[existingIdx].uuid : await lookupPlayerUuid(username, serverPath);

  const opItem: OpPlayerItem = {
    name: username,
    uuid,
    level: Math.min(Math.max(level, 1), 4),
    bypassesPlayerLimit,
  };

  if (existingIdx !== -1) {
    current[existingIdx] = opItem;
  } else {
    current.push(opItem);
  }

  await writeJsonFile(`${serverPath}/ops.json`, current);

  if (activeServers.has(serverId)) {
    await sendCommand(serverId, `op ${username}`);
  }

  return opItem;
}

export async function removeOp(
  serverPath: string,
  serverId: string,
  username: string
): Promise<boolean> {
  const current = await getOps(serverPath);
  const next = current.filter((p) => p.name.toLowerCase() !== username.toLowerCase());
  await writeJsonFile(`${serverPath}/ops.json`, next);

  if (activeServers.has(serverId)) {
    await sendCommand(serverId, `deop ${username}`);
  }

  return true;
}

// --- Banned Players Management ---

export async function getBannedPlayers(serverPath: string): Promise<BannedPlayerItem[]> {
  return await readJsonFile<BannedPlayerItem[]>(`${serverPath}/banned-players.json`, []);
}

export async function banPlayer(
  serverPath: string,
  serverId: string,
  username: string,
  reason: string = "Banned by operator"
): Promise<BannedPlayerItem> {
  const current = await getBannedPlayers(serverPath);
  const existing = current.find((p) => p.name.toLowerCase() === username.toLowerCase());
  if (existing) return existing;

  const uuid = await lookupPlayerUuid(username, serverPath);
  const now = new Date();
  const dateStr = now.toISOString().replace("T", " ").replace(/\..+/, " +0000");

  const item: BannedPlayerItem = {
    name: username,
    uuid,
    created: dateStr,
    source: "NetLink",
    expires: "forever",
    reason: reason || "Banned by operator",
  };

  current.push(item);
  await writeJsonFile(`${serverPath}/banned-players.json`, current);

  if (activeServers.has(serverId)) {
    await sendCommand(serverId, `ban ${username} ${reason}`);
  }

  return item;
}

export async function unbanPlayer(
  serverPath: string,
  serverId: string,
  username: string
): Promise<boolean> {
  const current = await getBannedPlayers(serverPath);
  const next = current.filter((p) => p.name.toLowerCase() !== username.toLowerCase());
  await writeJsonFile(`${serverPath}/banned-players.json`, next);

  if (activeServers.has(serverId)) {
    await sendCommand(serverId, `pardon ${username}`);
  }

  return true;
}

// --- Banned IPs Management ---

export async function getBannedIps(serverPath: string): Promise<BannedIpItem[]> {
  return await readJsonFile<BannedIpItem[]>(`${serverPath}/banned-ips.json`, []);
}

export async function banIp(
  serverPath: string,
  serverId: string,
  ip: string,
  reason: string = "Banned by operator"
): Promise<BannedIpItem> {
  const current = await getBannedIps(serverPath);
  const existing = current.find((p) => p.ip === ip);
  if (existing) return existing;

  const now = new Date();
  const dateStr = now.toISOString().replace("T", " ").replace(/\..+/, " +0000");

  const item: BannedIpItem = {
    ip,
    created: dateStr,
    source: "NetLink",
    expires: "forever",
    reason: reason || "Banned by operator",
  };

  current.push(item);
  await writeJsonFile(`${serverPath}/banned-ips.json`, current);

  if (activeServers.has(serverId)) {
    await sendCommand(serverId, `ban-ip ${ip} ${reason}`);
  }

  return item;
}

export async function unbanIp(
  serverPath: string,
  serverId: string,
  ip: string
): Promise<boolean> {
  const current = await getBannedIps(serverPath);
  const next = current.filter((p) => p.ip !== ip);
  await writeJsonFile(`${serverPath}/banned-ips.json`, next);

  if (activeServers.has(serverId)) {
    await sendCommand(serverId, `pardon-ip ${ip}`);
  }

  return true;
}

// --- Known Players Directory (usercache.json + world stats) ---

export async function getKnownPlayers(serverPath: string, serverId: string): Promise<KnownPlayerItem[]> {
  const knownMap = new Map<string, KnownPlayerItem>();

  // 1. Read usercache.json
  const cache = await readJsonFile<Array<{ name: string; uuid: string; expiresOn?: string }>>(
    `${serverPath}/usercache.json`,
    []
  );
  for (const c of cache) {
    if (c.name && c.uuid) {
      knownMap.set(c.name.toLowerCase(), {
        name: c.name,
        uuid: c.uuid,
        isOnline: false,
        isOp: false,
        isWhitelisted: false,
        isBanned: false,
      });
    }
  }

  // 2. Cross-reference with Whitelist, OPs, Bans, and Online players
  const [whitelist, ops, bans] = await Promise.all([
    getWhitelist(serverPath),
    getOps(serverPath),
    getBannedPlayers(serverPath),
  ]);

  for (const w of whitelist) {
    const key = w.name.toLowerCase();
    const item = knownMap.get(key) || {
      name: w.name,
      uuid: w.uuid,
      isOnline: false,
      isOp: false,
      isWhitelisted: false,
      isBanned: false,
    };
    item.isWhitelisted = true;
    knownMap.set(key, item);
  }

  for (const o of ops) {
    const key = o.name.toLowerCase();
    const item = knownMap.get(key) || {
      name: o.name,
      uuid: o.uuid,
      isOnline: false,
      isOp: false,
      isWhitelisted: false,
      isBanned: false,
    };
    item.isOp = true;
    knownMap.set(key, item);
  }

  for (const b of bans) {
    const key = b.name.toLowerCase();
    const item = knownMap.get(key) || {
      name: b.name,
      uuid: b.uuid,
      isOnline: false,
      isOp: false,
      isWhitelisted: false,
      isBanned: false,
    };
    item.isBanned = true;
    knownMap.set(key, item);
  }

  // Check online status
  const online = getOnlinePlayers(serverId);
  for (const on of online) {
    const key = on.name.toLowerCase();
    const item = knownMap.get(key) || {
      name: on.name,
      uuid: on.uuid,
      isOnline: true,
      isOp: false,
      isWhitelisted: false,
      isBanned: false,
    };
    item.isOnline = true;
    knownMap.set(key, item);
  }

  return Array.from(knownMap.values()).sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return a.name.localeCompare(b.name);
  });
}

// --- Live Player In-Game Actions ---

export async function executePlayerAction(
  serverId: string,
  action: string,
  player: string,
  params: Record<string, any> = {}
): Promise<{ success: boolean; message?: string }> {
  if (!activeServers.has(serverId)) {
    return { success: false, message: "Server is offline. Cannot perform live in-game actions." };
  }

  switch (action) {
    case "kick": {
      const reason = params.reason ? ` ${params.reason}` : " Kicked by operator";
      await sendCommand(serverId, `kick ${player}${reason}`);
      return { success: true, message: `Kicked player ${player}` };
    }
    case "kill": {
      await sendCommand(serverId, `kill ${player}`);
      return { success: true, message: `Killed player ${player}` };
    }
    case "gamemode": {
      const mode = params.gamemode || "survival";
      await sendCommand(serverId, `gamemode ${mode} ${player}`);
      return { success: true, message: `Changed gamemode of ${player} to ${mode}` };
    }
    case "tp":
    case "teleport": {
      if (params.target) {
        await sendCommand(serverId, `teleport ${player} ${params.target}`);
        return { success: true, message: `Teleported ${player} to ${params.target}` };
      } else if (params.x !== undefined && params.y !== undefined && params.z !== undefined) {
        await sendCommand(serverId, `teleport ${player} ${params.x} ${params.y} ${params.z}`);
        return { success: true, message: `Teleported ${player} to coordinates (${params.x}, ${params.y}, ${params.z})` };
      }
      return { success: false, message: "Missing teleport target destination" };
    }
    case "msg":
    case "whisper": {
      const msg = params.message || "";
      if (!msg) return { success: false, message: "Message cannot be empty" };
      await sendCommand(serverId, `tell ${player} ${msg}`);
      return { success: true, message: `Sent message to ${player}` };
    }
    case "heal": {
      await sendCommand(serverId, `effect give ${player} instant_health 1 255`);
      await sendCommand(serverId, `effect give ${player} saturation 1 255`);
      return { success: true, message: `Healed and fed player ${player}` };
    }
    case "clear": {
      await sendCommand(serverId, `clear ${player}`);
      return { success: true, message: `Cleared inventory of ${player}` };
    }
    case "give": {
      const item = params.item || "diamond";
      const amount = params.amount || 1;
      await sendCommand(serverId, `give ${player} ${item} ${amount}`);
      return { success: true, message: `Gave ${amount}x ${item} to ${player}` };
    }
    case "xp": {
      const amount = params.amount || 10;
      await sendCommand(serverId, `experience add ${player} ${amount} levels`);
      return { success: true, message: `Added ${amount} XP levels to ${player}` };
    }
    case "broadcast": {
      const msg = params.message || "";
      if (!msg) return { success: false, message: "Broadcast message cannot be empty" };
      await sendCommand(serverId, `say ${msg}`);
      return { success: true, message: `Broadcast message sent to all players` };
    }
    default:
      return { success: false, message: `Unknown action: ${action}` };
  }
}

// --- Aggregate Overview ---

export async function getPlayersOverview(
  serverPath: string,
  serverId: string
): Promise<PlayersOverview> {
  const [props, whitelist, ops, bannedPlayers, bannedIps, knownPlayers] = await Promise.all([
    readServerProperties(serverPath),
    getWhitelist(serverPath),
    getOps(serverPath),
    getBannedPlayers(serverPath),
    getBannedIps(serverPath),
    getKnownPlayers(serverPath, serverId),
  ]);

  const whitelistEnabled = props["white-list"] === "true";
  const maxPlayers = parseInt(props["max-players"] || "20", 10);

  const rawOnline = getOnlinePlayers(serverId);
  // Enhance online players with OP and Whitelist flags
  const onlinePlayers: OnlinePlayerItem[] = rawOnline.map((p) => {
    const isOp = ops.some((o) => o.name.toLowerCase() === p.name.toLowerCase());
    const isWhitelisted = whitelist.some((w) => w.name.toLowerCase() === p.name.toLowerCase());
    return {
      ...p,
      isOp,
      isWhitelisted,
    };
  });

  return {
    onlinePlayers,
    whitelist,
    ops,
    bannedPlayers,
    bannedIps,
    knownPlayers,
    whitelistEnabled,
    maxPlayers,
  };
}
