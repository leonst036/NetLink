import { WebSocket } from 'ws';
import crypto from 'crypto';
import { 
    controlConnections, 
    pendingSessions, 
    serverDevices,
    serverApplications,
    bridgeSockets,
    frontendClients
} from './connectionManager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { appRouter } from '../http/requestHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RELAY_APPS_DIR = path.join(__dirname, '..', 'NetStore', 'Applications');

/**
 * Handles incoming local server registration and session requests.
 */
export function handleLocalServerConnection(
    ws: WebSocket, 
    identifier: string, 
    token: string | null, 
    sessionId: string | null
): void {
    if (sessionId) {
        // Dedicated data session channel requested by the relay
        const clientWs = pendingSessions.get(sessionId);
        if (clientWs && clientWs.readyState === WebSocket.OPEN) {
            pendingSessions.delete(sessionId);
            console.log(`Pairing data session ${sessionId} for server ${identifier}`);
            bridgeSockets(ws, clientWs);
            
            // Notify the client that the backend bridge is ready
            clientWs.send(JSON.stringify({ type: 'ready_for_credentials' }));
        } else {
            console.warn(`No pending client session or client disconnected for session: ${sessionId}`);
            ws.close(1008, 'Session expired or client disconnected');
        }
    } else {
        // Control connection
        controlConnections.set(identifier, ws);

        console.log(`Registered local server connection: ${identifier}`);

        ws.on('message', async (data: any) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.type === 'server_list' && Array.isArray(message.devices)) {
                    console.log(`Received ${message.devices.length} devices from local server: ${identifier}`);
                    serverDevices.set(identifier, message.devices);
                }

                if ((message.type === 'applications' || message.type === 'application_json') && Array.isArray(message.applications)) {
                    console.log(`Received ${message.applications.length} applications from local server: ${identifier}`);
                    serverApplications.set(identifier, message.applications);
                }

                if (message.type === 'sync-app-backends' && Array.isArray(message.backends)) {
                    console.log(`Syncing ${message.backends.length} applications from local server: ${identifier}`);
                    for (const app of message.backends) {
                        const appId = app.appId;
                        const appDir = path.join(RELAY_APPS_DIR, appId);
                        
                        if (!fs.existsSync(appDir)) {
                            fs.mkdirSync(appDir, { recursive: true });
                        }
                        
                        for (const fileData of app.files) {
                            const filePath = path.join(appDir, fileData.path);
                            const fileDir = path.dirname(filePath);
                            if (!fs.existsSync(fileDir)) {
                                fs.mkdirSync(fileDir, { recursive: true });
                            }
                            const decodedContent = Buffer.from(fileData.content, 'base64');
                            fs.writeFileSync(filePath, decodedContent);
                        }

                        const relayDir = path.join(appDir, 'relay');
                        const entryTs = path.join(relayDir, 'index.ts');
                        const entryJs = path.join(relayDir, 'index.js');
                        const entryFile = fs.existsSync(entryTs) ? entryTs : (fs.existsSync(entryJs) ? entryJs : null);

                        if (entryFile) {
                            try {
                                const moduleUrl = `file://${entryFile}?update=${Date.now()}`;
                                const appModule = await import(moduleUrl);
                                if (typeof appModule.registerRoutes === 'function') {
                                    appModule.registerRoutes(appRouter);
                                    console.log(`Registered backend routes for app: ${appId}`);
                                } else {
                                    console.warn(`App ${appId} does not export registerRoutes(appRouter) in relay/index.ts`);
                                }
                            } catch (err) {
                                console.error(`Failed to load backend for app ${appId}:`, err);
                            }
                        }
                    }
                }
                
                // Forward message (scanning, server_list, etc.) to all connected frontend clients
                const clients = frontendClients.get(identifier);
                if (clients) {
                    clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(data.toString());
                        }
                    });
                }
            } catch (err) {
                // Ignore parse errors on control channel
            }
        });

        ws.on('close', () => {
            console.log(`Local server disconnected: ${identifier}`);
            if (controlConnections.get(identifier) === ws) {
                controlConnections.delete(identifier);
                serverDevices.delete(identifier);
                serverApplications.delete(identifier);
            }
        });
    }
}

/**
 * Handles incoming client connection requests and coordinates handshake with the target local server.
 */
export function handleClientConnection(
    ws: WebSocket, 
    identifier: string, 
    targetId: string,
    sessionId: string | null
): void {
    console.log(`Client requested connection to target: ${targetId}`);

    // Initiate session using the control connection
    const controlWs = controlConnections.get(targetId);
    if (controlWs && controlWs.readyState === WebSocket.OPEN) {
        const activeSessionId = sessionId || crypto.randomUUID();
        pendingSessions.set(activeSessionId, ws);
        console.log(`Requesting new data connection from local server: ${targetId} (Session: ${activeSessionId})`);
        
        controlWs.send(JSON.stringify({
            type: 'init_session',
            sessionId: activeSessionId
        }));

        // Timeout after 10 seconds if server doesn't establish the connection
        const timeoutId = setTimeout(() => {
            if (pendingSessions.has(activeSessionId)) {
                console.warn(`Session ${activeSessionId} initiation timed out`);
                pendingSessions.delete(activeSessionId);
                ws.close(4008, 'Local server failed to respond in time');
            }
        }, 10000);

        ws.on('close', () => {
            clearTimeout(timeoutId);
            pendingSessions.delete(activeSessionId);
        });
    } else {
        console.warn(`Target local server ${targetId} not online`);
        ws.close(1011, 'Target local server not online');
    }
}

/**
 * Handles incoming frontend desktop connections for real-time events.
 */
export function handleDesktopConnection(ws: WebSocket, targetId: string): void {
    let clients = frontendClients.get(targetId);
    if (!clients) {
        clients = new Set();
        frontendClients.set(targetId, clients);
    }
    clients.add(ws);

    // Send the current list immediately if available
    const devices = serverDevices.get(targetId);
    if (devices) {
        ws.send(JSON.stringify({ type: 'server_list', devices }));
    }

    ws.on('close', () => {
        clients!.delete(ws);
        if (clients!.size === 0) {
            frontendClients.delete(targetId);
        }
    });
}
