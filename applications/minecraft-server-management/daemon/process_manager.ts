// Process Manager Module for Minecraft Wings Daemon
// Handles Java process spawning, stdin/stdout streaming, graceful shutdown, and real-time resource telemetry.

export interface RunningProcess {
  child: Deno.ChildProcess;
  stdinWriter: WritableStreamDefaultWriter<Uint8Array>;
  logs: string[];
  startedAt: number;
  ramLimitMb: number;
  lastCpuTime?: number;
  lastSampleTime?: number;
}

export interface ServerStats {
  cpuPercent: number;
  memoryMb: number;
  memoryLimitMb: number;
  diskMb: number;
  uptimeSeconds: number;
  status: "online" | "offline";
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

// Calculate directory disk space in MB
async function getDirectorySizeMb(dirPath: string): Promise<number> {
  let totalBytes = 0;
  try {
    for await (const entry of Deno.readDir(dirPath)) {
      const fullPath = `${dirPath}/${entry.name}`;
      try {
        const stat = await Deno.stat(fullPath);
        if (stat.isFile) {
          totalBytes += stat.size;
        } else if (stat.isDirectory) {
          // One level shallow sub-directory sum to remain fast
          for await (const sub of Deno.readDir(fullPath)) {
            try {
              const subStat = await Deno.stat(`${fullPath}/${sub.name}`);
              if (subStat.isFile) totalBytes += subStat.size;
            } catch {}
          }
        }
      } catch {}
    }
  } catch {}
  return Math.round((totalBytes / (1024 * 1024)) * 10) / 10;
}

// Get configured RAM limit for instance
export async function getConfiguredRamMb(serverPath: string): Promise<number> {
  try {
    const raw = await Deno.readTextFile(`${serverPath}/instance_config.json`);
    const cfg = JSON.parse(raw);
    if (typeof cfg.ramMb === "number" && cfg.ramMb > 0) return cfg.ramMb;
  } catch {}
  return 1024;
}

// Save configured RAM limit for instance
export async function saveConfiguredRamMb(serverPath: string, ramMb: number): Promise<void> {
  let cfg: Record<string, any> = {};
  try {
    const raw = await Deno.readTextFile(`${serverPath}/instance_config.json`);
    cfg = JSON.parse(raw);
  } catch {}
  cfg.ramMb = ramMb;
  await Deno.writeTextFile(`${serverPath}/instance_config.json`, JSON.stringify(cfg, null, 2));
}

// Sample real-time server process metrics (CPU, RAM, Disk, Uptime)
export async function getServerProcessStats(serverId: string, serverPath: string): Promise<ServerStats> {
  const instance = activeServers.get(serverId);
  const diskMb = await getDirectorySizeMb(serverPath);
  const configuredRam = await getConfiguredRamMb(serverPath);

  if (!instance) {
    return {
      cpuPercent: 0,
      memoryMb: 0,
      memoryLimitMb: configuredRam,
      diskMb,
      uptimeSeconds: 0,
      status: "offline",
    };
  }

  const pid = instance.child.pid;
  let memoryMb = 0;
  let cpuPercent = 0;

  try {
    // Read Linux /proc/<pid>/status for VmRSS
    const statusText = await Deno.readTextFile(`/proc/${pid}/status`);
    const rssMatch = statusText.match(/VmRSS:\s+(\d+)\s+kB/);
    if (rssMatch) {
      memoryMb = Math.round((parseInt(rssMatch[1], 10) / 1024) * 10) / 10;
    }

    // Read Linux /proc/<pid>/stat for CPU utime + stime
    const statText = await Deno.readTextFile(`/proc/${pid}/stat`);
    const statParts = statText.split(" ");
    if (statParts.length > 14) {
      const utime = parseInt(statParts[13], 10);
      const stime = parseInt(statParts[14], 10);
      const totalCpuTicks = utime + stime;
      const now = performance.now();

      if (instance.lastCpuTime !== undefined && instance.lastSampleTime !== undefined) {
        const timeDiffSeconds = (now - instance.lastSampleTime) / 1000;
        const ticksDiff = totalCpuTicks - instance.lastCpuTime;
        if (timeDiffSeconds > 0) {
          // Approx 100 ticks per second per core
          const calculatedPercent = (ticksDiff / 100 / timeDiffSeconds) * 100;
          cpuPercent = Math.min(Math.round(Math.max(calculatedPercent, 0) * 10) / 10, 400);
        }
      }
      instance.lastCpuTime = totalCpuTicks;
      instance.lastSampleTime = now;
    }
  } catch {
    // Fallback estimate if /proc unavailable
    memoryMb = Math.round(instance.ramLimitMb * 0.45);
  }

  const uptimeSeconds = Math.round((Date.now() - instance.startedAt) / 1000);

  return {
    cpuPercent,
    memoryMb,
    memoryLimitMb: instance.ramLimitMb || configuredRam,
    diskMb,
    uptimeSeconds,
    status: "online",
  };
}

// Start Minecraft process
export async function startServerProcess(
  serverId: string,
  serverPath: string,
  requestedRamMb?: number,
  jarFile: string = "server.jar"
): Promise<boolean> {
  if (activeServers.has(serverId)) {
    return false;
  }

  const ramMb = requestedRamMb || (await getConfiguredRamMb(serverPath));

  // Ensure eula.txt exists
  try {
    await Deno.writeTextFile(`${serverPath}/eula.txt`, "eula=true\n");
  } catch {}

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
    ramLimitMb: ramMb,
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
    } catch {}
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
    } catch {}
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
      } catch {}
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
