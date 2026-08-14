const port = parseInt(Deno.env.get("PORT") || "8000");

function handleVncWs(socket: WebSocket) {
    socket.binaryType = "arraybuffer";

    let tcpConn: Deno.TcpConn | null = null;
    let isConnected = false;

    socket.onopen = () => {
        socket.send(JSON.stringify({ type: "ready_for_credentials" }));
    };

    socket.onmessage = async (event) => {
        if (!isConnected) {
            try {
                let text = "";
                if (typeof event.data === "string") {
                    text = event.data;
                } else if (event.data instanceof ArrayBuffer) {
                    text = new TextDecoder().decode(event.data);
                }
                const data = JSON.parse(text);
                if (data.type === "connect_vnc" && data.ip) {
                    const vncIp = data.ip;
                    const vncPort = parseInt(data.port, 10) || 5900;
                    console.log(`[vnc-viewer] Connecting to VNC host: ${vncIp}:${vncPort}`);

                    tcpConn = await Deno.connect({ hostname: vncIp, port: vncPort });
                    isConnected = true;
                    socket.send(JSON.stringify({ type: "vnc_started" }));

                    // Start piping TCP stream -> WebSocket
                    const buf = new Uint8Array(65536);
                    (async () => {
                        try {
                            while (isConnected && tcpConn) {
                                const n = await tcpConn.read(buf);
                                if (n === null) break;
                                if (socket.readyState === WebSocket.OPEN) {
                                    socket.send(buf.subarray(0, n));
                                }
                            }
                        } catch (err) {
                            console.error("[vnc-viewer] TCP read error:", err);
                        } finally {
                            try { tcpConn?.close(); } catch {}
                            try { socket.close(); } catch {}
                        }
                    })();
                    return;
                }
            } catch (err) {
                console.error("[vnc-viewer] Failed to parse handshake:", err);
            }
            return;
        }

        // Forward raw binary frames from WebSocket -> TCP
        if (tcpConn && isConnected) {
            try {
                let bytes: Uint8Array;
                if (event.data instanceof ArrayBuffer) {
                    bytes = new Uint8Array(event.data);
                } else if (typeof event.data === "string") {
                    bytes = new TextEncoder().encode(event.data);
                } else {
                    bytes = event.data;
                }
                await tcpConn.write(bytes);
            } catch (err) {
                console.error("[vnc-viewer] TCP write error:", err);
            }
        }
    };

    const cleanup = () => {
        isConnected = false;
        try { tcpConn?.close(); } catch {}
        tcpConn = null;
    };

    socket.onclose = cleanup;
    socket.onerror = cleanup;
}

Deno.serve({ port }, async (req) => {
    const url = new URL(req.url);
    const headers = new Headers({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

    if (url.pathname === "/api/vnc-viewer/ws") {
        if (req.headers.get("upgrade") === "websocket") {
            const { socket, response } = Deno.upgradeWebSocket(req);
            handleVncWs(socket);
            return response;
        }
        return new Response("Expected WebSocket", { status: 400, headers });
    }

    return new Response("Not Found", { status: 404, headers });
});
