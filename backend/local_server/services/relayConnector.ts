import { WebSocket } from 'ws';
import { sendApplicationJson } from '../NetStore/NetStore.js';

/**
 * Helper to construct the relay connection URL.
 * Supports direct RELAY_URL or combinations of RELAY_HOST/RELAY_IP/RELAY_DOMAIN, RELAY_PORT, and RELAY_SSL.
 */
function getRelayUrl(): string {
    if (process.env.RELAY_URL) {
        return process.env.RELAY_URL;
    }
    const host = process.env.RELAY_HOST || process.env.RELAY_IP || process.env.RELAY_DOMAIN || 'localhost';
    const port = process.env.RELAY_PORT || '4536';
    const ssl = process.env.RELAY_SSL !== 'false';
    const protocol = ssl ? 'wss' : 'ws';
    return `${protocol}://${host}:${port}`;
}

/**
 * Creates a WebSocket connection to the relay server.
 * Defaults to secure wss:// connection.
 */
export function connectToRelay(token: string): WebSocket {
    const relayUrl = getRelayUrl();

    // Support self-signed certs in development (if REJECT_UNAUTHORIZED=false)
    const options = {
        rejectUnauthorized: process.env.REJECT_UNAUTHORIZED?.trim().toLowerCase() !== 'false'
    };

    const ws = new WebSocket(`${relayUrl}/connect?token=${token}`, options);
    return ws;
}

/**
 * Establishes a persistent control channel connection with the relay server.
 * Listens for 'init_session' events to spawn on-demand SSH data connections.
 */
export function handleRelayConnection(token: string): void {
    console.log('Connecting to NetLink relay server...');
    const controlWs = connectToRelay(token);
    let pingInterval: NodeJS.Timeout;

    controlWs.on('open', async () => {
        console.log('Successfully connected to relay server control channel.');

        // Keep-alive ping to prevent reverse proxies (e.g. Traefik/Nginx) from dropping idle connections
        pingInterval = setInterval(() => {
            if (controlWs.readyState === WebSocket.OPEN) {
                controlWs.ping();
            }
        }, 30000);

        // Send applications JSON from NetStore
        try {
            await sendApplicationJson(controlWs);
        } catch (err) {
            console.error('Error sending applications JSON:', err);
        }
    });

    controlWs.on('message', (data: any) => {
        try {
            const message = JSON.parse(data.toString());
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
