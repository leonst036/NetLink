import http from 'http';
import { URL } from 'url';
import { serverDevices } from '../../websocket/connectionManager.js';
import { getMongoClient, GetServerLogins, SaveServerLogin, DeleteServerLogin } from '../../database/MongoManager.js';
import { authenticateToken } from '../../auth/authenticator.js';

export function handleGetServersRoute(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse): void {
    const target = parsedUrl.searchParams.get('target');
    if (!target) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'target parameter required' }));
        return;
    }
    const devices = serverDevices.get(target) || [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ devices }));
}

export async function handleServerLoginsRoute(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1] || parsedUrl.searchParams.get('token');

    const mongoClient = getMongoClient();
    if (!mongoClient) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database not available' }));
        return;
    }

    try {
        const decoded = await authenticateToken(token || null, mongoClient);
        const username = decoded.userId || decoded.username || decoded.sub;

        if (req.method === 'GET') {
            const logins = await GetServerLogins(mongoClient, username);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ logins }));
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const parsedBody = JSON.parse(body);
                    if (!parsedBody.id) parsedBody.id = Date.now().toString();

                    await SaveServerLogin(mongoClient, username, parsedBody);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, id: parsedBody.id }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
        } else if (req.method === 'DELETE') {
            const id = parsedUrl.searchParams.get('id');
            if (!id) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'id parameter required for deletion' }));
                return;
            }
            await DeleteServerLogin(mongoClient, username, id);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
    } catch (err: any) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized', details: err.message }));
    }
}
