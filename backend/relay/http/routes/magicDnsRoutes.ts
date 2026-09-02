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

            // Helper to register a single device entry
            const registerItem = (item: any): string[] => {
                if (!item || typeof item !== 'object') return [];
                const ip = item.ip;
                const hostname = item.hostname || item.domain || item.host;
                const nickname = item.nickname || item.nick;
                const deviceId = item.deviceId || item.targetId || item.id;
                if (!ip) return [];

                // Filter out Docker container IPs and internal Coolify domains
                const isDockerIp = ip.startsWith('10.0.1.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip);
                const isDockerDomain = (hostname && typeof hostname === 'string' && (hostname.includes('-coolify') || /^[0-9a-f]{12}$/i.test(hostname)));
                if ((isDockerIp || isDockerDomain) && deviceId !== 'local-server') {
                    return [];
                }

                const registered: string[] = [];
                // If nickname exists, register it
                if (nickname && typeof nickname === 'string' && nickname.trim()) {
                    const nickDomain = magicDnsRegistry.registerNode(nickname.trim(), ip);
                    if (nickDomain && !registered.includes(nickDomain)) registered.push(nickDomain);
                }
                // If hostname exists, register it as well (so BOTH are available if both exist)
                if (hostname && typeof hostname === 'string' && hostname.trim()) {
                    const hostDomain = magicDnsRegistry.registerNode(hostname.trim(), ip);
                    if (hostDomain && !registered.includes(hostDomain)) registered.push(hostDomain);
                }
                if (registered.length === 0 && (deviceId || item.domain)) {
                    const d = magicDnsRegistry.registerNode(item.domain || deviceId, ip);
                    if (d) registered.push(d);
                }
                if (deviceId && registered.length > 0) {
                    magicDnsRegistry.registerDevice(deviceId, nickname || hostname || deviceId, ip);
                }
                return registered;
            };

            magicDnsRegistry.cleanDockerRecords();

            // Support Array of devices/records
            if (Array.isArray(body)) {
                const allRegistered: string[] = [];
                for (const item of body) {
                    const resDomains = registerItem(item);
                    allRegistered.push(...resDomains);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, count: allRegistered.length, domains: allRegistered }));
                return;
            }

            // Support object with { devices: [...], nicknames: {...} } or { records: [...] }
            if (Array.isArray(body.devices) || Array.isArray(body.records)) {
                const list = body.devices || body.records;
                const nicknames = body.nicknames || {};
                const allRegistered: string[] = [];
                for (const item of list) {
                    const ip = item.ip || item.id;
                    const nick = nicknames[ip] || item.nickname || item.nick;
                    const resDomains = registerItem({ ...item, ip, nickname: nick });
                    allRegistered.push(...resDomains);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, count: allRegistered.length, domains: allRegistered }));
                return;
            }

            // Single item registration
            const { domain, hostname, nickname, ip, deviceId } = body;
            if (!ip || (!domain && !hostname && !nickname && !deviceId)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing required parameters (ip and hostname/nickname/domain/deviceId)' }));
                return;
            }

            const registeredDomains = registerItem(body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                domains: registeredDomains,
                domain: registeredDomains[0] || '',
                ip
            }));
            return;
        }

        if (pathname === '/api/dns/records' && req.method === 'DELETE') {
            const body = await parseJsonBody(req);
            const domainParam = parsedUrl.searchParams.get('domain') || body.domain;
            const deviceIdParam = parsedUrl.searchParams.get('deviceId') || body.deviceId;

            if (parsedUrl.searchParams.get('cleanDocker') === 'true' || body.cleanDocker === true) {
                const cleanedCount = magicDnsRegistry.cleanDockerRecords();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, cleanedCount }));
                return;
            }

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
