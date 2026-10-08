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

  let decoded: any = null;
  try {
    const token = extractTokenFromRequest(req, parsedUrl);
    decoded = await authenticateToken(token, getMongoClient());
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

  // Tunnels modifications require admin role
  if (decoded?.role !== "admin") {
    return jsonResponse({ error: "Forbidden: Admin privileges required for TCP tunnels" }, 403);
  }

  // Helper to read JSON body safely with 1MB limit
  const readJsonBody = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      let body = "";
      let received = 0;
      req.on("data", (chunk) => {
        received += chunk.length;
        if (received > 1024 * 1024) {
          req.destroy();
          reject(new Error("Payload too large"));
          return;
        }
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(new Error("Invalid JSON body"));
        }
      });
      req.on("error", reject);
    });
  };

  // POST /api/tunnels/open - Open a public TCP tunnel
  if (req.method === "POST" && pathname === "/api/tunnels/open") {
    try {
      const data = await readJsonBody();
      const { publicPort, targetHost, targetPort, appId, serverId, name } = data;

      if (!publicPort || !targetHost || !targetPort || !appId) {
        return jsonResponse({ error: "Missing required fields: publicPort, targetHost, targetPort, appId" }, 400);
      }

      const pPort = parseInt(publicPort, 10);
      const tPort = parseInt(targetPort, 10);
      const reservedPorts = [
        parseInt(process.env.HTTP_PORT || "4535", 10),
        parseInt(process.env.WS_PORT || "4536", 10),
        parseInt(process.env.DNS_PORT || "53", 10),
        5300
      ];

      if (isNaN(pPort) || pPort < 1024 || pPort > 65535 || reservedPorts.includes(pPort)) {
        return jsonResponse({ error: "Invalid publicPort. Must be between 1024 and 65535 and not conflict with services." }, 400);
      }

      if (isNaN(tPort) || tPort < 1 || tPort > 65535) {
        return jsonResponse({ error: "Invalid targetPort." }, 400);
      }

      const hostStr = String(targetHost).toLowerCase().trim();
      if (hostStr === "localhost" || hostStr.startsWith("127.") || hostStr === "::1" || hostStr === "169.254.169.254" || hostStr === "0.0.0.0") {
        return jsonResponse({ error: "Target host not permitted (loopback/metadata SSRF prevention)." }, 403);
      }

      const config: any = {
        publicPort: pPort,
        targetHost: hostStr,
        targetPort: tPort,
        appId: String(appId),
      };
      if (serverId) config.serverId = String(serverId);
      if (name) config.name = String(name);

      const tunnel = await openTunnel(config);

      return jsonResponse({ success: true, tunnel });
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }

  // POST /api/tunnels/close - Close a public TCP tunnel
  if (req.method === "POST" && pathname === "/api/tunnels/close") {
    try {
      const data = await readJsonBody();
      const { publicPort } = data;

      if (!publicPort) {
        return jsonResponse({ error: "Missing publicPort" }, 400);
      }

      const closed = await closeTunnel(parseInt(publicPort, 10));
      return jsonResponse({ success: closed });
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }

  return jsonResponse({ error: "Not Found" }, 404);
}
