import { WebSocket } from 'ws';

// Maps to manage active connections and routing
export const controlConnections = new Map<string, WebSocket>();
export const pendingSessions = new Map<string, WebSocket>(); // Key: sessionId, Value: Client WebSocket
export const serverApplications = new Map<string, any[]>(); // Key: identifier, Value: Array of applications
export const frontendClients = new Map<string, Set<WebSocket>>(); // Key: identifier, Value: Set of frontend desktop WebSockets

export interface TargetStatus {
    targetId: string;
    online: boolean;
    blocked: boolean;
    reason?: string | undefined;
    lastPing?: number | undefined;
}

export const targetStatuses = new Map<string, TargetStatus>();

export function getTargetStatus(targetId: string): TargetStatus {
    const status = targetStatuses.get(targetId);
    if (status) return status;
    const isOnline = controlConnections.has(targetId);
    return {
        targetId,
        online: isOnline,
        blocked: !isOnline,
        reason: isOnline ? undefined : 'Local server is not connected'
    };
}

export function setTargetStatus(targetId: string, status: Partial<TargetStatus>): void {
    const existing = getTargetStatus(targetId);
    const updated: TargetStatus = {
        ...existing,
        ...status,
        targetId
    };
    targetStatuses.set(targetId, updated);
    notifyTargetStatus(targetId, updated);
}

export function notifyTargetStatus(targetId: string, status?: TargetStatus): void {
    const current = status || getTargetStatus(targetId);
    const clients = frontendClients.get(targetId);
    if (clients && clients.size > 0) {
        const payload = JSON.stringify({
            type: 'server_status',
            target: targetId,
            online: current.online,
            blocked: current.blocked,
            reason: current.reason
        });
        for (const client of clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        }
    }
}

/**
 * Bridges two WebSockets together, forwarding all traffic in both directions.
 */
export function bridgeSockets(ws1: WebSocket, ws2: WebSocket): void {
    ws1.on('message', (message: any, isBinary: boolean) => {
        if (ws2.readyState === WebSocket.OPEN) {
            ws2.send(message, { binary: isBinary });
        }
    });

    ws2.on('message', (message: any, isBinary: boolean) => {
        if (ws1.readyState === WebSocket.OPEN) {
            ws1.send(message, { binary: isBinary });
        }
    });

    const closeAll = () => {
        if (ws1.readyState === WebSocket.OPEN || ws1.readyState === WebSocket.CONNECTING) {
            ws1.close();
        }
        if (ws2.readyState === WebSocket.OPEN || ws2.readyState === WebSocket.CONNECTING) {
            ws2.close();
        }
    };

    ws1.on('close', closeAll);
    ws2.on('close', closeAll);
    ws1.on('error', closeAll);
    ws2.on('error', closeAll);
}

/**
 * Broadcasts a message to all connected frontend clients (or filtered by target identifier).
 */
export function broadcast(message: any, filterTargetId?: string): void {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);

    if (filterTargetId) {
        const clients = frontendClients.get(filterTargetId);
        if (clients) {
            for (const client of clients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(payload);
                }
            }
        }
        return;
    }

    for (const clientSet of frontendClients.values()) {
        for (const client of clientSet) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        }
    }
}

export const connectionManager = {
    controlConnections,
    pendingSessions,
    serverApplications,
    frontendClients,
    targetStatuses,
    getTargetStatus,
    setTargetStatus,
    notifyTargetStatus,
    bridgeSockets,
    broadcast
};

