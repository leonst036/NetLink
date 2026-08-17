import http from "http";
import { URL } from "url";
import { openTunnel, closeTunnel, listTunnels, getTunnelInfo } from "../../tunnels/PortForwardManager.js";
import { extractTokenFromRequest, authenticateToken } from "../../auth/authenticator.js";
import { getMongoClient } from "../../database/MongoManager.js";

// Handle /api/tunnels route
export async function handleTunnelRoutes(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const jsonResponse = (data: any, status = 200) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end(JSON.stringify(data));
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  try {
    const token = extractTokenFromRequest(req, parsedUrl);
    await authenticateToken(token, getMongoClient());
  } catch (err: any) {
    return jsonResponse({ error: "Unauthorized: " + err.message }, 401);
  }

  const pathname = parsedUrl.pathname;

  // GET /api/tunnels - List active tunnels
  if (req.method === "GET" && pathname === "/api/tunnels") {
    const appId = parsedUrl.searchParams.get("appId") || undefined;
    const serverId = parsedUrl.searchParams.get("serverId") || undefined;
    const tunnels = listTunnels(appId, serverId);
    return jsonResponse({ tunnels });
  }

  // POST /api/tunnels/open - Open a public TCP tunnel
  if (req.method === "POST" && pathname === "/api/tunnels/open") {
    let body = "";
    req.on("data", (c) => (body += c.toString()));
    req.on("end", async () => {
      try {
        const data = JSON.parse(body);
        const { publicPort, targetHost, targetPort, appId, serverId, name } = data;

        if (!publicPort || !targetHost || !targetPort || !appId) {
          return jsonResponse({ error: "Missing required fields: publicPort, targetHost, targetPort, appId" }, 400);
        }

        const tunnel = await openTunnel({
          publicPort: parseInt(publicPort, 10),
          targetHost,
          targetPort: parseInt(targetPort, 10),
          appId,
          serverId,
          name,
        });

        return jsonResponse({ success: true, tunnel });
      } catch (err: any) {
        return jsonResponse({ error: err.message }, 500);
      }
    });
    return;
  }

  // POST /api/tunnels/close - Close a public TCP tunnel
  if (req.method === "POST" && pathname === "/api/tunnels/close") {
    let body = "";
    req.on("data", (c) => (body += c.toString()));
    req.on("end", async () => {
      try {
        const data = JSON.parse(body);
        const { publicPort } = data;

        if (!publicPort) {
          return jsonResponse({ error: "Missing publicPort" }, 400);
        }

        const closed = await closeTunnel(parseInt(publicPort, 10));
        return jsonResponse({ success: closed });
      } catch (err: any) {
        return jsonResponse({ error: err.message }, 500);
      }
    });
    return;
  }

  return jsonResponse({ error: "Not Found" }, 404);
}
