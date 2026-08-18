import http from 'http';
import { URL } from 'url';
import { handleLogin } from '../auth/login.js';
import { getMongoClient } from '../database/MongoManager.js';
import { handleRegisterRoute, handleValidateTargetRoute, handleTicketRoute } from './routes/authRoutes.js';
import { handleUsersRoute } from './routes/userRoutes.js';
import { handleServerLoginsRoute } from './routes/serverRoutes.js';
import { handleInstallScriptRoute, handleDemoScriptRoute, handleDemoSetupRoute } from './routes/scriptRoutes.js';
import { handleFaviconRoute, handleStaticFileRoute, handleAppFrontendRoute } from './routes/staticRoutes.js';
import { handleNetStoreApplicationsRoute, handleInstallApplicationRoute, handleUninstallApplicationRoute, handleFetchApplicationCatalogRoute } from './routes/netStoreRoutes.js';
import { handleTunnelRoutes } from './routes/tunnelRoutes.js';
import { handleDockRoute } from './routes/dockRoutes.js';
import { handleAppDatabaseRoute } from './routes/appDatabaseRoutes.js';

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Router } from './Router.js';
import httpProxy from 'http-proxy';
import { denoSandbox } from '../sandbox/DenoSandbox.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const appRouter = new Router();
const proxy = httpProxy.createProxyServer({});

// Log proxy errors
proxy.on('error', (err, req, res) => {
    console.error('Proxy error:', err);
    if (res instanceof http.ServerResponse) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Bad Gateway');
    }
});

// Health check route
appRouter.get('/health', (req, res) => {
    const mongoClient = getMongoClient();
    if (mongoClient) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('NetLink Relay Server is running with MongoDB.\n');
    } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('NetLink Relay Server is running but MongoDB is not available.\n');
    }
});

// Favicon route
appRouter.get('/favicon.svg', (req, res) => { handleFaviconRoute(res); });

// Auth routes
appRouter.post('/api/login', handleLogin);
appRouter.post('/login', handleLogin);
appRouter.post('/api/register', (req, res) => handleRegisterRoute(req, res));
appRouter.post('/register', (req, res) => handleRegisterRoute(req, res));
appRouter.post('/api/validate-target', (req, res, parsedUrl) => handleValidateTargetRoute(parsedUrl, req, res));
appRouter.post('/api/auth/ticket', (req, res, parsedUrl) => handleTicketRoute(req, res, parsedUrl));

// Script routes
appRouter.get('/api/install.sh', handleInstallScriptRoute);
appRouter.get('/api/demo.sh', handleDemoScriptRoute);
appRouter.get('/api/demo-setup', handleDemoSetupRoute);

// Server & Devices routes
appRouter.get('/api/server-logins', (req, res, parsedUrl) => handleServerLoginsRoute(parsedUrl, req, res));
appRouter.post('/api/server-logins', (req, res, parsedUrl) => handleServerLoginsRoute(parsedUrl, req, res));
appRouter.delete('/api/server-logins', (req, res, parsedUrl) => handleServerLoginsRoute(parsedUrl, req, res));

// Topology routes

// User management routes
appRouter.get('/api/users', (req, res, parsedUrl) => handleUsersRoute(parsedUrl, req, res));
appRouter.post('/api/users', (req, res, parsedUrl) => handleUsersRoute(parsedUrl, req, res));
appRouter.put('/api/users', (req, res, parsedUrl) => handleUsersRoute(parsedUrl, req, res));
appRouter.delete('/api/users', (req, res, parsedUrl) => handleUsersRoute(parsedUrl, req, res));

// NetStore application catalog route
appRouter.get('/api/applications', (req, res, parsedUrl) => handleNetStoreApplicationsRoute(parsedUrl, req, res));
appRouter.get('/api/netstore/catalog', (req, res, parsedUrl) => handleFetchApplicationCatalogRoute(parsedUrl, req, res));
appRouter.get('/api/netstore', (req, res, parsedUrl) => handleNetStoreApplicationsRoute(parsedUrl, req, res));
appRouter.post('/api/applications/install', (req, res, parsedUrl) => handleInstallApplicationRoute(parsedUrl, req, res));
appRouter.post('/api/applications/uninstall', (req, res, parsedUrl) => handleUninstallApplicationRoute(parsedUrl, req, res));

// TCP Port Forwarding Tunnel routes
appRouter.all('/api/tunnels', (req, res, parsedUrl) => handleTunnelRoutes(parsedUrl, req, res));
appRouter.all('/api/tunnels/open', (req, res, parsedUrl) => handleTunnelRoutes(parsedUrl, req, res));
appRouter.all('/api/tunnels/close', (req, res, parsedUrl) => handleTunnelRoutes(parsedUrl, req, res));

