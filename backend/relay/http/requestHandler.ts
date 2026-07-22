import http from 'http';
import { URL } from 'url';
import { handleLogin } from '../auth/login.js';
import { getMongoClient } from '../database/MongoManager.js';
import { handleRegisterRoute, handleValidateTargetRoute } from './routes/authRoutes.js';
import { handleUsersRoute } from './routes/userRoutes.js';
import { handleTopologyRoute } from './routes/topologyRoutes.js';
import { handleGetServersRoute, handleServerLoginsRoute } from './routes/serverRoutes.js';
import { handleInstallScriptRoute, handleDemoScriptRoute, handleDemoSetupRoute } from './routes/scriptRoutes.js';
import { handleFaviconRoute, handleStaticFileRoute } from './routes/staticRoutes.js';

/**
 * Main HTTP Request Handler - routes incoming HTTP requests to dedicated route controllers.
 */
export function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // Health check route
    if (pathname === '/health') {
        const mongoClient = getMongoClient();
        if (mongoClient) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('NetLink Relay Server is running with MongoDB.\n');
        } else {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('NetLink Relay Server is running but MongoDB is not available.\n');
        }
        return;
    }

    // Favicon route
    if (pathname === '/favicon.svg') {
        handleFaviconRoute(res);
        return;
    }

    // Auth routes
    if (pathname === '/api/login' || pathname === '/login') {
        handleLogin(req, res);
        return;
    }

    if (pathname === '/api/register' || pathname === '/register') {
        handleRegisterRoute(req, res);
        return;
    }

    if (pathname === '/api/validate-target') {
        handleValidateTargetRoute(parsedUrl, req, res);
        return;
    }

    // Script routes
    if (pathname === '/api/install.sh') {
        handleInstallScriptRoute(req, res);
        return;
    }

    if (pathname === '/api/demo.sh') {
        handleDemoScriptRoute(req, res);
        return;
    }

    if (pathname === '/api/demo-setup') {
        handleDemoSetupRoute(req, res);
        return;
    }

    // Server & Devices routes
    if (pathname === '/api/servers') {
        handleGetServersRoute(parsedUrl, req, res);
        return;
    }

    if (pathname === '/api/server-logins') {
        handleServerLoginsRoute(parsedUrl, req, res);
        return;
    }

    // Topology routes
    if (pathname === '/api/topology') {
        handleTopologyRoute(parsedUrl, req, res);
        return;
    }

    // User management routes
    if (pathname === '/api/users') {
        handleUsersRoute(parsedUrl, req, res);
        return;
    }

    // Default: Serve static frontend files
    handleStaticFileRoute(pathname, res);
}
