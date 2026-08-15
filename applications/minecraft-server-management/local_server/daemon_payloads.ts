// Payload loader for Minecraft Wings Daemon
// Reads .sh and .ts scripts directly from the daemon/scripts/ or daemon/ directory with built-in fallbacks.

export async function readDaemonFile(fileName: string): Promise<string | null> {
  try {
    const daemonDir = new URL("../daemon", import.meta.url).pathname;
    try {
      return await Deno.readTextFile(`${daemonDir}/scripts/${fileName}`);
    } catch {
      return await Deno.readTextFile(`${daemonDir}/${fileName}`);
    }
  } catch {
    return null;
  }
}

export const DEFAULT_INSTALLER_SCRIPT = `#!/usr/bin/env bash
set -e

INSTALL_DIR="\${INSTALL_DIR:-/opt/netlink-wings}"
DATA_DIR="\${DATA_DIR:-/var/lib/netlink-wings/servers}"
SERVICE_NAME="\${SERVICE_NAME:-netlink-mc-wings}"
PORT="\${DAEMON_PORT:-9080}"
TOKEN="\${DAEMON_TOKEN:-netlink-secret-token}"

mkdir -p "$INSTALL_DIR"
mkdir -p "$DATA_DIR"

if ! command -v java &> /dev/null; then
    if command -v apt-get &> /dev/null; then
        apt-get update -y && apt-get install -y openjdk-17-jre-headless curl unzip tar
    elif command -v dnf &> /dev/null; then
        dnf install -y java-17-openjdk-headless curl unzip tar
    elif command -v yum &> /dev/null; then
        yum install -y java-17-openjdk-headless curl unzip tar
    elif command -v apk &> /dev/null; then
        apk add openjdk17-jre curl unzip tar
    elif command -v pacman &> /dev/null; then
        pacman -Sy --noconfirm jre17-openjdk-headless curl unzip tar
    elif command -v zypper &> /dev/null; then
        zypper install -y java-17-openjdk-headless curl unzip tar
    fi
fi

if ! command -v deno &> /dev/null; then
    curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh || curl -fsSL https://deno.land/install.sh | sh
    export DENO_INSTALL="$HOME/.deno"
    export PATH="$DENO_INSTALL/bin:$PATH:/usr/local/bin"
    if [ -f "$HOME/.deno/bin/deno" ] && [ ! -f "/usr/local/bin/deno" ]; then
        cp "$HOME/.deno/bin/deno" /usr/local/bin/deno 2>/dev/null || true
    fi
fi

cat << EOF > "$INSTALL_DIR/wings.env"
PORT=$PORT
DATA_DIR=$DATA_DIR
AUTH_TOKEN=$TOKEN
EOF
chmod 600 "$INSTALL_DIR/wings.env"

DENO_BIN="\$(command -v deno || echo "/usr/local/bin/deno")"

cat << EOF > /etc/systemd/system/\${SERVICE_NAME}.service
[Unit]
Description=NetLink Minecraft Wings Daemon
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/wings.env
ExecStart=$DENO_BIN run --allow-all $INSTALL_DIR/wings.ts
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
`;

export const DEFAULT_BOOTSTRAP_SCRIPT = `#!/usr/bin/env bash
set -e

TMP_SETUP_DIR="/tmp/netlink-wings-setup"
TARGET_DIR="\${INSTALL_DIR:-/opt/netlink-wings}"
PORT="\${DAEMON_PORT:-9080}"
TOKEN="\${DAEMON_TOKEN:-netlink-secret-token}"

mkdir -p "$TMP_SETUP_DIR"

if [ -n "$WINGS_PAYLOAD_B64" ]; then
    echo "$WINGS_PAYLOAD_B64" | base64 -d > "$TMP_SETUP_DIR/wings.ts"
fi

if [ -n "$INSTALLER_PAYLOAD_B64" ]; then
    echo "$INSTALLER_PAYLOAD_B64" | base64 -d > "$TMP_SETUP_DIR/installer.sh"
fi

if [ -f "$TMP_SETUP_DIR/installer.sh" ]; then
    chmod +x "$TMP_SETUP_DIR/installer.sh"
fi

mkdir -p "$TARGET_DIR"

if [ -f "$TMP_SETUP_DIR/wings.ts" ]; then
    cp "$TMP_SETUP_DIR/wings.ts" "$TARGET_DIR/wings.ts"
fi

if [ -f "$TMP_SETUP_DIR/installer.sh" ]; then
    cp "$TMP_SETUP_DIR/installer.sh" "$TARGET_DIR/installer.sh"
    chmod +x "$TARGET_DIR/installer.sh"
fi

export DAEMON_PORT="$PORT"
export DAEMON_TOKEN="$TOKEN"
export INSTALL_DIR="$TARGET_DIR"

if [ -f "$TARGET_DIR/installer.sh" ]; then
    bash "$TARGET_DIR/installer.sh"
fi

rm -rf "$TMP_SETUP_DIR"
`;

