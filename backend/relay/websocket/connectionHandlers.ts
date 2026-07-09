import { WebSocket } from 'ws';
import { 
    controlConnections, 
    pendingSessions, 
    bridgeSockets 
} from './connectionManager.js';

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
        } else {
            console.warn(`No pending client session or client disconnected for session: ${sessionId}`);
            ws.close(1008, 'Session expired or client disconnected');
        }
    } else {
        // Control connection
        controlConnections.set(identifier, ws);

        console.log(`Registered local server connection: ${identifier}`);

        ws.on('close', () => {
            console.log(`Local server disconnected: ${identifier}`);
            controlConnections.delete(identifier);
        });
    }
}

/**
 * Handles incoming client connection requests and coordinates handshake with the target local server.
 */
export function handleClientConnection(
    ws: WebSocket, 
    identifier: string, 
    targetId: string
): void {
    console.log(`Client requested connection to target: ${targetId}`);

    // Initiate session using the control connection
    const controlWs = controlConnections.get(targetId);
    if (controlWs && controlWs.readyState === WebSocket.OPEN) {
        const newSessionId = Math.random().toString(36).substring(2, 15);
        pendingSessions.set(newSessionId, ws);
        console.log(`Requesting new data connection from local server: ${targetId} (Session: ${newSessionId})`);
        
        controlWs.send(JSON.stringify({
            type: 'init_session',
            sessionId: newSessionId
        }));

        // Timeout after 10 seconds if server doesn't establish the connection
        const timeoutId = setTimeout(() => {
            if (pendingSessions.has(newSessionId)) {
                console.warn(`Session ${newSessionId} initiation timed out`);
                pendingSessions.delete(newSessionId);
                ws.close(4008, 'Local server failed to respond in time');
            }
        }, 10000);

        ws.on('close', () => {
            clearTimeout(timeoutId);
            pendingSessions.delete(newSessionId);
        });
    } else {
        console.warn(`Target local server ${targetId} not online`);
        ws.close(1011, 'Target local server not online');
    }
}
