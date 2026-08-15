import http from 'http';
import { URL } from 'url';
import { getMongoClient, ExecuteAppDatabaseAction } from '../../database/MongoManager.js';
import { authenticateToken, extractTokenFromRequest } from '../../auth/authenticator.js';
import { isDatabaseGranted } from '../../websocket/connectionHandlers.js';

const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024; // 5 MB max body size

export async function handleAppDatabaseRoute(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        });
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }));
        return;
    }

    const token = extractTokenFromRequest(req, parsedUrl);
    const mongoClient = getMongoClient();

    if (!mongoClient) {
        res.writeHead(503, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Database service is currently unavailable.' }));
        return;
    }

    let decoded: any;
    try {
        decoded = await authenticateToken(token, mongoClient);
    } catch (err: any) {
        res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Unauthorized', details: err.message }));
        return;
    }

    const userId = decoded.userId || decoded.username || decoded.sub;
    if (!userId) {
        res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Invalid token payload: missing userId' }));
        return;
    }

    let body = '';
    let receivedBytes = 0;

    req.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_PAYLOAD_SIZE) {
            req.destroy();
            res.writeHead(413, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Payload Too Large. Max size is 5MB.' }));
            return;
        }
        body += chunk.toString();
    });

    req.on('end', async () => {
        if (res.writableEnded) return;

        let parsedBody: any;
        try {
            parsedBody = JSON.parse(body || '{}');
        } catch {
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
            return;
        }

        const { appId, collection, action, query, data, id, options } = parsedBody;

        if (!appId || typeof appId !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: "Missing or invalid 'appId'" }));
            return;
        }

        if (!action || typeof action !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: "Missing or invalid 'action'" }));
            return;
        }

        if (action !== 'listCollections' && (!collection || typeof collection !== 'string')) {
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: "Missing or invalid 'collection'" }));
            return;
        }

        // Check if database or collection is granted for appId in permissions.json
        if (!isDatabaseGranted(appId, collection)) {
            res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({
                error: `Permission denied: App '${appId}' is not authorized for database access.`
            }));
            return;
        }

        try {
            const result = await ExecuteAppDatabaseAction(
                mongoClient,
                appId,
                collection,
                userId,
                action,
                { query, data, id, options }
            );

            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ success: true, data: result }));
        } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: err.message || 'Database action failed' }));
        }
    });

    req.on('error', (err) => {
        if (!res.writableEnded) {
            res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Request stream error', details: err.message }));
        }
    });
}
