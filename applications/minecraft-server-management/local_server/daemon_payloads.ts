export const DEFAULT_INSTALLER_SCRIPT = `#!/usr/bin/env bash
set -e

INSTALL_DIR="/opt/netlink-wings"
DATA_DIR="/var/lib/netlink-wings/servers"
SERVICE_NAME="netlink-mc-wings"
PORT="\${DAEMON_PORT:-8080}"
TOKEN="\${DAEMON_TOKEN:-netlink-secret-token}"

echo "[1/5] Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$DATA_DIR"

echo "[2/5] Checking prerequisites..."
if ! command -v java &> /dev/null; then
    echo "Java not found. Attempting to install OpenJDK..."
    if command -v apt-get &> /dev/null; then
        apt-get update -y && apt-get install -y openjdk-17-jre-headless curl
    elif command -v yum &> /dev/null; then
        yum install -y java-17-openjdk-headless curl
    elif command -v apk &> /dev/null; then
        apk add openjdk17-jre curl
    else
        echo "Warning: Package manager not recognized. Please install Java 17+ manually."
    fi
fi

if ! command -v deno &> /dev/null; then
    echo "Installing Deno runtime..."
    curl -fsSL https://deno.land/install.sh | sh
    export DENO_INSTALL="$HOME/.deno"
    export PATH="$DENO_INSTALL/bin:$PATH"
    cp "$HOME/.deno/bin/deno" /usr/local/bin/deno 2>/dev/null || true
fi

echo "[3/5] Setting up Wings daemon environment..."
cat << 'EOF' > "$INSTALL_DIR/wings.env"
PORT=8080
DATA_DIR=/var/lib/netlink-wings/servers
AUTH_TOKEN=netlink-secret-token
EOF

echo "[4/5] Creating systemd service..."
cat << EOF > /etc/systemd/system/\${SERVICE_NAME}.service
[Unit]
Description=NetLink Minecraft Wings Daemon
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/wings.env
ExecStart=/usr/local/bin/deno run --allow-all $INSTALL_DIR/wings.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "[5/5] Enabling and starting service..."
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo "NetLink Wings Daemon installed and running on port $PORT."
`;

export const DEFAULT_WINGS_SCRIPT = `const port = parseInt(Deno.env.get("PORT") || "8080");
const dataDir = Deno.env.get("DATA_DIR") || "/var/lib/netlink-wings/servers";
const authToken = Deno.env.get("AUTH_TOKEN") || "";

try {
  await Deno.mkdir(dataDir, { recursive: true });
} catch {
  // Directory exists
}

interface RunningProcess {
  child: Deno.ChildProcess;
  stdinWriter: WritableStreamDefaultWriter<Uint8Array>;
  logs: string[];
  startedAt: number;
}

const activeServers = new Map<string, RunningProcess>();

function appendLog(serverId: string, line: string) {
  const instance = activeServers.get(serverId);
  if (instance) {
    if (instance.logs.length > 500) {
      instance.logs.shift();
    }
    instance.logs.push(line);
  }
}

async function startServerProcess(
  serverId: string,
  serverPath: string,
  ramMb: number = 2048,
  jarFile: string = "server.jar"
): Promise<boolean> {
  if (activeServers.has(serverId)) return false;

  try {
    await Deno.writeTextFile(\`\${serverPath}/eula.txt\`, "eula=true\\n");
  } catch {
    // Ignore
  }

  const cmd = new Deno.Command("java", {
    args: [\`-Xms\${Math.round(ramMb / 2)}M\`, \`-Xmx\${ramMb}M\`, "-jar", jarFile, "nogui"],
    cwd: serverPath,
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });

  const child = cmd.spawn();
  const stdinWriter = child.stdin.getWriter();
  const logs: string[] = [\`[Wings] Instance starting with \${ramMb}MB RAM...\`];

  activeServers.set(serverId, { child, stdinWriter, logs, startedAt: Date.now() });

  (async () => {
    const reader = child.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) appendLog(serverId, line);
        }
      }
    } catch {
      // Reader closed
    }
  })();

  (async () => {
    const reader = child.stderr.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) appendLog(serverId, \`[STDERR] \${line}\`);
        }
      }
    } catch {
      // Reader closed
    }
  })();

  child.status.then(() => {
    activeServers.delete(serverId);
  });

  return true;
}

async function stopServerProcess(serverId: string): Promise<boolean> {
  const instance = activeServers.get(serverId);
  if (!instance) return false;
  const encoder = new TextEncoder();
  try {
    await instance.stdinWriter.write(encoder.encode("stop\\n"));
  } catch {
    instance.child.kill("SIGTERM");
  }
  return true;
}

async function sendCommand(serverId: string, command: string): Promise<boolean> {
  const instance = activeServers.get(serverId);
  if (!instance) return false;
  const encoder = new TextEncoder();
  await instance.stdinWriter.write(encoder.encode(\`\${command.replace(/^\\//, "")}\\n\`));
  appendLog(serverId, \`> \${command}\`);
  return true;
}

Deno.serve({ port }, async (req) => {
  const url = new URL(req.url);
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

  if (req.method === "GET" && url.pathname === "/api/status") {
    return jsonResponse({
      status: "online",
      version: "1.0.0",
      activeServersCount: activeServers.size,
      uptimeSeconds: Math.round(performance.now() / 1000),
      timestamp: Date.now(),
    });
  }

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
            path: \`\${dataDir}/\${entry.name}\`,
          });
        }
      }
    } catch {
      // Ignore
    }
    return jsonResponse({ servers: serversList });
  }

  if (req.method === "POST" && url.pathname === "/api/servers/create") {
    try {
      const body = await req.json();
      const serverId = body.id || \`mc-\${Date.now()}\`;
      const serverPath = \`\${dataDir}/\${serverId}\`;

      await Deno.mkdir(serverPath, { recursive: true });
      await Deno.writeTextFile(\`\${serverPath}/eula.txt\`, "eula=true\\n");

      const properties = [
        \`server-port=\${body.port || 25565}\`,
        \`motd=\${body.motd || "A NetLink Minecraft Server"}\`,
        \`max-players=\${body.maxPlayers || 20}\`,
        \`gamemode=\${body.gamemode || "survival"}\`,
        \`difficulty=\${body.difficulty || "easy"}\`,
        \`pvp=\${body.pvp !== false}\`,
        \`online-mode=\${body.onlineMode !== false}\`,
      ].join("\\n");

      await Deno.writeTextFile(\`\${serverPath}/server.properties\`, properties);
      return jsonResponse({ success: true, serverId, serverPath });
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }

  const serverPathMatch = url.pathname.match(/^\\/api\\/servers\\/([^\\/]+)\\/(power|command|logs)$/);
  if (serverPathMatch) {
    const [, serverId, action] = serverPathMatch;
    const serverPath = \`\${dataDir}/\${serverId}\`;

    if (action === "power" && req.method === "POST") {
      const body = await req.json();
      if (body.action === "start") {
        const started = await startServerProcess(serverId, serverPath, body.ramMb || 2048, body.jarFile || "server.jar");
        return jsonResponse({ success: started });
      } else if (body.action === "stop") {
        const stopped = await stopServerProcess(serverId);
        return jsonResponse({ success: stopped });
      } else if (body.action === "kill") {
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
      if (logs.length === 0) {
        try {
          const logContent = await Deno.readTextFile(\`\${serverPath}/logs/latest.log\`);
          logs = logContent.split("\\n").slice(-200);
        } catch {
          // No logs
        }
      }
      return jsonResponse({ logs });
    }
  }

  return jsonResponse({ error: "Not Found" }, 404);
});
`;
