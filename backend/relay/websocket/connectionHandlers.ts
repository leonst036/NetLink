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
import { denoSandbox } from '../sandbox/DenoSandbox.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RELAY_APPS_DIR = path.join(__dirname, '..', 'NetStore', 'Applications');
const PERMISSIONS_FILE = path.join(RELAY_APPS_DIR, 'permissions.json');

function getGrantedPermissions(): Record<string, any> {
    if (!fs.existsSync(PERMISSIONS_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

function getAppGranted(grantedRecord: Record<string, any>, appId: string) {
    const raw = grantedRecord[appId];
    if (!raw) return { folders: [], allowRun: false, allowEnv: [], allowNet: false };
    if (Array.isArray(raw)) {
        return { folders: raw, allowRun: false, allowEnv: [], allowNet: false };
    }
    return {
        folders: Array.isArray(raw.folders) ? raw.folders : [],
        allowRun: Boolean(raw.allowRun),
        allowEnv: Array.isArray(raw.allowEnv) ? raw.allowEnv : [],
        allowNet: typeof raw.allowNet === 'boolean' ? raw.allowNet : Boolean(raw.allowNet)
    };
}

function saveGrantedPermissions(perms: Record<string, any>) {
    fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(perms, null, 2));
}

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
                        const userId = app.userId;
                        if (!userId) continue;

                        const absoluteRelayAppsDir = path.resolve(RELAY_APPS_DIR);
                        const appDir = path.resolve(RELAY_APPS_DIR, userId, appId);
                        
                        // Security check: Ensure appDir is strictly within RELAY_APPS_DIR
                        if (!appDir.startsWith(absoluteRelayAppsDir + path.sep)) {
                            console.warn(`Security risk: Path traversal attempt with appId: ${appId} or userId: ${userId}`);
                            continue;
                        }
                        
                        const sandboxAppId = `${userId}_${appId}`;
                        
                        // Stop any running Deno sandbox on relay before replacing files
                        denoSandbox.stopApp(sandboxAppId);

                        // Clean destination appDir on relay to remove any stale assets
                        if (fs.existsSync(appDir)) {
                            fs.rmSync(appDir, { recursive: true, force: true });
                        }
                        fs.mkdirSync(appDir, { recursive: true });
                        
                        const absoluteAppDir = path.resolve(appDir);
                        for (const fileData of app.files) {
                            const filePath = path.resolve(appDir, fileData.path);
                            
                            // Security check: Ensure filePath is strictly within appDir
                            if (!filePath.startsWith(absoluteAppDir + path.sep)) {
                                console.warn(`Security risk: Path traversal attempt for path: ${fileData.path}`);
                                continue;
                            }

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
                            const indexJsonPath = path.join(appDir, 'index.json');
                            let requestedFolders: any[] = [];
                            let requestedPerms: any = {};
                            let appName = appId;
                            
                            if (fs.existsSync(indexJsonPath)) {
                                try {
                                    const indexData = JSON.parse(fs.readFileSync(indexJsonPath, 'utf-8'));
                                    appName = indexData.name || appId;
                                    if (Array.isArray(indexData.requiredExternalFolders)) {
                                        requestedFolders = indexData.requiredExternalFolders;
                                    }
                                    if (indexData.requestedPermissions) {
                                        requestedPerms = indexData.requestedPermissions;
                                    }
                                } catch {}
                            }
                            
                            const grantedAll = getGrantedPermissions();
                            const appGranted = getAppGranted(grantedAll, appId);
                            
                            const foldersGranted = requestedFolders.every(f => appGranted.folders.includes(f.path));
                            const runGranted = !requestedPerms.allowRun || appGranted.allowRun;
                            const envGranted = !requestedPerms.allowEnv || (
                                Array.isArray(requestedPerms.allowEnv) && requestedPerms.allowEnv.every((v: string) => appGranted.allowEnv.includes(v))
                            );

                            if (!foldersGranted || !runGranted || !envGranted) {
                                console.log(`App ${appId} requires permissions. Requesting from frontend...`);
                                const clients = frontendClients.get(identifier);
                                if (clients) {
                                    clients.forEach(client => {
                                        if (client.readyState === WebSocket.OPEN) {
                                            client.send(JSON.stringify({
                                                type: 'permission_request',
                                                appId,
                                                appName,
                                                folders: requestedFolders,
                                                requestedPermissions: requestedPerms
                                            }));
                                        }
                                    });
                                }
                                continue; // Wait for approval before starting
                            }
                            
                            const extraFlags: string[] = [];
                            if (appGranted.folders.length > 0 && requestedFolders.length > 0) {
                                requestedFolders.forEach(f => {
                                    if (appGranted.folders.includes(f.path)) {
                                        if (f.mode === 'write') extraFlags.push(`--allow-write=${f.path}`);
                                        extraFlags.push(`--allow-read=${f.path}`);
                                    }
                                });
                            }

                            if (requestedPerms.allowRun && appGranted.allowRun) {
                                if (Array.isArray(requestedPerms.allowRunCommands) && requestedPerms.allowRunCommands.length > 0) {
                                    extraFlags.push(`--allow-run=${requestedPerms.allowRunCommands.join(',')}`);
                                } else {
                                    extraFlags.push('--allow-run');
                                }
                            }

                            if (Array.isArray(requestedPerms.allowEnv) && requestedPerms.allowEnv.length > 0 && appGranted.allowEnv) {
                                const allowedEnvVars = requestedPerms.allowEnv.filter((v: string) => appGranted.allowEnv.includes(v));
                                if (allowedEnvVars.length > 0) {
                                    extraFlags.push(`--allow-env=PORT,${allowedEnvVars.join(',')}`);
                                }
                            }

                            if (requestedPerms.allowNet && appGranted.allowNet) {
                                if (Array.isArray(requestedPerms.allowNet) && requestedPerms.allowNet.length > 0) {
                                    extraFlags.push(`--allow-net=${requestedPerms.allowNet.join(',')}`);
                                }
                            }
                            
                            try {
                                await denoSandbox.startApp(sandboxAppId, entryFile, appDir, extraFlags);
                                console.log(`Started relay Deno sandbox for app: ${sandboxAppId}`);
                            } catch (err) {
                                console.error(`Failed to start relay Deno sandbox for app ${sandboxAppId}:`, err);
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
            sessionId: activeSessionId,
            userId: identifier
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
    
    ws.on('message', async (data: any) => {
        try {
            const message = JSON.parse(data.toString());
            if (message.type === 'permission_response' && message.appId) {
                if (message.granted) {
                    console.log(`Permission granted for app ${message.appId}`);
                    const perms = getGrantedPermissions();
                    perms[message.appId] = message.permissions || {
                        folders: (message.folders || []).map((f: any) => typeof f === 'string' ? f : f.path),
                        allowRun: Boolean(message.allowRun),
                        allowEnv: message.allowEnv || [],
                        allowNet: Boolean(message.allowNet)
                    };
                    saveGrantedPermissions(perms);
                    
                    // Request the local server to resync the app which will trigger start
                    const controlWs = controlConnections.get(targetId);
                    if (controlWs && controlWs.readyState === WebSocket.OPEN) {
                        controlWs.send(JSON.stringify({ type: 'sync_app', appId: message.appId }));
                    }
                } else {
                    console.log(`Permission denied for app ${message.appId}`);
                }
            }
        } catch (err) {
            console.error('Failed to parse desktop message:', err);
        }
    });

    ws.on('close', () => {
        clients!.delete(ws);
        if (clients!.size === 0) {
            frontendClients.delete(targetId);
        }
    });
}
