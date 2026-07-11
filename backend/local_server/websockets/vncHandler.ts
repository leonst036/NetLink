import net from 'net';
import { WebSocket } from "ws";

export function startVnc(ws: WebSocket, host: string, port: number): void {
    console.log(`Initiating VNC session to ${host}:${port}...`);

    const vncSocket = net.createConnection({ host, port }, () => {
        console.log(`Connected to VNC server on ${host}:${port}`);
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'vnc_started' }));
        }
    });

    let vncToWsBytes = 0;
    let wsToVncBytes = 0;

    vncSocket.on('data', (data: Buffer) => {
        vncToWsBytes += data.length;
        if (vncToWsBytes < 100) console.log(`[VNC -> WS] Sending ${data.length} bytes (Total: ${vncToWsBytes})`);
        
        if (ws.readyState == WebSocket.OPEN) {
            ws.send(data);
        }
    });

    ws.on('message', (message: any) => {
        const len = Buffer.isBuffer(message) ? message.length : message.toString().length;
        wsToVncBytes += len;
        if (wsToVncBytes < 100) console.log(`[WS -> VNC] Receiving ${len} bytes (Total: ${wsToVncBytes})`);

        if (!vncSocket.destroyed) {
            vncSocket.write(message);
        }
    });
    vncSocket.on('error', (err) => {
        console.error(`VNC Error for ${host}:`, err.message);
        ws.close();
    });
    ws.on('close', () => {
        console.log(`VNC connection closed for ${host}`);
        vncSocket.end();
    });
}