export const DEFAULT_UNINSTALL_SCRIPT = `#!/usr/bin/env bash
set -e

INSTALL_DIR="\${INSTALL_DIR:-/opt/netlink-wings}"
DATA_DIR="\${DATA_DIR:-/var/lib/netlink-wings/servers}"
SERVICE_NAME="\${SERVICE_NAME:-netlink-mc-wings}"

if systemctl is-active --quiet "$SERVICE_NAME"; then
    systemctl stop "$SERVICE_NAME" || true
fi

if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    systemctl disable "$SERVICE_NAME" || true
fi

if [ -f "/etc/systemd/system/\${SERVICE_NAME}.service" ]; then
    rm -f "/etc/systemd/system/\${SERVICE_NAME}.service"
    systemctl daemon-reload
fi

if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
fi

if [ "$1" == "--purge-data" ]; then
    rm -rf "$DATA_DIR"
fi
`;

export const DEFAULT_SERVICE_SCRIPT = `#!/usr/bin/env bash
set -e

SERVICE_NAME="\${SERVICE_NAME:-netlink-mc-wings}"
ACTION="\${1:-status}"

case "$ACTION" in
    start)
        systemctl start "$SERVICE_NAME"
        systemctl status "$SERVICE_NAME" --no-pager
        ;;
    stop)
        systemctl stop "$SERVICE_NAME"
        ;;
    restart)
        systemctl restart "$SERVICE_NAME"
        systemctl status "$SERVICE_NAME" --no-pager
        ;;
    status)
        systemctl status "$SERVICE_NAME" --no-pager
        ;;
    logs)
        if [ "$2" == "-f" ] || [ "$2" == "--follow" ]; then
            journalctl -u "$SERVICE_NAME" -f
        else
            journalctl -u "$SERVICE_NAME" -n 100 --no-pager
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs [-f]}"
        exit 1
        ;;
esac
`;

export const DEFAULT_RUN_SERVER_SCRIPT = `#!/usr/bin/env bash
set -e

SERVER_DIR="\${1:-.}"
RAM_MB="\${2:-2048}"
JAR_FILE="\${3:-server.jar}"
MIN_RAM_MB=$((RAM_MB / 2))

if [ ! -d "$SERVER_DIR" ]; then
    mkdir -p "$SERVER_DIR"
fi

cd "$SERVER_DIR"

if [ ! -f "eula.txt" ]; then
    echo "eula=true" > "eula.txt"
fi

if [ ! -f "$JAR_FILE" ]; then
    JAR_URL="https://piston-data.mojang.com/v1/objects/8dd1a28015f51b1803213892b50b7b4fc76e594d/server.jar"
    curl -fsSL -o "$JAR_FILE" "$JAR_URL"
fi

exec java -Xms"\${MIN_RAM_MB}M" -Xmx"\${RAM_MB}M" -jar "$JAR_FILE" nogui
`;

