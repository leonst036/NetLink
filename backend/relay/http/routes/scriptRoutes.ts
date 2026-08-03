import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getMongoClient, CreateUser, StoreToken } from '../../database/MongoManager.js';
import { GenerateToken } from '../../auth/tokenManager.js';

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

export function handleDemoScriptRoute(req: http.IncomingMessage, res: http.ServerResponse): void {
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
    const scriptName = isPs1 ? 'demo_setup.ps1' : 'demo_setup.sh';

    const scriptPath = path.join(process.cwd(), `assets/scripts/${scriptName}`);
    if (!fs.existsSync(scriptPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Demo script not found');
        return;
    }

    const script = fs.readFileSync(scriptPath, 'utf-8').replaceAll('${relayUrl}', relayUrl);
    res.writeHead(200, { 'Content-Type': isPs1 ? 'text/plain' : 'application/x-sh' });
    res.end(script);
}

export async function handleDemoSetupRoute(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    const mongoClient = getMongoClient();
    if (!mongoClient) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database not available' }));
        return;
    }

    const username = `demo_${crypto.randomBytes(4).toString('hex')}`;
    const password = crypto.randomBytes(6).toString('hex');
    const targetId = `target_${crypto.randomBytes(4).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const userData = {
        username,
        password,
        role: 'user',
        permissions: ['access_terminal', 'access_vnc', 'access_sftp', 'scan_network'],
        targets: [targetId],
        expiresAt
    };

    try {
        await CreateUser(mongoClient, userData);
        const token = await GenerateToken({ deviceId: targetId }, process.env.JWT_SECRET || 'default_secret');
        await StoreToken(mongoClient, token);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ username, password, targetId, jwtToken: token }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to create demo user' }));
    }
}
