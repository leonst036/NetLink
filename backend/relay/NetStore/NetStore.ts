import http from 'http';
import { serverApplications } from '../websocket/connectionManager.js';

// Get applications received from local server(s)
export function getApplicationJson(targetId?: string, userId?: string): any[] {
    let allApps: any[] = [];
    if (targetId) {
        allApps = serverApplications.get(targetId) || [];
    } else {
        for (const apps of serverApplications.values()) {
            allApps.push(...apps);
        }
    }
    
    // Filter apps by userId if provided. 
    // Uninstalled apps from the GitHub catalog might not have a userId, so we include them if they aren't installed (installed: false)
    let filteredApps = allApps;
    if (userId) {
        filteredApps = allApps.filter(app => !app.installed || app.userId === userId);
    }
    
    return filteredApps;
}

// Send application JSON to HTTP response
export function sendApplicationJson(res: http.ServerResponse, targetId?: string, userId?: string): void {
    try {
        const applications = getApplicationJson(targetId, userId);
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