export const DEFAULT_WINGS_SCRIPT = `const port = parseInt(Deno.env.get("PORT") || "9080");
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

function resolveSafePath(baseDir: string, relPath: string = ""): string | null {
  const normalized = relPath.replace(/^(\.\.(\/|\\\\|$))+/, "").replace(/^\\/+/, "");
  const parts = normalized.split(/[\\/\\\\]/).filter((p) => p && p !== "." && p !== "..");
  const safePath = parts.length > 0 ? \`\${baseDir}/\${parts.join("/")}\` : baseDir;
  return safePath.startsWith(baseDir) ? safePath : null;
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

  try {
    await Deno.stat(\`\${serverPath}/\${jarFile}\`);
  } catch {
    appendLog(serverId, \`[Wings] \${jarFile} not found. Downloading official Minecraft 1.20.4 server jar...\`);
    try {
      const jarUrl = "https://piston-data.mojang.com/v1/objects/8dd1a28015f51b1803213892b50b7b4fc76e594d/server.jar";
      const jarRes = await fetch(jarUrl);
      if (jarRes.ok) {
        const buffer = await jarRes.arrayBuffer();
        await Deno.writeFile(\`\${serverPath}/\${jarFile}\`, new Uint8Array(buffer));
        appendLog(serverId, "[Wings] server.jar downloaded successfully.");
      } else {
        appendLog(serverId, \`[Wings] Failed to download server.jar (HTTP \${jarRes.status})\`);
        return false;
      }
    } catch (e: any) {
      appendLog(serverId, \`[Wings] Download error: \${e.message}\`);
      return false;
    }
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
      // Closed
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
      // Closed
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

  const filesPathMatch = url.pathname.match(/^\\/api\\/servers\\/([^\\/]+)\\/files(\\/content|\\/save|\\/delete|\\/create-folder)?$/);
  if (filesPathMatch) {
    const [, serverId, fileAction] = filesPathMatch;
    const serverPath = \`\${dataDir}/\${serverId}\`;

    try {
      if (!fileAction && req.method === "GET") {
        const subPath = url.searchParams.get("path") || "";
        const targetDir = resolveSafePath(serverPath, subPath);
        if (!targetDir) return jsonResponse({ error: "Invalid path" }, 400);

        const files = [];
        for await (const entry of Deno.readDir(targetDir)) {
          let size = 0;
          let modifiedTime = Date.now();
          try {
            const stat = await Deno.stat(\`\${targetDir}/\${entry.name}\`);
            size = stat.size;
            if (stat.mtime) modifiedTime = stat.mtime.getTime();
          } catch {}

          const relFilePath = subPath ? \`\${subPath}/\${entry.name}\` : entry.name;
          files.push({
            name: entry.name,
            isDirectory: entry.isDirectory,
            size,
            modifiedTime,
            path: relFilePath,
          });
        }

        files.sort((a, b) => (a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1));
        return jsonResponse({ files, currentPath: subPath });
      }

      if (fileAction === "/content" && req.method === "GET") {
        const filePath = url.searchParams.get("path") || "";
        const targetFile = resolveSafePath(serverPath, filePath);
        if (!targetFile) return jsonResponse({ error: "Invalid file path" }, 400);
        const content = await Deno.readTextFile(targetFile);
        return jsonResponse({ content, path: filePath });
      }

      if (fileAction === "/save" && req.method === "POST") {
        const body = await req.json();
        const targetFile = resolveSafePath(serverPath, body.path || "");
        if (!targetFile) return jsonResponse({ error: "Invalid file path" }, 400);
        await Deno.writeTextFile(targetFile, body.content ?? "");
        return jsonResponse({ success: true, path: body.path });
      }

      if (fileAction === "/delete" && req.method === "POST") {
        const body = await req.json();
        const target = resolveSafePath(serverPath, body.path || "");
        if (!target || target === serverPath) return jsonResponse({ error: "Cannot delete server root" }, 400);
        await Deno.remove(target, { recursive: true });
        return jsonResponse({ success: true, path: body.path });
      }

      if (fileAction === "/create-folder" && req.method === "POST") {
        const body = await req.json();
        const target = resolveSafePath(serverPath, body.path || "");
        if (!target) return jsonResponse({ error: "Invalid path" }, 400);
        await Deno.mkdir(target, { recursive: true });
        return jsonResponse({ success: true, path: body.path });
      }
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }

  const serverPathMatch = url.pathname.match(/^\\/api\\/servers\\/([^\\/]+)\\/(power|command|logs)$/);
  if (serverPathMatch) {
    const [, serverId, action] = serverPathMatch;
    const serverPath = \`\${dataDir}/\${serverId}\`;

    if (action === "power" && req.method === "POST") {
      const body = await req.json();
      if (body.action === "start") {
        const started = await startServerProcess(serverId, serverPath, body.ramMb || 1024, body.jarFile || "server.jar");
        return jsonResponse({ success: started });
      } else if (body.action === "stop") {
        const stopped = await stopServerProcess(serverId);
        return jsonResponse({ success: stopped });
      } else if (body.action === "restart") {
        await stopServerProcess(serverId);
        setTimeout(() => {
          startServerProcess(serverId, serverPath, body.ramMb || 1024, body.jarFile || "server.jar");
        }, 3000);
        return jsonResponse({ success: true });
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
        } catch {}
      }
      return jsonResponse({ logs });
    }
  }

  return jsonResponse({ error: "Not Found" }, 404);
});
`;
