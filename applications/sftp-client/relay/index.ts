import SftpClient from "npm:ssh2-sftp-client";
import { Buffer } from "node:buffer";

const port = parseInt(Deno.env.get("PORT") || "8000");

function normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
}

function handleSftpWs(ws: WebSocket) {
    let sftp: any = null;
    let writeStream: any = null;

    ws.onopen = () => {
        ws.send(JSON.stringify({ type: "ready_for_credentials" }));
    };

    const cleanup = () => {
        if (writeStream) {
            try { writeStream.destroy(); } catch {}
            writeStream = null;
        }
        if (sftp) {
            try { sftp.end(); } catch {}
            sftp = null;
        }
    };

    ws.onclose = cleanup;
    ws.onerror = cleanup;

    ws.onmessage = async (event) => {
        try {
            const data = typeof event.data === "string" ? JSON.parse(event.data) : null;
            if (!data) return;

            if (data.type === "connect_sftp") {
                const { ip, username, password, port = 22 } = data;
                sftp = new SftpClient();
                try {
                    await sftp.connect({
                        host: ip,
                        port: port || 22,
                        username,
                        password,
                        readyTimeout: 10000
                    });
                    const homeDir = await sftp.realPath('.');
                    ws.send(JSON.stringify({ type: 'connected', homeDir }));
                } catch (err: any) {
                    ws.send(JSON.stringify({ type: 'error', message: err.message || String(err), fatal: true }));
                }
                return;
            }

            if (!sftp) return;

            if (data.type === "list") {
                const normalized = normalizePath(data.path || '.');
                try {
                    const list = await sftp.list(normalized);
                    ws.send(JSON.stringify({ type: 'fileList', data: list }));
                } catch (err: any) {
                    ws.send(JSON.stringify({ type: 'error', message: err.message || String(err) }));
                }
            } else if (data.type === "delete") {
                const normalized = normalizePath(data.path);
                try {
                    const exists = await sftp.exists(normalized);
                    if (exists === 'd') await sftp.rmdir(normalized, true);
                    else if (exists) await sftp.delete(normalized);
                    ws.send(JSON.stringify({ type: 'deleteSuccess' }));
                } catch (err: any) {
                    ws.send(JSON.stringify({ type: 'error', message: err.message || String(err) }));
                }
            } else if (data.type === "mkdir") {
                const normalized = normalizePath(data.path);
                try {
                    await sftp.mkdir(normalized, true);
                    ws.send(JSON.stringify({ type: 'mkdirSuccess' }));
                } catch (err: any) {
                    ws.send(JSON.stringify({ type: 'error', message: err.message || String(err) }));
                }
            } else if (data.type === "download") {
                const normalized = normalizePath(data.path);
                try {
                    const stream = sftp.createReadStream(normalized, { highWaterMark: 1024 * 1024 * 2 });
                    stream.on('data', (chunk: Buffer) => {
                        stream.pause();
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'fileDataDownload', data: chunk.toString('base64') }));
                        }
                        stream.resume();
                    });
                    stream.on('end', () => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'fileEnd' }));
                        }
                    });
                    stream.on('error', (err: any) => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'error', message: err.message || String(err) }));
                        }
                    });
                } catch (err: any) {
                    ws.send(JSON.stringify({ type: 'error', message: err.message || String(err) }));
                }
            } else if (data.type === "upload") {
                const normalized = normalizePath(data.path);
                try {
                    writeStream = sftp.createWriteStream(normalized);
                    writeStream.on('error', (err: any) => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'error', message: err.message || String(err) }));
                        }
                    });
                    ws.send(JSON.stringify({ type: 'uploadReady' }));
                } catch (err: any) {
                    ws.send(JSON.stringify({ type: 'error', message: err.message || String(err) }));
                }
            } else if (data.type === "uploadChunk") {
                if (writeStream) {
                    let buffer: Buffer;
                    if (typeof data.data === 'string') {
                        buffer = Buffer.from(data.data, 'base64');
                    } else if (data.data && data.data.data) {
                        buffer = Buffer.from(data.data.data);
                    } else {
                        buffer = Buffer.from(data.data);
                    }
                    const canWrite = writeStream.write(buffer);
                    if (!canWrite) {
                        writeStream.once('drain', () => {
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({ type: 'uploadAck' }));
                            }
                        });
                    } else {
                        ws.send(JSON.stringify({ type: 'uploadAck' }));
                    }
                }
            } else if (data.type === "uploadEnd") {
                if (writeStream) {
                    writeStream.end(() => {
                        writeStream = null;
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'uploadSuccess' }));
                        }
                    });
                }
            } else if (data.type === "uploadCancel") {
                if (writeStream) {
                    try { writeStream.destroy(); } catch {}
                    writeStream = null;
                }
            } else if (data.type === "disconnect") {
                cleanup();
                ws.send(JSON.stringify({ type: 'disconnected' }));
            }
        } catch {
            // Ignore non-JSON
        }
    };
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

    if (url.pathname === "/api/sftp-client/ws") {
        if (req.headers.get("upgrade") === "websocket") {
            const { socket, response } = Deno.upgradeWebSocket(req);
            handleSftpWs(socket);
            return response;
        }
        return new Response("Expected WebSocket", { status: 400, headers });
    }

    return new Response("Not Found", { status: 404, headers });
});
