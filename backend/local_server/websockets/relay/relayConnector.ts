import { WebSocket } from 'ws';
import { handleSshConnection } from '../sshHandler.js';
import { runNetworkScan } from '../../network/scanner.js';

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
        // Run network scan and send the results
        try {
            controlWs.send(JSON.stringify({ type: 'scanning' }));
            const devices = await runNetworkScan();
            if (controlWs.readyState === WebSocket.OPEN) {
                controlWs.send(JSON.stringify({ type: 'server_list', devices }));
            }
        } catch (err) {
            console.error('Error running network scan:', err);
        }
    });

    controlWs.on('message', (data: any) => {
        try {
            const message = JSON.parse(data.toString());
            if (message.type === 'init_session' && message.sessionId) {
                console.log(`Relay requested new SSH data session: ${message.sessionId}`);

                const relayUrl = getRelayUrl();
                const sessionWs = new WebSocket(`${relayUrl}/connect?token=${token}&sessionId=${message.sessionId}`, {
                    rejectUnauthorized: process.env.REJECT_UNAUTHORIZED?.trim().toLowerCase() !== 'false'
                });

                sessionWs.on('open', () => {
                    console.log(`Data connection established for session: ${message.sessionId}`);
                    handleSshConnection(sessionWs);
                });

                sessionWs.on('error', (err) => {
                    console.error(`Data session socket error (${message.sessionId}):`, err);
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