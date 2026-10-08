import http from 'http';
import { URL } from 'url';
import { extractTokenFromRequest, authenticateToken } from '../../auth/authenticator.js';
import { getMongoClient } from '../../database/MongoManager.js';

export async function handleLogLevelRoute(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        });
        res.end();
        return;
    }

    const token = extractTokenFromRequest(req, parsedUrl);
    const mongoClient = getMongoClient();

    try {
        await authenticateToken(token, mongoClient);
    } catch (err: any) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized', details: err?.message }));
        return;
    }

    const currentLogLevel = process.env.LOG_LEVEL || 3;

    if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ logLevel: currentLogLevel }));
    } else if (req.method === 'POST') {
        await new Promise<void>((resolve) => {
            let body = '';
            let received = 0;
            req.on('data', chunk => {
                received += chunk.length;
                if (received > 1024 * 1024) {
                    req.destroy();
                    return;
                }
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const parsedBody = JSON.parse(body);
                    process.env.LOG_LEVEL = parsedBody.logLevel;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
                resolve();
            });
            req.on('error', () => {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Bad Request' }));
                resolve();
            });
        });
    } else {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
}