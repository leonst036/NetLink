// Cloud relay backend for traffic-monitor
const port = parseInt(Deno.env.get("PORT") || "8000");

interface RelayTrafficStats {
  timestamp: number;
  relayRxBytes: number;
  relayTxBytes: number;
  rxSpeed: number; // bytes/sec
  txSpeed: number; // bytes/sec
  activeSockets: number;
  activeTunnels: number;
  latencyMs: number;
  uptimeSeconds: number;
}

const startTime = Date.now();
let lastTimestamp = Date.now();
let mockRxTotal = 104857600; // 100 MB baseline
let mockTxTotal = 73400320;  // 70 MB baseline

Deno.serve({ port }, (req) => {
  const url = new URL(req.url);

  // Allow CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // WebSocket support for streaming real-time relay stats
  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);
    let timer: number | undefined;

    socket.onopen = () => {
      timer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          const now = Date.now();
          const timeDelta = Math.max((now - lastTimestamp) / 1000, 0.1);
          lastTimestamp = now;

          const rxSpeed = Math.floor(Math.random() * 800000) + 200000; // 200KB/s - 1MB/s
          const txSpeed = Math.floor(Math.random() * 600000) + 150000;

          mockRxTotal += Math.floor(rxSpeed * timeDelta);
          mockTxTotal += Math.floor(txSpeed * timeDelta);

          const stats: RelayTrafficStats = {
            timestamp: now,
            relayRxBytes: mockRxTotal,
            relayTxBytes: mockTxTotal,
            rxSpeed,
            txSpeed,
            activeSockets: Math.floor(Math.random() * 12) + 3,
            activeTunnels: Math.floor(Math.random() * 4) + 1,
            latencyMs: Math.floor(Math.random() * 25) + 12,
            uptimeSeconds: Math.floor((now - startTime) / 1000)
          };

          socket.send(JSON.stringify(stats));
        }
      }, 1000);
    };

    socket.onclose = () => {
      if (timer) clearInterval(timer);
    };

    return response;
  }

  // REST API endpoint
  if (req.method === "GET" && url.pathname.includes("/relay-stats")) {
    const now = Date.now();
    const timeDelta = Math.max((now - lastTimestamp) / 1000, 0.1);
    lastTimestamp = now;

    const rxSpeed = Math.floor(Math.random() * 800000) + 200000;
    const txSpeed = Math.floor(Math.random() * 600000) + 150000;

    mockRxTotal += Math.floor(rxSpeed * timeDelta);
    mockTxTotal += Math.floor(txSpeed * timeDelta);

    const stats: RelayTrafficStats = {
      timestamp: now,
      relayRxBytes: mockRxTotal,
      relayTxBytes: mockTxTotal,
      rxSpeed,
      txSpeed,
      activeSockets: Math.floor(Math.random() * 12) + 3,
      activeTunnels: Math.floor(Math.random() * 4) + 1,
      latencyMs: Math.floor(Math.random() * 25) + 12,
      uptimeSeconds: Math.floor((now - startTime) / 1000)
    };

    return new Response(JSON.stringify(stats), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  return new Response(JSON.stringify({ status: "ok", app: "traffic-monitor-relay" }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
});
