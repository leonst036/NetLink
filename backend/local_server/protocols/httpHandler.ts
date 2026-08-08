import { WebSocket } from 'ws';
import * as http from 'http';
import * as https from 'https';

export function connectHttp(ws: WebSocket, url: string, method: string, headers: Record<string, string>, body?: any): void {
    const parsedUrl = new URL(url);
    const options: any = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers
    };
    console.log(`Connecting to ${url} with method ${method} and headers:`, headers);

    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const req = protocol.request(options, (res: any) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'http_response',
                status: res.statusCode,
                headers: res.headers
            }));
        }

        res.on('data', (chunk: any) => {
            if (ws.readyState === WebSocket.OPEN) {
                // Send the raw buffer chunk
                ws.send(chunk);
            }
        });

        res.on('end', () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'http_end' }));
            }
        });
    });

    req.on('error', (err: any) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'error', message: err.message || err }));
        }
    });

    if (body) {
        req.write(body);
    }

    req.end();
}