import net from "net";
import { WebSocket } from 'ws';
import { sendApplicationJson } from '../NetStore/NetStore.js';
import { DomainRouteDemuxer } from './domainRouteDemuxer.js';

function getRelayUrl(): string {
    if (process.env.RELAY_URL) {
        return process.env.RELAY_URL;
    }
    const host = process.env.RELAY_HOST || process.env.RELAY_IP || process.env.RELAY_DOMAIN || 'localhost';
    const port = process.env.RELAY_PORT || '4535';
    const ssl = process.env.RELAY_SSL !== 'false';
    const protocol = ssl ? 'wss' : 'ws';
    return `${protocol}://${host}:${port}`;
}


export function connectToRelay(token: string, sessionId?: string): WebSocket {
    const relayUrl = getRelayUrl();

    // Support self-signed certs in development (if REJECT_UNAUTHORIZED=false)
    const options = {
        rejectUnauthorized: process.env.REJECT_UNAUTHORIZED?.trim().toLowerCase() !== 'false'
    };

    const url = sessionId ? `${relayUrl}/connect?token=${token}&sessionId=${sessionId}` : `${relayUrl}/connect?token=${token}`;
    const ws = new WebSocket(url, options);
    return ws;
}


export function handleRelayConnection(token: string): void {
    console.log('Connecting to NetLink relay server...');
    const controlWs = connectToRelay(token);
    let pingInterval: NodeJS.Timeout;
    let lastRelayHeartbeat = Date.now();

    controlWs.on('open', async () => {
        console.log('Successfully connected to relay server control channel.');
        lastRelayHeartbeat = Date.now();

        // Keep-alive ping to prevent reverse proxies (e.g. Traefik/Nginx) from dropping idle connections
        pingInterval = setInterval(() => {
            if (controlWs.readyState === WebSocket.OPEN) {
                controlWs.ping();
            }

            // Watchdog: If no message/ping/pong from relay for > 60s, terminate and reconnect
            if (Date.now() - lastRelayHeartbeat > 60000) {
                console.warn('No heartbeat from relay server for 60s. Terminating connection to reconnect...');
                controlWs.terminate();
            }
        }, 30000);

        // Send applications JSON from NetStore
        try {
            await sendApplicationJson(controlWs);
        } catch (err) {
            console.error('Error sending applications JSON:', err);
        }
    });

    controlWs.on('pong', () => {
        lastRelayHeartbeat = Date.now();
    });

    controlWs.on('ping', () => {
        lastRelayHeartbeat = Date.now();
        if (controlWs.readyState === WebSocket.OPEN) {
            controlWs.pong();
        }
    });

    controlWs.on('message', (data: any) => {
        lastRelayHeartbeat = Date.now();
        try {
            const message = JSON.parse(data.toString());
            if (message.type === 'ping') {
                if (controlWs.readyState === WebSocket.OPEN) {
                    controlWs.send(JSON.stringify({ type: 'pong' }));
                }
                return;
            }
            if (message.type === 'pong') {
                return;
            }
            if (message.type === 'install_application' && message.appId) {
                console.log(`Relay requested installation of app: ${message.appId} for user: ${message.userId}`);
                import('../NetStore/NetStore.js').then((ns) => {
                    if (ns.installApplication) {
                        ns.installApplication(
                            message.appId,
                            message.branch || 'NetStore',
                            message.githubToken,
                            message.userId,
                            message.runInBackground,
                            message.customStoreUrl
                        ).then(() => {
                            console.log(`Successfully installed ${message.appId}. Syncing with relay...`);
                            ns.sendApplicationJson(controlWs);
                            controlWs.send(JSON.stringify({ type: 'install_success', appId: message.appId }));
                        }).catch((err: any) => {
                            console.error(`Failed to install app ${message.appId}:`, err);
                            controlWs.send(JSON.stringify({ type: 'install_error', appId: message.appId, error: err.message }));
                        });
                    }
                }).catch(err => {
                    console.error('Failed to import NetStore.js:', err);
                });
            } else if (message.type === 'init_lan_stream' && message.sessionId && message.destIP && message.destPort) {
                const { sessionId, destIP, destPort } = message;
                console.log(`[LAN Forwarder] Forwarding LAN stream request for ${destIP}:${destPort} (Session: ${sessionId})`);
                const targetSocket = net.createConnection({ host: destIP, port: destPort }, () => {
                    console.log(`[LAN Forwarder] Connected to LAN target ${destIP}:${destPort}`);
                    const dataWs = connectToRelay(token, sessionId);

                    dataWs.on('open', () => {
                        targetSocket.on('data', (chunk) => {
                            if (dataWs.readyState === WebSocket.OPEN) {
                                dataWs.send(chunk);
                            }
                        });
                        dataWs.on('message', (chunk: any) => {
                            targetSocket.write(chunk);
                        });
                    });

                    const cleanup = () => {
                        if (!targetSocket.destroyed) targetSocket.destroy();
                        if (dataWs.readyState === WebSocket.OPEN) dataWs.close();
                    };

                    targetSocket.on('error', cleanup);
                    targetSocket.on('close', cleanup);
                    dataWs.on('error', cleanup);
                    dataWs.on('close', cleanup);
                });

                targetSocket.on('error', (err) => {
                    console.error(`[LAN Forwarder] Failed to connect to LAN target ${destIP}:${destPort}:`, err);
                });
            } else if (message.type === 'init_domainroute' && message.sessionId) {
                const { sessionId } = message;
                console.log(`[DomainRoute] Relay requested egress session (Session: ${sessionId})`);
                const dataWs = connectToRelay(token, sessionId);

                dataWs.on('open', () => {
                    console.log(`[DomainRoute] Egress session connected to relay (Session: ${sessionId})`);
                    const demuxer = new DomainRouteDemuxer(dataWs);
                    dataWs.on('close', () => {
                        demuxer.destroy();
                    });
                });

                dataWs.on('error', (err) => {
                    console.error(`[DomainRoute] Egress session error (Session: ${sessionId}):`, err);
                });
            } else if (message.type === 'uninstall_application' && message.appId) {
                console.log(`Relay requested uninstallation of app: ${message.appId} for user: ${message.userId}`);
                import('../NetStore/NetStore.js').then((ns) => {
                    if (ns.uninstallApplication) {
                        ns.uninstallApplication(message.appId, message.userId).then(() => {
                            console.log(`Successfully uninstalled ${message.appId}. Syncing with relay...`);
                            ns.sendApplicationJson(controlWs);
                            controlWs.send(JSON.stringify({ type: 'uninstall_success', appId: message.appId }));
                        }).catch((err: any) => {
                            console.error(`Failed to uninstall app ${message.appId}:`, err);
                            controlWs.send(JSON.stringify({ type: 'uninstall_error', appId: message.appId, error: err.message }));
                        });
                    }
                }).catch(err => {
                    console.error('Failed to import NetStore.js:', err);
                });
            } else if (message.type === 'grant_permissions' && message.appId) {
                console.log(`Relay granted permissions for app: ${message.appId}`);
                import('../NetStore/NetStore.js').then((ns) => {
                    if (ns.saveAppPermissions) {
                        ns.saveAppPermissions(message.appId, message.permissions);
                    }
                    if (ns.StartLocalApps) {
                        ns.StartLocalApps(undefined, true).then(() => {
                            ns.sendApplicationJson(controlWs);
                        });
                    }
                }).catch(err => {
                    console.error('Failed to import NetStore.js:', err);
                });
            } else if (message.type === 'sync_app') {
                import('../NetStore/NetStore.js').then((ns) => {
                    if (ns.StartLocalApps) {
                        ns.StartLocalApps(undefined, true).then(() => {
                            ns.sendApplicationJson(controlWs);
                        });
                    }
                }).catch(err => {
                    console.error('Failed to import NetStore.js:', err);
                });
            }
        } catch (err) {
            console.error('Error handling relay control message:', err);
        }
    });

    controlWs.on('close', () => {
        clearInterval(pingInterval);
        console.warn('Relay control connection closed. Attempting to reconnect in 5 seconds...');
        setTimeout(() => {
            handleRelayConnection(token);
        }, 5000);
    });

    controlWs.on('error', (err) => {
        console.error('Relay control connection error:', err);
    });
}
