import { installDaemonOverSsh, SshNodeConfig } from "../local_server/ssh_installer.ts";
import { DEFAULT_INSTALLER_SCRIPT, DEFAULT_WINGS_SCRIPT } from "../local_server/daemon_payloads.ts";

const port = parseInt(Deno.env.get("PORT") || "8000");

interface NodeRegistryEntry {
  id: string;
  name: string;
  host: string;
  daemonPort: number;
  daemonToken?: string;
  installedAt: number;
}

const registeredNodes = new Map<string, NodeRegistryEntry>();

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

console.log(`[Minecraft Wings Relay Backend] Starting on port ${port}...`);

Deno.serve({ port }, async (req) => {
  const url = new URL(req.url);
  console.log(`[Minecraft Wings Relay Backend] ${req.method} ${url.pathname}`);

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

      console.log(`[SSH Installer Relay] Starting deployment on ${username}@${host}:${sshPort || 22}...`);
      const { installerScript, wingsScript } = await getDaemonScripts();
      const sshConfig: SshNodeConfig = {
        host,
        port: sshPort || 22,
        username,
        password,
        privateKey,
        daemonPort: daemonPort || 8080,
        daemonToken: daemonToken || "netlink-secret-token",
      };

      const result = await installDaemonOverSsh(sshConfig, installerScript, wingsScript);

      if (result.success) {
        const nodeId = `node-${Date.now()}`;
        registeredNodes.set(nodeId, {
          id: nodeId,
          name: nodeName || host,
          host,
          daemonPort: daemonPort || 8080,
          daemonToken: daemonToken || "netlink-secret-token",
          installedAt: Date.now(),
        });

        console.log(`[SSH Installer Relay] Successfully registered node ${nodeId} (${host})`);
        return jsonResponse({
          success: true,
          nodeId,
          output: result.output,
        });
      } else {
        console.error(`[SSH Installer Relay] Installation failed:`, result.output);
        return jsonResponse({
          success: false,
          error: "Installation failed over SSH",
          output: result.output,
        }, 500);
      }
    } catch (e: any) {
      console.error(`[SSH Installer Relay] Exception:`, e);
      return jsonResponse({ error: e.message }, 500);
    }
  }

  // GET .../nodes
  if (req.method === "GET" && (url.pathname.endsWith("/nodes") || url.pathname.endsWith("/nodes/"))) {
    return jsonResponse({ nodes: Array.from(registeredNodes.values()) });
  }

  // Forward node proxy requests
  const proxyMatch = url.pathname.match(/\/node\/([^\/]+)\/(.+)$/);
  if (proxyMatch) {
    const [, nodeId, subPath] = proxyMatch;
    const node = registeredNodes.get(nodeId);

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

      const data = await forwardRes.json();
      return jsonResponse(data, forwardRes.status);
    } catch (err: any) {
      return jsonResponse({ error: `Failed to reach node daemon: ${err.message}` }, 502);
    }
  }

  return jsonResponse({ message: "Minecraft Server Management Relay running.", path: url.pathname });
});
