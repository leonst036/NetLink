import http from 'http';
import { URL } from 'url';
import { getMongoClient, RegisterUser, StoreToken } from '../../database/MongoManager.js';
import { controlConnections } from '../../websocket/connectionManager.js';
import { GenerateToken } from '../../auth/tokenManager.js';

export async function handleRegisterRoute(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
        try {
            const parsedBody = JSON.parse(body);
            const mongoClient = getMongoClient();
            if (!mongoClient) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database not available' }));
                return;
            }
            await RegisterUser(mongoClient, parsedBody);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (err: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message || 'Failed to register user' }));
        }
    });
}

export async function handleValidateTargetRoute(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const target = parsedUrl.searchParams.get('target');
    if (!target) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'target parameter required' }));
        return;
    }

    const isValid = !controlConnections.has(target);
    if (!isValid) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: false }));
        return;
    }

    const mongoClient = getMongoClient();
    const token = await GenerateToken({ deviceId: target }, process.env.JWT_SECRET || 'default_secret');

    if (mongoClient) {
        await StoreToken(mongoClient, token);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ valid: true, token }));
}
