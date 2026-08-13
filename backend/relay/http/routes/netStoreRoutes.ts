import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL, fileURLToPath } from 'url';
import { controlConnections } from '../../websocket/connectionManager.js';
import { sendApplicationJson } from '../../NetStore/NetStore.js';
import { extractTokenFromRequest, authenticateToken } from '../../auth/authenticator.js';
import { getMongoClient } from '../../database/MongoManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RELAY_APPS_DIR = path.join(__dirname, '..', '..', 'NetStore', 'Applications');

// Route handler for NetStore applications
export async function handleNetStoreApplicationsRoute(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }
    try {
        const token = extractTokenFromRequest(req, parsedUrl);
        const decoded = await authenticateToken(token, getMongoClient());
        const target = parsedUrl.searchParams.get('target') || undefined;
        sendApplicationJson(res, target, decoded.userId);
    } catch (err: any) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: ' + err.message }));
    }
}

// Route handler for POST /api/applications/install
export async function handleInstallApplicationRoute(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    try {
        const token = extractTokenFromRequest(req, parsedUrl);
        const decoded = await authenticateToken(token, getMongoClient());
        const userId = decoded.userId;

        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { appId, target, branch, githubToken, runInBackground } = data;

                if (!appId || !target) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing appId or target' }));
                    return;
                }

                const targetWs = controlConnections.get(target);
                if (!targetWs || targetWs.readyState !== 1 /* WebSocket.OPEN */) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Target local server not found or offline' }));
                    return;
                }

                // Send command to local server
                targetWs.send(JSON.stringify({
                    type: 'install_application',
                    appId: appId,
                    userId: userId,
                    branch: branch || 'NetStore',
                    githubToken: githubToken || process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
                    runInBackground: Boolean(runInBackground)
                }));

                const requestHandler = (msg: string) => {
                    try {
                        const data = JSON.parse(msg);
                        if (data.type === 'install_success' && data.appId === appId) {
                            targetWs.removeListener('message', requestHandler);
                            clearTimeout(timeout);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, message: 'Installation completed' }));
                        } else if (data.type === 'install_error' && data.appId === appId) {
                            targetWs.removeListener('message', requestHandler);
                            clearTimeout(timeout);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: data.error }));
                        }
                    } catch (err) {}
                };
                targetWs.on('message', requestHandler);
                
                const timeout = setTimeout(() => {
                    targetWs.removeListener('message', requestHandler);
                    res.writeHead(202, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Installation command sent (timeout)' }));
                }, 15000);

            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON body' }));
            }
        });
    } catch (err: any) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: ' + err.message }));
    }
}

// Route handler for POST /api/applications/uninstall
export async function handleUninstallApplicationRoute(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    try {
        const token = extractTokenFromRequest(req, parsedUrl);
        const decoded = await authenticateToken(token, getMongoClient());
        const userId = decoded.userId;

        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { appId, target } = data;

                if (!appId || !target) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing appId or target' }));
                    return;
                }

                const targetWs = controlConnections.get(target);
                if (!targetWs || targetWs.readyState !== 1 /* WebSocket.OPEN */) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Target local server not found or offline' }));
                    return;
                }

                // Remove relay cache for app if present
                const targetAppDir = path.resolve(RELAY_APPS_DIR, userId, appId);
                const absoluteRelayAppsDir = path.resolve(RELAY_APPS_DIR);
                if (targetAppDir.startsWith(absoluteRelayAppsDir + path.sep) && fs.existsSync(targetAppDir)) {
                    fs.rmSync(targetAppDir, { recursive: true, force: true });
                }

                // Send command to local server
                targetWs.send(JSON.stringify({
                    type: 'uninstall_application',
                    appId: appId,
                    userId: userId
                }));

                const requestHandler = (msg: string) => {
                    try {
                        const data = JSON.parse(msg);
                        if (data.type === 'uninstall_success' && data.appId === appId) {
                            targetWs.removeListener('message', requestHandler);
                            clearTimeout(timeout);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, message: 'Uninstallation completed' }));
                        } else if (data.type === 'uninstall_error' && data.appId === appId) {
                            targetWs.removeListener('message', requestHandler);
                            clearTimeout(timeout);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: data.error }));
                        }
                    } catch (err) {}
                };
                targetWs.on('message', requestHandler);
                
                const timeout = setTimeout(() => {
                    targetWs.removeListener('message', requestHandler);
                    res.writeHead(202, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Uninstallation command sent (timeout)' }));
                }, 15000);

            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON body' }));
            }
        });
    } catch (err: any) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: ' + err.message }));
    }
}

