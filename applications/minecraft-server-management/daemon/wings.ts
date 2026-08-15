const port = parseInt(Deno.env.get("PORT") || "8080");
const dataDir = Deno.env.get("DATA_DIR") || "/var/lib/netlink-wings/servers";
const authToken = Deno.env.get("AUTH_TOKEN") || "";

// Ensure base servers data directory exists
try {
  await Deno.mkdir(dataDir, { recursive: true });
} catch {
  // Directory already exists
}

interface RunningProcess {
  child: Deno.ChildProcess;
  stdinWriter: WritableStreamDefaultWriter<Uint8Array>;
  logs: string[];
  startedAt: number;
}

const activeServers = new Map<string, RunningProcess>();

// Helper to append server log line
function appendLog(serverId: string, line: string) {
  const instance = activeServers.get(serverId);
  if (instance) {
    if (instance.logs.length > 500) {
      instance.logs.shift();
    }
    instance.logs.push(line);
  }
}

// Start Minecraft process
async function startServerProcess(
  serverId: string,
  serverPath: string,
  ramMb: number = 2048,
  jarFile: string = "server.jar"
): Promise<boolean> {
  if (activeServers.has(serverId)) {
    return false;
  }

  // Ensure eula.txt exists
  try {
    await Deno.writeTextFile(`${serverPath}/eula.txt`, "eula=true\n");
  } catch {
    // Ignore error
  }

  // Ensure server.jar exists, download if missing
  try {
    await Deno.stat(`${serverPath}/${jarFile}`);
  } catch {
    appendLog(serverId, `[Wings] ${jarFile} not found. Downloading official Minecraft 1.20.4 server jar...`);
    try {
      const jarUrl = "https://piston-data.mojang.com/v1/objects/8dd1a28015f51b1803213892b50b7b4fc76e594d/server.jar";
      const jarRes = await fetch(jarUrl);
      if (jarRes.ok) {
        const buffer = await jarRes.arrayBuffer();
        await Deno.writeFile(`${serverPath}/${jarFile}`, new Uint8Array(buffer));
        appendLog(serverId, `[Wings] server.jar downloaded successfully.`);
      } else {
        appendLog(serverId, `[Wings] Failed to download server.jar (HTTP ${jarRes.status})`);
        return false;
      }
    } catch (e: any) {
      appendLog(serverId, `[Wings] Download error: ${e.message}`);
      return false;
    }
  }

  const cmd = new Deno.Command("java", {
    args: [
      `-Xms${Math.round(ramMb / 2)}M`,
      `-Xmx${ramMb}M`,
      "-jar",
      jarFile,
      "nogui",
    ],
    cwd: serverPath,
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });

  const child = cmd.spawn();
  const stdinWriter = child.stdin.getWriter();
  const logs: string[] = [`[Wings] Instance starting with ${ramMb}MB RAM...`];

  const runningInstance: RunningProcess = {
    child,
    stdinWriter,
    logs,
    startedAt: Date.now(),
  };

  activeServers.set(serverId, runningInstance);

  // Pipe stdout
  (async () => {
    const reader = child.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) appendLog(serverId, line);
        }
      }
    } catch {
      // Reader closed
    }
  })();

  // Pipe stderr
  (async () => {
    const reader = child.stderr.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) appendLog(serverId, `[STDERR] ${line}`);
        }
      }
    } catch {
      // Reader closed
    }
  })();

  // Monitor process completion
  child.status.then(() => {
    activeServers.delete(serverId);
  });

  return true;
}

// Stop Minecraft process gracefully
async function stopServerProcess(serverId: string): Promise<boolean> {
  const instance = activeServers.get(serverId);
  if (!instance) return false;

  const encoder = new TextEncoder();
  try {
    await instance.stdinWriter.write(encoder.encode("stop\n"));
  } catch {
    instance.child.kill("SIGTERM");
  }

  // Force kill if not closed within 15 seconds
  setTimeout(() => {
    if (activeServers.has(serverId)) {
      try {
        instance.child.kill("SIGKILL");
      } catch {
        // Already dead
      }
      activeServers.delete(serverId);
    }
  }, 15000);

  return true;
}

// Send command into server stdin
async function sendCommand(serverId: string, command: string): Promise<boolean> {
  const instance = activeServers.get(serverId);
  if (!instance) return false;

  const encoder = new TextEncoder();
  await instance.stdinWriter.write(encoder.encode(`${command.replace(/^\//, "")}\n`));
  appendLog(serverId, `> ${command}`);
  return true;
}

