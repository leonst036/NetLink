import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getMongoClient, CreateUser, StoreToken } from '../../database/MongoManager.js';
import { GenerateToken } from '../../auth/tokenManager.js';

export function handleInstallScriptRoute(req: http.IncomingMessage, res: http.ServerResponse): void {
    const isHttps = (req.socket as any).encrypted || req.headers['x-forwarded-proto'] === 'https';
    const protocol = isHttps ? 'https' : 'http';
    const host = req.headers.host || 'localhost';
    const relayUrl = `${protocol}://${host}`;

    const scriptPath = path.join(process.cwd(), 'assets/scripts/install_local_server.sh');
    if (!fs.existsSync(scriptPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Install script not found');
        return;
    }

    const script = fs.readFileSync(scriptPath, 'utf-8').replaceAll('${relayUrl}', relayUrl);
    res.writeHead(200, { 'Content-Type': 'application/x-sh' });
    res.end(script);
}

export function handleDemoScriptRoute(req: http.IncomingMessage, res: http.ServerResponse): void {
    const isHttps = (req.socket as any).encrypted || req.headers['x-forwarded-proto'] === 'https';
    const protocol = isHttps ? 'https' : 'http';
    const host = req.headers.host || 'localhost';
    const relayUrl = `${protocol}://${host}`;

    const scriptPath = path.join(process.cwd(), 'assets/scripts/demo_setup.sh');
    if (!fs.existsSync(scriptPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Demo script not found');
        return;
    }

    const script = fs.readFileSync(scriptPath, 'utf-8').replaceAll('${relayUrl}', relayUrl);
    res.writeHead(200, { 'Content-Type': 'application/x-sh' });
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
        const token = await GenerateToken({ deviceId: targetId, userId: username, role: userData.role, permissions: userData.permissions }, process.env.JWT_SECRET || 'default_secret');
        await StoreToken(mongoClient, token, targetId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ username, password, targetId, jwtToken: token }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to create demo user' }));
    }
}
