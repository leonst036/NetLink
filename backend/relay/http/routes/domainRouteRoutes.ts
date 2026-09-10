import http from 'http';
import { URL } from 'url';
import { getDomainRouteConfig, updateDomainRouteConfig } from '../../domainroute/domainRouteManager.js';
import { getDomainRouteStats } from '../../websocket/domainRouteDemuxer.js';
import { extractTokenFromRequest, authenticateToken } from '../../auth/authenticator.js';
import { getMongoClient } from '../../database/MongoManager.js';

function setCorsHeaders(res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function jsonResponse(res: http.ServerResponse, data: any, status = 200): void {
    setCorsHeaders(res);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function parseJsonBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}

export async function handleDomainRouteRoutes(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    parsedUrl: URL
): Promise<void> {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Verify token if present
    const token = extractTokenFromRequest(req, parsedUrl);
    if (token) {
        try {
            await authenticateToken(token, getMongoClient());
        } catch (err: any) {
            return jsonResponse(res, { error: 'Unauthorized: ' + err.message }, 401);
        }
    }

    const pathname = parsedUrl.pathname;

    try {
        // GET /api/domainroute/config
        if (pathname === '/api/domainroute/config' && req.method === 'GET') {
            const config = getDomainRouteConfig();
            return jsonResponse(res, {
                enabled: config.enabled,
                proxyPort: config.proxyPort,
                rules: config.rules
            });
        }

        // POST /api/domainroute/config
        if (pathname === '/api/domainroute/config' && req.method === 'POST') {
            const body = await parseJsonBody(req);
            const updated = await updateDomainRouteConfig(body);
            return jsonResponse(res, {
                success: true,
                enabled: updated.enabled,
                proxyPort: updated.proxyPort,
                rules: updated.rules
            });
        }

        // GET /api/domainroute/stats
        if (pathname === '/api/domainroute/stats' && req.method === 'GET') {
            const stats = getDomainRouteStats();
            return jsonResponse(res, stats);
        }

        // Fallback root status: GET /api/domainroute
        if (pathname === '/api/domainroute' && req.method === 'GET') {
            const config = getDomainRouteConfig();
            const stats = getDomainRouteStats();
            return jsonResponse(res, {
                config,
                stats
            });
        }

        return jsonResponse(res, { error: 'Not Found' }, 404);
    } catch (err: any) {
        console.error('[DomainRoute] Route error:', err);
        return jsonResponse(res, { error: 'Internal server error: ' + err.message }, 500);
    }
}
