// Node Hardware & System Telemetry Module for Wings Daemon
// Collects host CPU load, physical RAM consumption, disk space, and OS metrics.

import { activeServers, getConfiguredResources } from "./process_manager.ts";

export interface NodeSystemStats {
  cpuPercent: number;
  cpuCores: number;
  memoryTotalMb: number;
  memoryUsedMb: number;
  memoryFreeMb: number;
  memoryPercent: number;
  diskTotalMb: number;
  diskUsedMb: number;
  diskFreeMb: number;
  diskPercent: number;
  loadAvg: [number, number, number];
  activeServersCount: number;
  totalAllocatedRamMb: number;
  daemonUptimeSeconds: number;
  nodeName?: string;
}

let lastTotalTicks = 0;
let lastIdleTicks = 0;

// Sample host CPU usage from /proc/stat
async function sampleHostCpuPercent(): Promise<number> {
  try {
    const text = await Deno.readTextFile("/proc/stat");
    const firstLine = text.split("\n")[0];
    const parts = firstLine.split(/\s+/).slice(1).map(Number);
    const idleTicks = parts[3] + (parts[4] || 0); // idle + iowait
    const totalTicks = parts.reduce((acc, v) => acc + v, 0);

    let percent = 0;
    if (lastTotalTicks > 0 && lastIdleTicks > 0) {
      const totalDiff = totalTicks - lastTotalTicks;
      const idleDiff = idleTicks - lastIdleTicks;
      if (totalDiff > 0) {
        percent = Math.round(((totalDiff - idleDiff) / totalDiff) * 1000) / 10;
      }
    }
    lastTotalTicks = totalTicks;
    lastIdleTicks = idleTicks;
    return Math.max(0, Math.min(percent, 100));
  } catch {
    return 0;
  }
}

// Sample host Memory from /proc/meminfo
async function sampleHostMemory(): Promise<{ totalMb: number; usedMb: number; freeMb: number; percent: number }> {
  try {
    const text = await Deno.readTextFile("/proc/meminfo");
    const memTotalMatch = text.match(/MemTotal:\s+(\d+)\s+kB/);
    const memAvailMatch = text.match(/MemAvailable:\s+(\d+)\s+kB/);

    if (memTotalMatch && memAvailMatch) {
      const totalMb = Math.round(parseInt(memTotalMatch[1], 10) / 1024);
      const availMb = Math.round(parseInt(memAvailMatch[1], 10) / 1024);
      const usedMb = Math.max(totalMb - availMb, 0);
      const percent = totalMb > 0 ? Math.round((usedMb / totalMb) * 100) : 0;
      return { totalMb, usedMb, freeMb: availMb, percent };
    }
  } catch {}
  return { totalMb: 8192, usedMb: 2048, freeMb: 6144, percent: 25 };
}

// Sample Disk usage using df command
async function sampleHostDisk(dataDir: string): Promise<{ totalMb: number; usedMb: number; freeMb: number; percent: number }> {
  try {
    const cmd = new Deno.Command("df", {
      args: ["-m", dataDir],
      stdout: "piped",
    });
    const { stdout } = await cmd.output();
    const text = new TextDecoder().decode(stdout);
    const lines = text.trim().split("\n");
    if (lines.length > 1) {
      const parts = lines[1].trim().split(/\s+/);
      const totalMb = parseInt(parts[1], 10) || 0;
      const usedMb = parseInt(parts[2], 10) || 0;
      const freeMb = parseInt(parts[3], 10) || 0;
      const percent = totalMb > 0 ? Math.round((usedMb / totalMb) * 100) : 0;
      return { totalMb, usedMb, freeMb, percent };
    }
  } catch {}
  return { totalMb: 100000, usedMb: 15000, freeMb: 85000, percent: 15 };
}

// Sample Load Average from /proc/loadavg
async function sampleLoadAvg(): Promise<[number, number, number]> {
  try {
    const text = await Deno.readTextFile("/proc/loadavg");
    const parts = text.trim().split(/\s+/);
    return [parseFloat(parts[0]) || 0, parseFloat(parts[1]) || 0, parseFloat(parts[2]) || 0];
  } catch {
    return [0, 0, 0];
  }
}

// Full Node System Stats Aggregator
export async function getNodeSystemStats(dataDir: string): Promise<NodeSystemStats> {
  const [cpuPercent, mem, disk, loadAvg] = await Promise.all([
    sampleHostCpuPercent(),
    sampleHostMemory(),
    sampleHostDisk(dataDir),
    sampleLoadAvg(),
  ]);

  // Calculate total allocated RAM across all instances
  let totalAllocatedRamMb = 0;
  try {
    for await (const entry of Deno.readDir(dataDir)) {
      if (entry.isDirectory) {
        const res = await getConfiguredResources(`${dataDir}/${entry.name}`);
        totalAllocatedRamMb += res.ramMb;
      }
    }
  } catch {}

  const cpuCores = navigator.hardwareConcurrency || 4;
  const daemonUptimeSeconds = Math.round(performance.now() / 1000);

  return {
    cpuPercent,
    cpuCores,
    memoryTotalMb: mem.totalMb,
    memoryUsedMb: mem.usedMb,
    memoryFreeMb: mem.freeMb,
    memoryPercent: mem.percent,
    diskTotalMb: disk.totalMb,
    diskUsedMb: disk.usedMb,
    diskFreeMb: disk.freeMb,
    diskPercent: disk.percent,
    loadAvg,
    activeServersCount: activeServers.size,
    totalAllocatedRamMb,
    daemonUptimeSeconds,
  };
}
