import { Client } from "npm:ssh2";

const port = parseInt(Deno.env.get("PORT") || "8000");
const dataFile = new URL('./ssh-sessions.json', import.meta.url).pathname;

async function readSessions() {
    try {
        const text = await Deno.readTextFile(dataFile);
        return JSON.parse(text);
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            return [];
        }
        return [];
    }
}

async function writeSessions(sessions: any[]) {
    try {
        await Deno.writeTextFile(dataFile, JSON.stringify(sessions, null, 2));
    } catch (error) {
        console.error("Error writing sessions file:", error);
    }
}

function handleTerminalWs(socket: WebSocket) {
    socket.onopen = () => {
        socket.send(JSON.stringify({ type: "ready_for_credentials" }));
    };

    let sshClient: any = null;
    let stream: any = null;

    socket.onmessage = (event) => {
        try {
            const data = typeof event.data === "string" ? JSON.parse(event.data) : null;
            if (data && data.type === "connect") {
                const { ip, username, password, cols = 80, rows = 24 } = data;
                sshClient = new Client();

                sshClient.on("ready", () => {
                    sshClient.shell({ term: "xterm-256color", cols, rows }, (err: any, s: any) => {
                        if (err) {
                            socket.send(`\r\n[SSH Error]: ${err.message}\r\n`);
                            socket.close();
                            return;
                        }
                        stream = s;
                        stream.on("data", (chunk: any) => {
                            if (socket.readyState === WebSocket.OPEN) {
                                socket.send(chunk.toString());
                            }
                        });
                        stream.on("close", () => {
                            if (sshClient) sshClient.end();
                            if (socket.readyState === WebSocket.OPEN) {
                                socket.close();
                            }
                        });
                        stream.stderr.on("data", (chunk: any) => {
                            if (socket.readyState === WebSocket.OPEN) {
                                socket.send(chunk.toString());
                            }
                        });
                    });
                });

                sshClient.on("error", (err: any) => {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(`\r\n[SSH Error]: ${err.message}\r\n`);
                        socket.close();
                    }
                });

                sshClient.connect({
                    host: ip || "localhost",
                    port: 22,
                    username,
                    password,
                    readyTimeout: 10000
                });
                return;
            }

            if (data && data.type === "resize") {
                if (stream && stream.setWindow) {
                    stream.setWindow(data.rows || 24, data.cols || 80, 0, 0);
                }
                return;
            }
        } catch {
            // Not a JSON command, forward raw keystrokes to SSH stream
        }

        if (stream && stream.writable) {
            stream.write(event.data);
        }
    };

    socket.onclose = () => {
        if (stream) stream.end();
        if (sshClient) sshClient.end();
    };

    socket.onerror = () => {
        if (stream) stream.end();
        if (sshClient) sshClient.end();
    };
}

Deno.serve({ port }, async (req) => {
    const url = new URL(req.url);
    const headers = new Headers({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

    if (url.pathname === "/api/net-terminal/ws") {
        if (req.headers.get("upgrade") === "websocket") {
            const { socket, response } = Deno.upgradeWebSocket(req);
            handleTerminalWs(socket);
            return response;
        }
        return new Response("Expected WebSocket", { status: 400, headers });
    }

    if (url.pathname === "/api/net-terminal/ssh-sessions") {
        try {
            if (req.method === "GET") {
                const sessions = await readSessions();
                return new Response(JSON.stringify({ sessions }), { status: 200, headers });
            } 
            if (req.method === "POST") {
                const body = await req.json();
                if (!body.sessionId || !body.target) return new Response(JSON.stringify({ error: "sessionId and target required" }), { status: 400, headers });
                const sessions = await readSessions();
                const existingIndex = sessions.findIndex((s: any) => s.sessionId === body.sessionId);
                if (existingIndex >= 0) sessions[existingIndex] = { ...sessions[existingIndex], ...body };
                else sessions.push(body);
                await writeSessions(sessions);
                return new Response(JSON.stringify({ success: true, sessionId: body.sessionId }), { status: 200, headers });
            }
            if (req.method === "DELETE") {
                const sessionId = url.searchParams.get('sessionId');
                if (!sessionId) return new Response(JSON.stringify({ error: "sessionId required" }), { status: 400, headers });
                const sessions = await readSessions();
                const newSessions = sessions.filter((s: any) => s.sessionId !== sessionId);
                await writeSessions(newSessions);
                return new Response(JSON.stringify({ success: true }), { status: 200, headers });
            }
            return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
        } catch (e: any) {
            return new Response(JSON.stringify({ error: "Internal error", details: e.message }), { status: 500, headers });
        }
    }
    return new Response("Not Found", { status: 404, headers });
});
