import http from 'http';
import { URL } from 'url';
import { sendApplicationJson } from '../../NetStore/NetStore.js';

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
