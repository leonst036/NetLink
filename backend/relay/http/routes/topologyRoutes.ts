import http from 'http';
import { URL } from 'url';
import { getMongoClient, GetTopology, SaveTopology } from '../../database/MongoManager.js';
import { authenticateToken, extractTokenFromRequest } from '../../auth/authenticator.js';

export async function handleTopologyRoute(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const token = extractTokenFromRequest(req, parsedUrl);
    const target = parsedUrl.searchParams.get('target');

    const mongoClient = getMongoClient();
    if (!mongoClient) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database not available' }));
        return;
    }



    try {
        const decoded = await authenticateToken(token || null, mongoClient);
        const username = decoded.userId || decoded.username || decoded.sub;
        const actualTarget = target || decoded.deviceId || username;

        if (req.method === 'GET') {
            const data = await GetTopology(mongoClient, username, actualTarget);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data || { nodes: [], edges: [], nicknames: {} }));
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const { nodes, edges, nicknames } = JSON.parse(body);
                    await SaveTopology(mongoClient, username, actualTarget, nodes, edges, nicknames);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
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
