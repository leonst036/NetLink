// Server Manager Module for Minecraft Wings Daemon
// Manages server instance directory creation and configuration generation.

export interface CreateServerOptions {
  id?: string;
  port?: number;
  motd?: string;
  maxPlayers?: number;
  gamemode?: string;
  difficulty?: string;
  pvp?: boolean;
  onlineMode?: boolean;
}

export interface ServerInstanceSummary {
  id: string;
  name: string;
  status: 'online' | 'offline';
  path: string;
}

// List all server directories
export async function listAllServers(dataDir: string, activeServerIds: Set<string>): Promise<ServerInstanceSummary[]> {
  const serversList: ServerInstanceSummary[] = [];
  try {
    for await (const entry of Deno.readDir(dataDir)) {
      if (entry.isDirectory) {
        const isRunning = activeServerIds.has(entry.name);
        serversList.push({
          id: entry.name,
          name: entry.name,
          status: isRunning ? "online" : "offline",
          path: `${dataDir}/${entry.name}`,
        });
      }
    }
  } catch {
    // Directory scan error
  }
  return serversList;
}

// Provision server instance
export async function provisionServerInstance(dataDir: string, options: CreateServerOptions): Promise<{ serverId: string; serverPath: string }> {
  const serverId = options.id || `mc-${Date.now()}`;
  const serverPath = `${dataDir}/${serverId}`;

  await Deno.mkdir(serverPath, { recursive: true });
  await Deno.writeTextFile(`${serverPath}/eula.txt`, "eula=true\n");

  const port = options.port || 25565;
  const motd = options.motd || "A NetLink Minecraft Server";
  const maxPlayers = options.maxPlayers || 20;

  const properties = [
    `server-port=${port}`,
    `motd=${motd}`,
    `max-players=${maxPlayers}`,
    `gamemode=${options.gamemode || "survival"}`,
    `difficulty=${options.difficulty || "easy"}`,
    `pvp=${options.pvp !== false}`,
    `online-mode=${options.onlineMode !== false}`,
  ].join("\n");

  await Deno.writeTextFile(`${serverPath}/server.properties`, properties);

  return { serverId, serverPath };
}
