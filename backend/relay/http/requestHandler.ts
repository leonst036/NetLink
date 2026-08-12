import http from 'http';
import { URL } from 'url';
import { handleLogin } from '../auth/login.js';
import { getMongoClient } from '../database/MongoManager.js';
import { handleRegisterRoute, handleValidateTargetRoute } from './routes/authRoutes.js';
import { handleUsersRoute } from './routes/userRoutes.js';
import { handleTopologyRoute } from './routes/topologyRoutes.js';
import { handleGetServersRoute, handleServerLoginsRoute } from './routes/serverRoutes.js';
import { handleSshSessionsRoute } from './routes/sshSessionRoutes.js';
import { handleInstallScriptRoute, handleDemoScriptRoute, handleDemoSetupRoute } from './routes/scriptRoutes.js';
import { handleFaviconRoute, handleStaticFileRoute, handleAppFrontendRoute } from './routes/staticRoutes.js';
import { handleNetStoreApplicationsRoute, handleInstallApplicationRoute, handleUninstallApplicationRoute } from './routes/netStoreRoutes.js';
import { handleDockRoute } from './routes/dockRoutes.js';
import { Router } from './Router.js';
import httpProxy from 'http-proxy';
import { denoSandbox } from '../sandbox/DenoSandbox.js';

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

// Script routes
appRouter.get('/api/install.sh', handleInstallScriptRoute);
appRouter.get('/api/demo.sh', handleDemoScriptRoute);
appRouter.get('/api/demo-setup', handleDemoSetupRoute);

// Server & Devices routes
appRouter.get('/api/servers', (req, res, parsedUrl) => handleGetServersRoute(parsedUrl, req, res));
appRouter.get('/api/server-logins', (req, res, parsedUrl) => handleServerLoginsRoute(parsedUrl, req, res));
appRouter.get('/api/ssh-sessions', (req, res, parsedUrl) => handleSshSessionsRoute(parsedUrl, req, res));
appRouter.post('/api/ssh-sessions', (req, res, parsedUrl) => handleSshSessionsRoute(parsedUrl, req, res));
appRouter.delete('/api/ssh-sessions', (req, res, parsedUrl) => handleSshSessionsRoute(parsedUrl, req, res));

// Topology routes
appRouter.get('/api/topology', (req, res, parsedUrl) => handleTopologyRoute(parsedUrl, req, res));

// User management routes
appRouter.get('/api/users', (req, res, parsedUrl) => handleUsersRoute(parsedUrl, req, res));

// NetStore application catalog route
appRouter.get('/api/applications', (req, res, parsedUrl) => handleNetStoreApplicationsRoute(parsedUrl, req, res));
appRouter.get('/api/netstore', (req, res, parsedUrl) => handleNetStoreApplicationsRoute(parsedUrl, req, res));
appRouter.post('/api/applications/install', (req, res, parsedUrl) => handleInstallApplicationRoute(parsedUrl, req, res));
appRouter.post('/api/applications/uninstall', (req, res, parsedUrl) => handleUninstallApplicationRoute(parsedUrl, req, res));

// Dock configuration routes
appRouter.get('/api/dock', (req, res, parsedUrl) => handleDockRoute(parsedUrl, req, res));
appRouter.post('/api/dock', (req, res, parsedUrl) => handleDockRoute(parsedUrl, req, res));


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
        const systemRoutes = ['login', 'register', 'validate-target', 'install.sh', 'demo.sh', 'demo-setup', 'servers', 'server-logins', 'ssh-sessions', 'topology', 'users', 'applications', 'netstore', 'dock'];
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
        if (parsedUrl.pathname.startsWith('/apps/')) {
            handleAppFrontendRoute(parsedUrl.pathname, res);
        } else {
            handleStaticFileRoute(parsedUrl.pathname, res);
        }
    }
}