// HTTP Server
Deno.serve({ port }, async (req) => {
  const url = new URL(req.url);

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }



  const jsonResponse = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // GET /api/status - Node status
  if (req.method === "GET" && url.pathname === "/api/status") {
    return jsonResponse({
      status: "online",
      version: "1.0.0",
      activeServersCount: activeServers.size,
      uptimeSeconds: Math.round(performance.now() / 1000),
      timestamp: Date.now(),
    });
  }

  // GET /api/servers - List all server directories & statuses
  if (req.method === "GET" && url.pathname === "/api/servers") {
    const serversList = [];
    try {
      for await (const entry of Deno.readDir(dataDir)) {
        if (entry.isDirectory) {
          const isRunning = activeServers.has(entry.name);
          serversList.push({
            id: entry.name,
            name: entry.name,
            status: isRunning ? "online" : "offline",
            path: `${dataDir}/${entry.name}`,
          });
        }
      }
    } catch {
      // Ignore read errors
    }
    return jsonResponse({ servers: serversList });
  }

  // POST /api/servers/create - Create server directory and configs
  if (req.method === "POST" && url.pathname === "/api/servers/create") {
    try {
      const body = await req.json();
      const serverId = body.id || `mc-${Date.now()}`;
      const serverPath = `${dataDir}/${serverId}`;

      await Deno.mkdir(serverPath, { recursive: true });
      await Deno.writeTextFile(`${serverPath}/eula.txt`, "eula=true\n");

      // Write basic server.properties
      const port = body.port || 25565;
      const motd = body.motd || "A NetLink Minecraft Server";
      const maxPlayers = body.maxPlayers || 20;

      const properties = [
        `server-port=${port}`,
        `motd=${motd}`,
        `max-players=${maxPlayers}`,
        `gamemode=${body.gamemode || "survival"}`,
        `difficulty=${body.difficulty || "easy"}`,
        `pvp=${body.pvp !== false}`,
        `online-mode=${body.onlineMode !== false}`,
      ].join("\n");

      await Deno.writeTextFile(`${serverPath}/server.properties`, properties);

      return jsonResponse({
        success: true,
        serverId,
        serverPath,
      });
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }

  // Route matches for /api/servers/:id/...
  const serverPathMatch = url.pathname.match(/^\/api\/servers\/([^\/]+)\/(power|command|logs)$/);
  if (serverPathMatch) {
    const [, serverId, action] = serverPathMatch;
    const serverPath = `${dataDir}/${serverId}`;

    if (action === "power" && req.method === "POST") {
      const body = await req.json();
      const powerAction = body.action; // start | stop | restart | kill

      if (powerAction === "start") {
        const started = await startServerProcess(serverId, serverPath, body.ramMb || 2048, body.jarFile || "server.jar");
        return jsonResponse({ success: started });
      } else if (powerAction === "stop") {
        const stopped = await stopServerProcess(serverId);
        return jsonResponse({ success: stopped });
      } else if (powerAction === "restart") {
        await stopServerProcess(serverId);
        setTimeout(() => {
          startServerProcess(serverId, serverPath, body.ramMb || 2048, body.jarFile || "server.jar");
        }, 3000);
        return jsonResponse({ success: true, message: "Restarting" });
      } else if (powerAction === "kill") {
        const instance = activeServers.get(serverId);
        if (instance) {
          instance.child.kill("SIGKILL");
          activeServers.delete(serverId);
        }
        return jsonResponse({ success: true });
      }
    }

    if (action === "command" && req.method === "POST") {
      const body = await req.json();
      const executed = await sendCommand(serverId, body.command || "");
      return jsonResponse({ success: executed });
    }

    if (action === "logs" && req.method === "GET") {
      const instance = activeServers.get(serverId);
      let logs = instance ? instance.logs : [];

      // Fallback to read latest.log if offline
      if (logs.length === 0) {
        try {
          const logContent = await Deno.readTextFile(`${serverPath}/logs/latest.log`);
          logs = logContent.split("\n").slice(-200);
        } catch {
          // No log file
        }
      }

      return jsonResponse({ logs });
    }
  }

  return jsonResponse({ error: "Not Found" }, 404);
});
