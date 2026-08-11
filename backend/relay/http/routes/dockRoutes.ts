import http from 'http';
import { URL } from 'url';
import { getMongoClient, GetDockConfig, SaveDockConfig } from '../../database/MongoManager.js';
import { authenticateToken, extractTokenFromRequest } from '../../auth/authenticator.js';

const inMemoryDockStore = new Map<string, any[]>();

export async function handleDockRoute(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const token = extractTokenFromRequest(req, parsedUrl);
    const mongoClient = getMongoClient();

    try {
        const decoded = await authenticateToken(token, mongoClient);
        const username = decoded.userId || decoded.username || decoded.sub || 'default_user';

        if (req.method === 'GET') {
            let pinnedApps: any[] = [];
            if (mongoClient) {
                const doc = await GetDockConfig(mongoClient, username);
                if (doc && Array.isArray(doc.pinnedApps)) {
                    pinnedApps = doc.pinnedApps;
                } else if (inMemoryDockStore.has(username)) {
                    pinnedApps = inMemoryDockStore.get(username) || [];
                }
            } else {
                pinnedApps = inMemoryDockStore.get(username) || [];
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ pinnedApps }));
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const pinnedApps = Array.isArray(data.pinnedApps) ? data.pinnedApps : [];

                    inMemoryDockStore.set(username, pinnedApps);

                    if (mongoClient) {
                        await SaveDockConfig(mongoClient, username, pinnedApps);
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, pinnedApps }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
                }
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
    } catch (err: any) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized', details: err.message }));
    }
}
