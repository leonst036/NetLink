import http from 'http';
import { URL } from 'url';
import { getMongoClient, GetStoredSshSessions, SaveStoredSshSession, DeleteStoredSshSession } from '../../database/MongoManager.js';
import { authenticateToken, extractTokenFromRequest } from '../../auth/authenticator.js';

export async function handleSshSessionsRoute(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const token = extractTokenFromRequest(req, parsedUrl);

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
            const sessions = await GetStoredSshSessions(mongoClient, username);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ sessions }));
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const parsedBody = JSON.parse(body);
                    if (!parsedBody.sessionId || !parsedBody.target) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'sessionId and target are required' }));
                        return;
                    }

                    await SaveStoredSshSession(mongoClient, username, parsedBody);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, sessionId: parsedBody.sessionId }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
        } else if (req.method === 'DELETE') {
            const sessionId = parsedUrl.searchParams.get('sessionId');
            if (!sessionId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'sessionId parameter required for deletion' }));
                return;
            }
            await DeleteStoredSshSession(mongoClient, username, sessionId);
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
