import { installDaemonOverSsh, SshNodeConfig } from "./ssh_installer.ts";
import { DEFAULT_INSTALLER_SCRIPT, DEFAULT_WINGS_SCRIPT } from "./daemon_payloads.ts";
import {
  saveNode,
  getNode,
  getAllNodes,
  recordAuditEvent,
  getAuditEvents,
  NodeRecord,
} from "./db.ts";

const port = parseInt(Deno.env.get("PORT") || "8000");

// Read installer and wings scripts from daemon/ folder with embedded fallback
async function getDaemonScripts() {
  let installerScript = DEFAULT_INSTALLER_SCRIPT;
  let wingsScript = DEFAULT_WINGS_SCRIPT;
  try {
    const daemonDir = new URL("../daemon", import.meta.url).pathname;
    installerScript = await Deno.readTextFile(`${daemonDir}/installer.sh`);
    wingsScript = await Deno.readTextFile(`${daemonDir}/wings.ts`);
  } catch {
    // Fallback to embedded default payloads
  }
  return { installerScript, wingsScript };
}

console.log(`[Minecraft Wings Local Backend] Starting on port ${port}...`);

Deno.serve({ port }, async (req) => {
  const url = new URL(req.url);
  console.log(`[Minecraft Wings Local Backend] ${req.method} ${url.pathname}`);

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

  // POST .../nodes/install or .../install
  if (req.method === "POST" && (url.pathname.includes("/nodes/install") || url.pathname.includes("/install"))) {
    try {
      const body = await req.json();
      const { host, port: sshPort, username, password, privateKey, nodeName, daemonPort, daemonToken } = body;

      if (!host || !username) {
        return jsonResponse({ error: "Missing required fields: host and username" }, 400);
      }

      console.log(`[SSH Installer] Starting deployment on ${username}@${host}:${sshPort || 22}...`);
      const { installerScript, wingsScript } = await getDaemonScripts();
      const sshConfig: SshNodeConfig = {
        host,
        port: sshPort || 22,
        username,
        password,
        privateKey,
        daemonPort: daemonPort || 9080,
        daemonToken: daemonToken || "netlink-secret-token",
      };

      const result = await installDaemonOverSsh(sshConfig, installerScript, wingsScript);

      if (result.success) {
        const nodeId = `node-${Date.now()}`;
        const nodeRecord: NodeRecord = {
          id: nodeId,
          name: nodeName || host,
          host,
          daemonPort: daemonPort || 9080,
          daemonToken: daemonToken || "netlink-secret-token",
          installedAt: Date.now(),
        };

        // Persist node in database
        await saveNode(nodeRecord);
        await recordAuditEvent("NODE_INSTALLED", { nodeId, details: { host, username } });

        console.log(`[SSH Installer] Successfully registered and persisted node ${nodeId} (${host})`);
        return jsonResponse({
          success: true,
          nodeId,
          output: result.output,
        });
      } else {
        console.error(`[SSH Installer] Installation failed:`, result.output);
        return jsonResponse({
          success: false,
          error: "Installation failed over SSH",
          output: result.output,
        }, 500);
      }
    } catch (e: any) {
      console.error(`[SSH Installer] Exception:`, e);
      return jsonResponse({ error: e.message }, 500);
    }
  }

  // GET .../nodes - List all persistent nodes
  if (req.method === "GET" && (url.pathname.endsWith("/nodes") || url.pathname.endsWith("/nodes/"))) {
    const nodes = await getAllNodes();
    return jsonResponse({ nodes });
  }

  // GET .../audit-logs - Query audit events
  if (req.method === "GET" && url.pathname.includes("/audit-logs")) {
    const logs = await getAuditEvents();
    return jsonResponse({ logs });
  }

  // Forward node proxy requests: /node/:nodeId/...
  const proxyMatch = url.pathname.match(/\/node\/([^\/]+)\/(.+)$/);
  if (proxyMatch) {
    const [, nodeId, subPath] = proxyMatch;
    const node = await getNode(nodeId);

    if (!node) {
      return jsonResponse({ error: "Node not found" }, 404);
    }

    try {
      const targetUrl = `http://${node.host}:${node.daemonPort}/api/${subPath}`;
      const forwardHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (node.daemonToken) {
        forwardHeaders["Authorization"] = `Bearer ${node.daemonToken}`;
      }

      const forwardRes = await fetch(targetUrl, {
        method: req.method,
        headers: forwardHeaders,
        body: req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined,
      });

      // Record audit event for power actions
      if (subPath.includes("/power") && req.method === "POST") {
        await recordAuditEvent("SERVER_POWER_ACTION", { nodeId, details: { path: subPath } });
      }

      const data = await forwardRes.json();
      return jsonResponse(data, forwardRes.status);
    } catch (err: any) {
      return jsonResponse({ error: `Failed to reach node daemon: ${err.message}` }, 502);
    }
  }

  return jsonResponse({ message: "Minecraft Server Management Local Server running.", path: url.pathname });
});
