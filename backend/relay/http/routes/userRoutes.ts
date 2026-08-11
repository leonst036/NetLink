import http from 'http';
import { URL } from 'url';
import { getMongoClient, GetUsers, CreateUser, UpdateUser, DeleteUser } from '../../database/MongoManager.js';
import { authenticateToken, extractTokenFromRequest } from '../../auth/authenticator.js';

export async function handleUsersRoute(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const token = extractTokenFromRequest(req, parsedUrl);

    const mongoClient = getMongoClient();
    if (!mongoClient) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database not available' }));
        return;
    }

    try {
        const decoded = await authenticateToken(token || null, mongoClient);
        const hasPermission = decoded.role === 'admin' || (decoded.permissions && decoded.permissions.includes('manage_users'));
        if (!hasPermission) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Forbidden: Missing manage_users permission' }));
            return;
        }

        if (req.method === 'GET') {
            const users = await GetUsers(mongoClient);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ users }));
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const parsedBody = JSON.parse(body);
                    await CreateUser(mongoClient, parsedBody);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
        } else if (req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const parsedBody = JSON.parse(body);
                    const username = parsedUrl.searchParams.get('username') || parsedBody.username;
                    if (!username) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'username parameter required' }));
                        return;
                    }
                    await UpdateUser(mongoClient, username, parsedBody);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
        } else if (req.method === 'DELETE') {
            const username = parsedUrl.searchParams.get('username');
            if (!username) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'username parameter required for deletion' }));
                return;
            }
            await DeleteUser(mongoClient, username);
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
