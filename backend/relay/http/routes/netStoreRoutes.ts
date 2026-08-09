import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL, fileURLToPath } from 'url';
import { controlConnections } from '../../websocket/connectionManager.js';
import { sendApplicationJson } from '../../NetStore/NetStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RELAY_APPS_DIR = path.join(__dirname, '..', '..', 'NetStore', 'Applications');

// Route handler for NetStore applications
export function handleNetStoreApplicationsRoute(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }
    const target = parsedUrl.searchParams.get('target') || undefined;
    sendApplicationJson(res, target);
}

// Route handler for POST /api/applications/install
export function handleInstallApplicationRoute(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const { appId, target, branch, githubToken } = data;

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
                branch: branch || 'NetStore',
                githubToken: githubToken || process.env.GITHUB_TOKEN || process.env.GH_TOKEN
            }));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Installation command sent' }));

        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        }
    });
}

// Route handler for POST /api/applications/uninstall
export function handleUninstallApplicationRoute(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

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
            const targetAppDir = path.resolve(RELAY_APPS_DIR, appId);
            const absoluteRelayAppsDir = path.resolve(RELAY_APPS_DIR);
            if (targetAppDir.startsWith(absoluteRelayAppsDir + path.sep) && fs.existsSync(targetAppDir)) {
                fs.rmSync(targetAppDir, { recursive: true, force: true });
            }

            // Send command to local server
            targetWs.send(JSON.stringify({
                type: 'uninstall_application',
                appId: appId
            }));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Uninstallation command sent' }));

        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        }
    });
}

