import http from 'http';
import { URL } from 'url';
import { magicDnsRegistry } from '../../dns/MagicDnsRegistry.js';

function setCorsHeaders(res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

export async function handleMagicDnsRoutes(req: http.IncomingMessage, res: http.ServerResponse, parsedUrl: URL): Promise<void> {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const pathname = parsedUrl.pathname;

    try {
        if (pathname === '/api/dns/status' && req.method === 'GET') {
            const records = magicDnsRegistry.getAllRecords();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'running',
                port: process.env.DNS_PORT ? parseInt(process.env.DNS_PORT, 10) : 53,
                host: process.env.MAGIC_DNS_HOST || '0.0.0.0',
                suffix: 'netlink',
                totalRecords: Object.keys(records).length
            }));
            return;
        }

        if (pathname === '/api/dns/config' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                enabled: true,
                server: process.env.MAGIC_DNS_HOST || req.headers.host?.split(':')[0] || '127.0.0.1',
                port: process.env.DNS_PORT ? parseInt(process.env.DNS_PORT, 10) : 53,
                suffix: 'netlink',
                records: magicDnsRegistry.getAllRecords()
            }));
            return;
        }

        if (pathname === '/api/dns/records' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                records: magicDnsRegistry.getAllRecords()
            }));
            return;
        }

        if (pathname === '/api/dns/records' && req.method === 'POST') {
            const body = await parseJsonBody(req);
            const { domain, hostname, ip, deviceId } = body;

            if (!ip || (!domain && !hostname && !deviceId)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing required parameters (ip and domain/hostname/deviceId)' }));
                return;
            }

            let registeredDomain = '';
            if (deviceId) {
                registeredDomain = magicDnsRegistry.registerDevice(deviceId, hostname || domain || deviceId, ip);
            } else {
                registeredDomain = magicDnsRegistry.registerNode(hostname || domain, ip);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, domain: registeredDomain, ip }));
            return;
        }

        if (pathname === '/api/dns/records' && req.method === 'DELETE') {
            const body = await parseJsonBody(req);
            const domainParam = parsedUrl.searchParams.get('domain') || body.domain;
            const deviceIdParam = parsedUrl.searchParams.get('deviceId') || body.deviceId;

            if (deviceIdParam) {
                const removedDomain = magicDnsRegistry.unregisterDevice(deviceIdParam);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, removedDomain }));
                return;
            }

            if (domainParam) {
                magicDnsRegistry.unregisterNode(domainParam);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, removedDomain: domainParam }));
                return;
            }

            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing domain or deviceId query/body parameter' }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Route not found' }));
    } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error', details: err.message }));
    }
}
