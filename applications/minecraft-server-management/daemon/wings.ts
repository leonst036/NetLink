// NetLink Minecraft Wings Daemon - Main Router
// Imports process_manager, file_manager, server_manager, node_metrics, and backup_manager to serve the HTTP REST API.

import {
  activeServers,
  startServerProcess,
  stopServerProcess,
  sendCommand,
  getServerProcessStats,
  saveConfiguredResources,
  appendLog,
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
import {
  getPlayersOverview,
  executePlayerAction,
  addToWhitelist,
  removeFromWhitelist,
  toggleWhitelistState,
  addOrUpdateOp,
  removeOp,
  banPlayer,
  unbanPlayer,
  banIp,
  unbanIp,
} from "./player_manager.ts";
import {
  getInstanceSoftware,
  installServerSoftware,
  SUPPORTED_SOFTWARES,
} from "./software_manager.ts";

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

  // 8. Player Management routes: /api/servers/:id/players...
  const playersPathMatch = url.pathname.match(/^\/api\/servers\/([^\/]+)\/players(\/action|\/whitelist(?:\/toggle|\/([^\/]+))?|\/ops(?:\/([^\/]+))?|\/bans(?:\/([^\/]+))?)?$/);
  if (playersPathMatch) {
    const [, serverId, subRoute, wlUser, opUser, banTarget] = playersPathMatch;
    const serverPath = `${dataDir}/${serverId}`;

    try {
      // 8.1 GET /api/servers/:id/players - Get complete players overview
      if (!subRoute && req.method === "GET") {
        const overview = await getPlayersOverview(serverPath, serverId);
        return jsonResponse(overview);
      }

      // 8.2 POST /api/servers/:id/players/action - Execute in-game action (kick, gamemode, tp, msg, kill, heal, give, etc.)
      if (subRoute === "/action" && req.method === "POST") {
        const body = await req.json();
        const result = await executePlayerAction(serverId, body.action, body.player, body.params || {});
        return jsonResponse(result);
      }

      // 8.3 Whitelist endpoints
      if (subRoute && subRoute.startsWith("/whitelist")) {
        // Toggle whitelist
        if (subRoute === "/whitelist/toggle" && req.method === "POST") {
          const body = await req.json();
          const enabled = await toggleWhitelistState(serverPath, serverId, Boolean(body.enabled));
          return jsonResponse({ success: true, enabled });
        }

        // Add to whitelist
        if (subRoute === "/whitelist" && req.method === "POST") {
          const body = await req.json();
          if (!body.username) return jsonResponse({ error: "Username is required" }, 400);
          const item = await addToWhitelist(serverPath, serverId, body.username);
          return jsonResponse({ success: true, item });
        }

        // Remove from whitelist
        if (wlUser && req.method === "DELETE") {
          const decodedUser = decodeURIComponent(wlUser);
          const success = await removeFromWhitelist(serverPath, serverId, decodedUser);
          return jsonResponse({ success });
        }
      }

      // 8.4 Operators endpoints
      if (subRoute && subRoute.startsWith("/ops")) {
        // Add or update OP
        if (subRoute === "/ops" && req.method === "POST") {
          const body = await req.json();
          if (!body.username) return jsonResponse({ error: "Username is required" }, 400);
          const item = await addOrUpdateOp(serverPath, serverId, body.username, body.level || 4, Boolean(body.bypassesPlayerLimit));
          return jsonResponse({ success: true, item });
        }

        // Remove OP
        if (opUser && req.method === "DELETE") {
          const decodedUser = decodeURIComponent(opUser);
          const success = await removeOp(serverPath, serverId, decodedUser);
          return jsonResponse({ success });
        }
      }

      // 8.5 Ban endpoints
      if (subRoute && subRoute.startsWith("/bans")) {
        // Add ban (player or IP)
        if (subRoute === "/bans" && req.method === "POST") {
          const body = await req.json();
          if (!body.target) return jsonResponse({ error: "Target is required" }, 400);
          if (body.isIp) {
            const item = await banIp(serverPath, serverId, body.target, body.reason);
            return jsonResponse({ success: true, item, isIp: true });
          } else {
            const item = await banPlayer(serverPath, serverId, body.target, body.reason);
            return jsonResponse({ success: true, item, isIp: false });
          }
        }

        // Unban (player or IP)
        if (banTarget && req.method === "DELETE") {
          const decodedTarget = decodeURIComponent(banTarget);
          const isIp = url.searchParams.get("type") === "ip" || /^(\d{1,3}\.){3}\d{1,3}$/.test(decodedTarget);
          if (isIp) {
            const success = await unbanIp(serverPath, serverId, decodedTarget);
            return jsonResponse({ success, isIp: true });
          } else {
            const success = await unbanPlayer(serverPath, serverId, decodedTarget);
            return jsonResponse({ success, isIp: false });
          }
        }
      }
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }

  // 9. Software Management Endpoints
  const softwarePathMatch = url.pathname.match(/^\/api\/servers\/([^\/]+)\/software$/);
  if (softwarePathMatch) {
    const serverId = softwarePathMatch[1];
    const serverPath = `${dataDir}/${serverId}`;

    if (req.method === "GET") {
      const current = await getInstanceSoftware(serverPath);
      return jsonResponse({
        current,
        supportedSoftwares: SUPPORTED_SOFTWARES,
      });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const software = body.software || "vanilla";
      const version = body.version || "1.20.4";
      const jarFile = body.jarFile || "server.jar";

      const res = await installServerSoftware(serverPath, software, version, jarFile);
      if (res.success) {
        appendLog(serverId, `[Wings] Server software switched to ${software} (${version}).`);
        return jsonResponse({ success: true, software, version, jarPath: res.jarPath });
      } else {
        return jsonResponse({ success: false, error: res.error }, 500);
      }
    }
  }

  return jsonResponse({ error: "Not Found" }, 404);
});
