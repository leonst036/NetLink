import { WebSocket } from 'ws';
import crypto from 'crypto';
import { 
    controlConnections, 
    pendingSessions,
    serverApplications,
    bridgeSockets,
    frontendClients,
    broadcast,
    connectionManager
} from './connectionManager.js';
import { magicDnsRegistry } from '../dns/MagicDnsRegistry.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { appRouter } from '../http/requestHandler.js';
import { denoSandbox } from '../sandbox/DenoSandbox.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RELAY_APPS_DIR = path.join(__dirname, '..', 'NetStore', 'Applications');
const PERMISSIONS_FILE = path.join(RELAY_APPS_DIR, 'permissions.json');

export const pendingPermissionRequests = new Map<string, Map<string, any>>();

export function getGrantedPermissions(): Record<string, any> {
    if (!fs.existsSync(PERMISSIONS_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

export function getAppGranted(grantedRecord: Record<string, any>, appId: string) {
    const raw = grantedRecord[appId];
    if (!raw) return { folders: [], allowRun: false, allowEnv: [], allowNet: false, allowDatabase: false, collections: [], allowPortForwarding: false };
    if (Array.isArray(raw)) {
        return { folders: raw, allowRun: false, allowEnv: [], allowNet: false, allowDatabase: false, collections: [], allowPortForwarding: false };
    }
    return {
        folders: Array.isArray(raw.folders) ? raw.folders : [],
        allowRun: Boolean(raw.allowRun),
        allowEnv: Array.isArray(raw.allowEnv) ? raw.allowEnv : [],
        allowNet: typeof raw.allowNet === 'boolean' ? raw.allowNet : Boolean(raw.allowNet),
        allowDatabase: Boolean(raw.allowDatabase || raw.database),
        collections: Array.isArray(raw.collections) ? raw.collections : [],
        allowPortForwarding: Boolean(raw.allowPortForwarding)
    };
}

export function isDatabaseGranted(appId: string, collection?: string): boolean {
    const perms = getGrantedPermissions();
    const appGranted = getAppGranted(perms, appId);
    if (appGranted.allowDatabase) return true;
    if (!collection) return appGranted.collections.length > 0;
    return appGranted.collections.includes(collection) || appGranted.collections.includes('*');
}

export function isCollectionGranted(appId: string, collection: string): boolean {
    return isDatabaseGranted(appId, collection);
}

export function saveGrantedPermissions(perms: Record<string, any>) {
    fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(perms, null, 2));
}

/**
 * Handles incoming local server registration and session requests.
 */
export function handleLocalServerConnection(
    ws: WebSocket, 
    identifier: string, 
    token: string | null, 
    sessionId: string | null,
    decodedPayload?: any,
    reqIp?: string
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

        const deviceId = decodedPayload?.deviceId || decodedPayload?.targetId || identifier;
        const deviceName = decodedPayload?.deviceName || identifier;
        const assignedIp = decodedPayload?.assignedIp || decodedPayload?.ip || reqIp || '127.0.0.1';

        const domain = magicDnsRegistry.registerDevice(deviceId, deviceName, assignedIp);
        connectionManager.broadcast({ type: 'DNS_UPDATE', action: 'ADD', domain, ip: assignedIp });

        console.log(`Registered local server connection: ${identifier} (Domain: ${domain}, IP: ${assignedIp})`);

        ws.on('message', async (data: any) => {
            try {
                const message = JSON.parse(data.toString());

                if (message.type === 'device_handshake' || message.type === 'handshake' || message.type === 'register_device') {
                    const devId = message.deviceId || deviceId;
                    const devName = message.deviceName || deviceName;
                    const ip = message.assignedIp || message.ip || assignedIp;
                    const updatedDomain = magicDnsRegistry.registerDevice(devId, devName, ip);
                    connectionManager.broadcast({ type: 'DNS_UPDATE', action: 'ADD', domain: updatedDomain, ip });
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
                            let requestedCollections: string[] = [];
                            let requestedDb = false;
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
                                    requestedDb = Boolean(
                                        requestedPerms.allowDatabase ||
                                        requestedPerms.database ||
                                        indexData.requestedDatabase
                                    );
                                    if (Array.isArray(indexData.requestedCollections)) {
                                        requestedCollections = indexData.requestedCollections;
                                    } else if (Array.isArray(indexData.requestedPermissions?.collections)) {
                                        requestedCollections = indexData.requestedPermissions.collections;
                                    }
                                    if (requestedCollections.length > 0) {
                                        requestedDb = true;
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
                            const dbGranted = !requestedDb || appGranted.allowDatabase || (requestedCollections.length > 0 && requestedCollections.every(c => appGranted.collections.includes(c) || appGranted.collections.includes('*')));
                            const portForwardingGranted = !requestedPerms.allowPortForwarding || appGranted.allowPortForwarding;

                            if (!foldersGranted || !runGranted || !envGranted || !dbGranted || !portForwardingGranted) {
                                console.log(`App ${appId} requires permissions. Requesting from frontend...`);
                                const reqPayload = {
                                    type: 'permission_request',
                                    appId,
                                    appName,
                                    folders: requestedFolders,
                                    requestedPermissions: requestedPerms,
                                    requestedCollections: requestedCollections,
                                    allowDatabase: requestedDb
                                };
                                let targetMap = pendingPermissionRequests.get(identifier);
                                if (!targetMap) {
                                    targetMap = new Map();
                                    pendingPermissionRequests.set(identifier, targetMap);
                                }
                                targetMap.set(appId, reqPayload);

                                const clients = frontendClients.get(identifier);
                                if (clients) {
                                    clients.forEach(client => {
                                        if (client.readyState === WebSocket.OPEN) {
                                            client.send(JSON.stringify(reqPayload));
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
                serverApplications.delete(identifier);
            }
            const removedDomain = magicDnsRegistry.unregisterDevice(deviceId);
            if (removedDomain) {
                connectionManager.broadcast({ type: 'DNS_UPDATE', action: 'REMOVE', domain: removedDomain, deviceId });
            }
        });
    }
}

/**
 * Helper to handle device handshake and register DNS record.
 */
export function handleDeviceHandshake(deviceId: string, deviceName: string, assignedIp: string): string {
    const domain = magicDnsRegistry.registerDevice(deviceId, deviceName, assignedIp);
    connectionManager.broadcast({ type: 'DNS_UPDATE', action: 'ADD', domain, ip: assignedIp });
    return domain;
}

/**
 * Helper to handle device disconnect and unregister DNS record.
 */
export function handleDeviceDisconnect(deviceId: string): void {
    const domain = magicDnsRegistry.unregisterDevice(deviceId);
    if (domain) {
        connectionManager.broadcast({ type: 'DNS_UPDATE', action: 'REMOVE', domain, deviceId });
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

    // Replay any pending permission requests for this target to the newly connected desktop
    const targetPending = pendingPermissionRequests.get(targetId);
    if (targetPending && targetPending.size > 0) {
        targetPending.forEach(reqPayload => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(reqPayload));
            }
        });
    }
    
    ws.on('message', async (data: any) => {
        try {
            const message = JSON.parse(data.toString());
            if (message.type === 'permission_response' && message.appId) {
                // Clear pending permission request
                const pMap = pendingPermissionRequests.get(targetId);
                if (pMap) {
                    pMap.delete(message.appId);
                }

                if (message.granted) {
                    console.log(`Permission granted for app ${message.appId}`);
                    const perms = getGrantedPermissions();
                    perms[message.appId] = message.permissions || {
                        folders: (message.folders || []).map((f: any) => typeof f === 'string' ? f : f.path),
                        allowRun: Boolean(message.allowRun),
                        allowEnv: message.allowEnv || [],
                        allowNet: Boolean(message.allowNet),
                        allowDatabase: Boolean(message.allowDatabase || message.database || message.permissions?.allowDatabase || message.permissions?.database),
                        collections: Array.isArray(message.collections) ? message.collections : (message.permissions?.collections || [])
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
