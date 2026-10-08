import http from 'http';
import { URL } from 'url';
import { handleLogin } from '../auth/login.js';
import { getMongoClient } from '../database/MongoManager.js';
import { handleRegisterRoute, handleValidateTargetRoute, handleTicketRoute } from './routes/authRoutes.js';
import { handleDeviceCodeRoute, handleDeviceTokenRoute, handleDeviceSessionInfoRoute, handleDeviceApproveRoute } from './routes/deviceAuthRoutes.js';
import { handleUsersRoute } from './routes/userRoutes.js';
import { handleServerLoginsRoute } from './routes/serverRoutes.js';
import { handleInstallScriptRoute, handleDemoScriptRoute, handleDemoSetupRoute } from './routes/scriptRoutes.js';
import { handleFaviconRoute, handleStaticFileRoute, handleAppFrontendRoute } from './routes/staticRoutes.js';
import { handleNetStoreApplicationsRoute, handleInstallApplicationRoute, handleUninstallApplicationRoute, handleFetchApplicationCatalogRoute } from './routes/netStoreRoutes.js';
import { handleTunnelRoutes } from './routes/tunnelRoutes.js';
import { handleDockRoute } from './routes/dockRoutes.js';
import { handleAppDatabaseRoute } from './routes/appDatabaseRoutes.js';
import { handleNotificationSoundRoute } from './routes/soundRoutes.js';
import { handleNetConnectListRoute, handleNetConnectPingRoute } from './routes/netConnectRoutes.js';
import { handleMagicDnsRoutes } from './routes/magicDnsRoutes.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Router } from './Router.js';
import httpProxy from 'http-proxy';
import { denoSandbox } from '../sandbox/DenoSandbox.js';
import { VerifyTokenSync, getJwtSecret } from '../auth/tokenManager.js';
import { consumeTicket } from '../auth/ticketManager.js';
import { resolveLocalNetStorePath } from '../paths.js';
import { handleLogLevelRoute } from './routes/utilityRoutes.js';

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
appRouter.all('/api/validate-target', (req, res, parsedUrl) => handleValidateTargetRoute(parsedUrl, req, res));
appRouter.post('/api/auth/ticket', (req, res, parsedUrl) => handleTicketRoute(req, res, parsedUrl));

// Device Authorization routes (RFC 8628 style)
appRouter.post('/api/auth/device/code', (req, res, parsedUrl) => handleDeviceCodeRoute(req, res, parsedUrl));
appRouter.post('/api/auth/device/token', (req, res) => handleDeviceTokenRoute(req, res));
appRouter.get('/api/auth/device/session', (req, res, parsedUrl) => handleDeviceSessionInfoRoute(req, res, parsedUrl));
appRouter.post('/api/auth/device/approve', (req, res, parsedUrl) => handleDeviceApproveRoute(req, res, parsedUrl));

// Script routes
appRouter.get('/api/install.sh', handleInstallScriptRoute);
appRouter.get('/api/install.ps1', handleInstallScriptRoute);
appRouter.get('/api/demo.sh', handleDemoScriptRoute);
appRouter.get('/api/demo.ps1', handleDemoScriptRoute);
appRouter.all('/api/demo-setup', handleDemoSetupRoute);

// Sound Routes
appRouter.get('/api/sounds/notification', handleNotificationSoundRoute);

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

// NetConnect routes
appRouter.all('/api/netconnect/ping', (req, res, parsedUrl) => handleNetConnectPingRoute(req, res, parsedUrl));
appRouter.all('/api/netconnect/list', (req, res, parsedUrl) => handleNetConnectListRoute(req, res, parsedUrl));

// MagicDNS routes
appRouter.all('/api/dns', (req, res, parsedUrl) => handleMagicDnsRoutes(req, res, parsedUrl));
appRouter.all('/api/dns/status', (req, res, parsedUrl) => handleMagicDnsRoutes(req, res, parsedUrl));
appRouter.all('/api/dns/config', (req, res, parsedUrl) => handleMagicDnsRoutes(req, res, parsedUrl));
appRouter.all('/api/dns/records', (req, res, parsedUrl) => handleMagicDnsRoutes(req, res, parsedUrl));

// Utility routes
appRouter.all('/api/log-level', (req, res, parsedUrl) => handleLogLevelRoute(parsedUrl, req, res));

/**
 * Main HTTP Request Handler - routes incoming HTTP requests to dedicated route controllers.
 */
export function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    const match = parsedUrl.pathname.match(/^\/api\/([^\/]+)(?:\/|$)/);
    if (match) {
        const appId = match[1] as string;
        const systemRoutes = ['login', 'register', 'validate-target', 'install.sh', 'demo.sh', 'demo-setup', 'server-logins', 'users', 'applications', 'netstore', 'dock', 'auth', 'db', 'apps', 'tunnels', 'netconnect', 'dns', 'log-level'];
        if (!systemRoutes.includes(appId)) {
            let userId = 'unknown';
            try {
                const cookieHeader = req.headers.cookie || '';
                const matchToken = cookieHeader.match(/netlink_token=([^;]+)/);
                const authHeader = req.headers.authorization || '';
                const ticketParam = parsedUrl.searchParams.get('ticket');

                if (authHeader.startsWith('Ticket ') || ticketParam) {
                    const ticketId = authHeader.startsWith('Ticket ') ? authHeader.substring(7).trim() : (ticketParam || '');
                    if (ticketId) {
                        const ticketData = consumeTicket(ticketId);
                        if (ticketData && ticketData.userId) {
                            userId = ticketData.userId;
                        }
                    }
                }

                if (userId === 'unknown') {
                    const token = matchToken ? matchToken[1] : (authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : (authHeader.split(' ')[1] || parsedUrl.searchParams.get('token')));
                    if (token) {
                        try {
                            const decoded = VerifyTokenSync(token, getJwtSecret());
                            if (decoded && (decoded.userId || decoded.deviceId)) {
                                userId = decoded.userId || decoded.deviceId;
                            }
                        } catch { }
                    }
                }
            } catch (e) {
            }

            if (userId !== 'unknown') {
                const app = denoSandbox.getApp(`${userId}_${appId}`) || denoSandbox.getApp(appId) || denoSandbox.getApp(`admin_${appId}`);
                if (app) {
                    proxy.web(req, res, { target: `http://localhost:${app.port}` });
                    return;
                }
            }
        }
    }

    const handled = appRouter.handle(req, res, parsedUrl);

    if (!handled) {
        const pathname = parsedUrl.pathname;
        if (pathname.startsWith('/built-in-apps/')) {
            const rawFilePath = pathname.replace('/built-in-apps/', '');
            let decodedFilePath = '';
            try {
                decodedFilePath = decodeURIComponent(rawFilePath);
            } catch {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Bad Request');
                return;
            }
            if (decodedFilePath.includes('\0')) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Bad Request');
                return;
            }

            const applicationsDir = resolveLocalNetStorePath('applications');
            if (!applicationsDir) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not found');
                return;
            }

            const absoluteAppsDir = path.resolve(applicationsDir);
            const safeSuffix = path.normalize(decodedFilePath).replace(/^(\.\.[\/\\])+/, '').replace(/^[/\\]+/, '');
            const absolutePath = path.resolve(absoluteAppsDir, safeSuffix);

            if (!absolutePath.startsWith(absoluteAppsDir + path.sep) && absolutePath !== absoluteAppsDir) {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
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
            handleAppFrontendRoute(pathname, res, req);
        } else {
            handleStaticFileRoute(pathname, res);
        }
    }
}
