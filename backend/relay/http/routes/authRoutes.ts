import http from 'http';
import { URL } from 'url';
import { getMongoClient, RegisterUser, StoreToken } from '../../database/MongoManager.js';
import { controlConnections } from '../../websocket/connectionManager.js';
import { GenerateToken, VerifyToken } from '../../auth/tokenManager.js';
import { generateTicket } from '../../auth/ticketManager.js';
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

export async function handleTicketRoute(req: http.IncomingMessage, res: http.ServerResponse, parsedUrl: URL): Promise<void> {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');

    const authHeader = req.headers.authorization;
    let token = '';
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1] || '';
    } else {
        const cookieHeader = req.headers.cookie || '';
        const matchToken = cookieHeader.match(/netlink_token=([^;]+)/);
        if (matchToken) {
            token = matchToken[1] || '';
        }
    }

    if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
    }

    try {
        const decoded: any = await VerifyToken(token, process.env.JWT_SECRET || 'default_secret');
        if (!decoded || !decoded.userId) {
            throw new Error('Invalid token payload');
        }

        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const parsedBody = body ? JSON.parse(body) : {};
                const target = parsedBody.target || parsedUrl.searchParams.get('target') || '';
                
                const ticket = generateTicket(decoded.userId, target, decoded.role, decoded.permissions);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, ticket }));
            } catch (err: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Bad request' }));
            }
        });
    } catch (err: any) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized', details: err.message }));
    }
}
