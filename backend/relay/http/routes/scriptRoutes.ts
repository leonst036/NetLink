import http from 'http';
import fs from 'fs';
import path from 'path';

export function handleInstallScriptRoute(req: http.IncomingMessage, res: http.ServerResponse): void {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const xForwardedProto = req.headers['x-forwarded-proto'];
    let isHttps = (req.socket as any).encrypted || (typeof xForwardedProto === 'string' && xForwardedProto.includes('https')) || xForwardedProto === 'https';
    const host = req.headers.host || 'localhost';
    if (!isHttps && !host.includes('localhost') && !host.startsWith('127.') && !host.startsWith('192.168.') && !host.startsWith('10.')) {
        isHttps = true;
    }
    const protocol = isHttps ? 'https' : 'http';
    const relayUrl = `${protocol}://${host}`;
    const isPs1 = pathname.endsWith('.ps1');
    const scriptName = isPs1 ? 'install_local_server.ps1' : 'install_local_server.sh';

    const scriptPath = path.join(process.cwd(), `assets/scripts/${scriptName}`);
    if (!fs.existsSync(scriptPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Install script not found');
        return;
    }

    const script = fs.readFileSync(scriptPath, 'utf-8').replaceAll('${relayUrl}', relayUrl);
    res.writeHead(200, { 'Content-Type': isPs1 ? 'text/plain' : 'application/x-sh' });
    res.end(script);
}