// Dock configuration routes
appRouter.get('/api/dock', (req, res, parsedUrl) => handleDockRoute(parsedUrl, req, res));
appRouter.post('/api/dock', (req, res, parsedUrl) => handleDockRoute(parsedUrl, req, res));

// App Database unified command route
appRouter.all('/api/db', (req, res, parsedUrl) => handleAppDatabaseRoute(parsedUrl, req, res));
appRouter.all('/api/apps/db', (req, res, parsedUrl) => handleAppDatabaseRoute(parsedUrl, req, res));


/**
 * Main HTTP Request Handler - routes incoming HTTP requests to dedicated route controllers.
 */
export function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // Check if it's a proxied app request: /api/<appId>/...
    const match = parsedUrl.pathname.match(/^\/api\/([^\/]+)(?:\/|$)/);
    if (match) {
        const appId = match[1] as string;
        // Exclude system api routes like login, register, servers etc.
        const systemRoutes = ['login', 'register', 'validate-target', 'install.sh', 'demo.sh', 'demo-setup', 'server-logins', 'users', 'applications', 'netstore', 'dock', 'auth', 'db', 'apps', 'tunnels'];
        if (!systemRoutes.includes(appId)) {
            let userId = 'unknown';
            try {
                // Manually parse token to get userId for routing (avoids async DB lookup)
                const cookieHeader = req.headers.cookie || '';
                const matchToken = cookieHeader.match(/netlink_token=([^;]+)/);
                const token = matchToken ? matchToken[1] : (req.headers.authorization?.split(' ')[1] || parsedUrl.searchParams.get('token'));
                if (token) {
                    const parts = token.split('.');
                    if (parts.length >= 2 && parts[1]) {
                        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                        if (payload && payload.userId) {
                            userId = payload.userId;
                        }
                    }
                }
            } catch (e) {
                // Ignore parse errors, will just fail to route
            }

            const app = denoSandbox.getApp(`${userId}_${appId}`);
            if (app) {
                proxy.web(req, res, { target: `http://localhost:${app.port}` });
                return;
            }
        }
    }

    // First, try to handle the request with the dynamic router
    const handled = appRouter.handle(req, res, parsedUrl);

    // If no route matched, fallback to static file serving
    if (!handled) {
        const pathname = parsedUrl.pathname;
        if (pathname.startsWith('/built-in-apps/')) {
            const filePath = pathname.replace('/built-in-apps/', '');
            // Resolve applications directory in both dev (source) and dist modes
            const candidates = [
                path.join(__dirname, '..', '..', '..', '..', 'NetLink-NetStore', 'applications'),
                path.join(__dirname, '..', '..', '..', '..', '..', 'NetLink-NetStore', 'applications'),
                path.join(process.cwd(), '..', 'NetLink-NetStore', 'applications')
            ];
            let applicationsDir: string = candidates[0] || '';
            for (const cand of candidates) {
                if (fs.existsSync(cand)) {
                    applicationsDir = cand;
                    break;
                }
            }

            const absolutePath = path.join(applicationsDir, filePath);

            if (!absolutePath.startsWith(applicationsDir)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }

            try {
                if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
                    const ext = path.extname(absolutePath);
                    let contentType = 'text/plain';
                    if (ext === '.html') contentType = 'text/html';
                    else if (ext === '.js' || ext === '.mjs') contentType = 'application/javascript';
                    else if (ext === '.css') contentType = 'text/css';
                    else if (ext === '.svg') contentType = 'image/svg+xml';
                    else if (ext === '.png') contentType = 'image/png';
                    else if (ext === '.json') contentType = 'application/json';

                    const noCacheHeaders = {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    };
                    res.writeHead(200, { 'Content-Type': contentType, ...noCacheHeaders });
                    if (ext === '.html') {
                        let html = fs.readFileSync(absolutePath, 'utf-8');
                        html = html.replace(/="\/assets\//g, '="./assets/');
                        res.end(html);
                    } else {
                        fs.createReadStream(absolutePath).pipe(res);
                    }
                    return;
                } else {
                    res.writeHead(404);
                    res.end('Not found');
                    return;
                }
            } catch (e) {
                res.writeHead(500);
                res.end('Internal error');
                return;
            }
        }

        if (pathname.startsWith('/apps/')) {
            handleAppFrontendRoute(pathname, res);
        } else {
            handleStaticFileRoute(pathname, res);
        }
    }
}
