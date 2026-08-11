import http from 'http';
import { serverApplications } from '../websocket/connectionManager.js';

// Get applications received from local server(s)
export function getApplicationJson(targetId?: string): any[] {
    if (targetId) {
        return serverApplications.get(targetId) || [];
    }
    const allApps: any[] = [];
    for (const apps of serverApplications.values()) {
        allApps.push(...apps);
    }
    return allApps;
}

// Send application JSON to HTTP response
export function sendApplicationJson(res: http.ServerResponse, targetId?: string): void {
    try {
        const applications = getApplicationJson(targetId);
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(applications));
    } catch (error: any) {
        console.error('Error sending application JSON:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to retrieve application catalog' }));
    }
}
