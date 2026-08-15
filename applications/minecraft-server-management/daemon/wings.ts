// NetLink Minecraft Wings Daemon - Main Router
// Imports process_manager, file_manager, server_manager, node_metrics, and backup_manager to serve the HTTP REST API.

import {
  activeServers,
  startServerProcess,
  stopServerProcess,
  sendCommand,
  getServerProcessStats,
  saveConfiguredResources,
} from "./process_manager.ts";
import {
  listServerFiles,
  readServerFileContent,
  saveServerFileContent,
  deleteServerFileItem,
  createServerDirectory,
} from "./file_manager.ts";
import {
  listAllServers,
  provisionServerInstance,
} from "./server_manager.ts";
import {
  getNodeSystemStats,
} from "./node_metrics.ts";
import {
  listBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  toggleLockBackup,
} from "./backup_manager.ts";

const port = parseInt(Deno.env.get("PORT") || "9080");
const dataDir = Deno.env.get("DATA_DIR") || "/var/lib/netlink-wings/servers";

// Ensure base data directory exists
try {
  await Deno.mkdir(dataDir, { recursive: true });
} catch {
  // Already exists
}

console.log(`[NetLink Wings Daemon] Starting on port ${port}...`);

Deno.serve({ port }, async (req) => {
  const url = new URL(req.url);

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

  // 1. GET /api/status - Daemon status
  if (req.method === "GET" && url.pathname === "/api/status") {
    return jsonResponse({
      status: "online",
      version: "1.0.1",
      activeServersCount: activeServers.size,
      uptimeSeconds: Math.round(performance.now() / 1000),
      timestamp: Date.now(),
    });
  }

  // 2. GET /api/node/system-stats - Node host machine hardware utilization & metrics
  if (req.method === "GET" && (url.pathname === "/api/node/system-stats" || url.pathname === "/api/node/stats")) {
    const stats = await getNodeSystemStats(dataDir);
    return jsonResponse(stats);
  }

  // 3. GET /api/servers - List all server directories & statuses
  if (req.method === "GET" && url.pathname === "/api/servers") {
    const activeIds = new Set(activeServers.keys());
    const servers = await listAllServers(dataDir, activeIds);
    return jsonResponse({ servers });
  }

  // 4. POST /api/servers/create - Create server instance
  if (req.method === "POST" && url.pathname === "/api/servers/create") {
    try {
      const body = await req.json();
      const result = await provisionServerInstance(dataDir, body);
      return jsonResponse({ success: true, ...result });
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }

  // 5. File Management routes: /api/servers/:id/files...
  const filesPathMatch = url.pathname.match(/^\/api\/servers\/([^\/]+)\/files(\/content|\/save|\/delete|\/create-folder)?$/);
  if (filesPathMatch) {
    const [, serverId, fileAction] = filesPathMatch;
    const serverPath = `${dataDir}/${serverId}`;

    try {
      // List files
      if (!fileAction && req.method === "GET") {
        const subPath = url.searchParams.get("path") || "";
        const files = await listServerFiles(serverPath, subPath);
        return jsonResponse({ files, currentPath: subPath });
      }

      // Read file content
      if (fileAction === "/content" && req.method === "GET") {
        const filePath = url.searchParams.get("path") || "";
        const content = await readServerFileContent(serverPath, filePath);
        return jsonResponse({ content, path: filePath });
      }

      // Save file content
      if (fileAction === "/save" && req.method === "POST") {
        const body = await req.json();
        await saveServerFileContent(serverPath, body.path || "", body.content ?? "");
        return jsonResponse({ success: true, path: body.path });
      }

      // Delete file or folder
      if (fileAction === "/delete" && req.method === "POST") {
        const body = await req.json();
        await deleteServerFileItem(serverPath, body.path || "");
        return jsonResponse({ success: true, path: body.path });
      }

      // Create directory
      if (fileAction === "/create-folder" && req.method === "POST") {
        const body = await req.json();
        await createServerDirectory(serverPath, body.path || "");
        return jsonResponse({ success: true, path: body.path });
      }
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }

  // 6. Backup Management routes: /api/servers/:id/backups...
  const backupsPathMatch = url.pathname.match(/^\/api\/servers\/([^\/]+)\/backups(\/create|\/([^\/]+)\/restore|\/([^\/]+)\/lock|\/([^\/]+))?$/);
  if (backupsPathMatch) {
    const [, serverId, subAction, restoreId, lockId, deleteId] = backupsPathMatch;
    const serverPath = `${dataDir}/${serverId}`;

    try {
      // GET /api/servers/:id/backups - List backups
      if (!subAction && req.method === "GET") {
        const backups = await listBackups(serverPath);
        return jsonResponse({ backups });
      }

      // POST /api/servers/:id/backups/create - Create backup
      if (subAction === "/create" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const backup = await createBackup(serverPath, body.name);
        return jsonResponse({ success: true, backup });
      }

      // POST /api/servers/:id/backups/:backupId/restore - Restore backup
      if (restoreId && req.method === "POST") {
        await restoreBackup(serverPath, restoreId);
        return jsonResponse({ success: true, message: "Backup restored successfully" });
      }

      // POST /api/servers/:id/backups/:backupId/lock - Toggle lock
      if (lockId && req.method === "POST") {
        const updated = await toggleLockBackup(serverPath, lockId);
        return jsonResponse({ success: true, backup: updated });
      }

      // DELETE /api/servers/:id/backups/:backupId - Delete backup
      if (deleteId && req.method === "DELETE") {
        await deleteBackup(serverPath, deleteId);
        return jsonResponse({ success: true });
      }
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }

  // 7. Server Lifecycle, Metrics, & Control routes: /api/servers/:id/power | command | logs | stats | resources
  const serverPathMatch = url.pathname.match(/^\/api\/servers\/([^\/]+)\/(power|command|logs|stats|resources)$/);
  if (serverPathMatch) {
    const [, serverId, action] = serverPathMatch;
    const serverPath = `${dataDir}/${serverId}`;

    // Real-time telemetry stats
    if (action === "stats" && req.method === "GET") {
      const stats = await getServerProcessStats(serverId, serverPath);
      return jsonResponse(stats);
    }

    // Configure resource allocation limits (RAM & CPU)
    if (action === "resources" && req.method === "POST") {
      const body = await req.json();
      const updated = await saveConfiguredResources(serverPath, {
        ramMb: body.ramMb,
        cpuLimitPercent: body.cpuLimitPercent,
      });
      return jsonResponse({ success: true, ...updated });
    }

    if (action === "power" && req.method === "POST") {
      const body = await req.json();
      const powerAction = body.action;

      if (powerAction === "start") {
        const started = await startServerProcess(serverId, serverPath, body.ramMb, body.jarFile || "server.jar");
        return jsonResponse({ success: started });
      } else if (powerAction === "stop") {
        const stopped = await stopServerProcess(serverId);
        return jsonResponse({ success: stopped });
      } else if (powerAction === "restart") {
        await stopServerProcess(serverId);
        setTimeout(() => {
          startServerProcess(serverId, serverPath, body.ramMb, body.jarFile || "server.jar");
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
