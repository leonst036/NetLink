import net from 'net';
import { WebSocket } from "ws";

export function startVnc(ws: WebSocket, host: string, port: number): void {
    console.log(`Initiating VNC session to ${host}:${port}...`);

    const vncSocket = net.createConnection({ host, port }, () => {
        console.log(`Connected to VNC server on ${host}:${port}`);
    });

    vncSocket.on('data', (data: Buffer) => {
        if (ws.readyState == WebSocket.OPEN) {
            ws.send(data);
        }
    });
    ws.on('message', (message: any) => {
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
