// Process Manager Module for Minecraft Wings Daemon
// Handles Java process spawning, stdin/stdout streaming, and graceful shutdown.

export interface RunningProcess {
  child: Deno.ChildProcess;
  stdinWriter: WritableStreamDefaultWriter<Uint8Array>;
  logs: string[];
  startedAt: number;
}

export const activeServers = new Map<string, RunningProcess>();

// Helper to append log messages with max buffer of 500 lines
export function appendLog(serverId: string, line: string): void {
  const instance = activeServers.get(serverId);
  if (instance) {
    if (instance.logs.length > 500) {
      instance.logs.shift();
    }
    instance.logs.push(line);
  }
}

// Start Minecraft process
export async function startServerProcess(
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
export async function stopServerProcess(serverId: string): Promise<boolean> {
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
export async function sendCommand(serverId: string, command: string): Promise<boolean> {
  const instance = activeServers.get(serverId);
  if (!instance) return false;

  const encoder = new TextEncoder();
  await instance.stdinWriter.write(encoder.encode(`${command.replace(/^\//, "")}\n`));
  appendLog(serverId, `> ${command}`);
  return true;
}
