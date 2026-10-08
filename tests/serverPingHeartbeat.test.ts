import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';

const relayRequire = createRequire(new URL('../backend/relay/package.json', import.meta.url));
const { WebSocketServer, WebSocket } = relayRequire('ws');
import {
    handleLocalServerConnection,
    handleDesktopConnection
} from '../backend/relay/dist/websocket/connectionHandlers.js';
import {
    controlConnections,
    getTargetStatus,
    targetStatuses,
    frontendClients
} from '../backend/relay/dist/websocket/connectionManager.js';

// Configure short intervals for testing
process.env.RELAY_PING_INTERVAL = '100';
process.env.RELAY_PING_TIMEOUT = '250';

function getAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = http.createServer();
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            if (addr && typeof addr === 'object') {
                const port = addr.port;
                server.close(() => resolve(port));
            } else {
                server.close(() => reject(new Error('Failed to obtain port')));
            }
        });
        server.on('error', reject);
    });
}

describe('Server Ping Heartbeat & Frontend Blocking', () => {
    after(() => {
        setTimeout(() => {
            process.exit(0);
        }, 100);
    });

    it('notifies desktop client and blocks frontend when local server does not respond to pings', async () => {
        const port = await getAvailablePort();
        const server = http.createServer();
        const wss = new WebSocketServer({ server });

        const targetId = 'test-node-unresponsive';

        wss.on('connection', (ws, req) => {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            if (url.pathname === '/desktop') {
                handleDesktopConnection(ws, targetId);
            } else if (url.pathname === '/connect') {
                handleLocalServerConnection(ws, targetId, null, null, { deviceId: targetId, deviceName: targetId });
            }
        });

        await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', () => resolve()));
        let desktopWs: any;
        let localServerWs: any;

        try {
            // 1. Connect Desktop client
            desktopWs = new WebSocket(`ws://127.0.0.1:${port}/desktop`);
            const desktopMessages: any[] = [];

            desktopWs.on('message', (data: any) => {
                desktopMessages.push(JSON.parse(data.toString()));
            });

            await new Promise<void>((resolve) => desktopWs.on('open', () => resolve()));

            // Initially before local server connects, target should be blocked / not connected
            await new Promise((r) => setTimeout(r, 60));
            const initialStatus = desktopMessages.find(m => m.type === 'server_status');
            assert.ok(initialStatus);
            assert.equal(initialStatus.blocked, true);
            assert.equal(initialStatus.online, false);

            // 2. Connect Local Server (simulating an unresponsive server that ignores pings)
            localServerWs = new WebSocket(`ws://127.0.0.1:${port}/connect`);
            
            // Override pong to simulate an unresponsive server that does not respond to pings
            localServerWs.pong = () => {};

            await new Promise<void>((resolve) => localServerWs.on('open', () => resolve()));

            // Should receive online status update
            await new Promise((r) => setTimeout(r, 60));
            const statusMessages = desktopMessages.filter(m => m.type === 'server_status');
            const latestStatus = statusMessages[statusMessages.length - 1];
            assert.ok(latestStatus);
            assert.equal(latestStatus.blocked, false);
            assert.equal(latestStatus.online, true);
            assert.equal(controlConnections.has(targetId), true);

            // 3. Wait for the ping watchdog timeout (250ms timeout)
            await new Promise((r) => setTimeout(r, 450));

            // Verify local server was terminated by relay
            assert.equal(controlConnections.has(targetId), false);

            // Verify desktop received blocked status update
            const statusMessagesAfterTimeout = desktopMessages.filter(m => m.type === 'server_status');
            const blockedStatus = statusMessagesAfterTimeout[statusMessagesAfterTimeout.length - 1];
            assert.ok(blockedStatus);
            assert.equal(blockedStatus.blocked, true);
            assert.equal(blockedStatus.online, false);
            assert.match(blockedStatus.reason || '', /not responding to pings|disconnected/i);

            // Verify getTargetStatus reflects blocked
            const status = getTargetStatus(targetId);
            assert.equal(status.blocked, true);
            assert.equal(status.online, false);
        } finally {
            controlConnections.get(targetId)?.terminate();
            const clients = frontendClients.get(targetId);
            if (clients) {
                for (const c of clients) c.terminate();
            }
            for (const c of wss.clients) c.terminate();
            desktopWs?.terminate();
            localServerWs?.terminate();
            wss.close();
            server.close();
            targetStatuses.delete(targetId);
            controlConnections.delete(targetId);
            frontendClients.delete(targetId);
        }
    });

    it('keeps server online and frontend unblocked when local server responds to pings', async () => {
        const port = await getAvailablePort();
        const server = http.createServer();
        const wss = new WebSocketServer({ server });

        const targetId = 'test-node-responsive';

        wss.on('connection', (ws, req) => {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            if (url.pathname === '/desktop') {
                handleDesktopConnection(ws, targetId);
            } else if (url.pathname === '/connect') {
                handleLocalServerConnection(ws, targetId, null, null, { deviceId: targetId, deviceName: targetId });
            }
        });

        await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', () => resolve()));
        let localServerWs: any;
        let desktopWs: any;

        try {
            // 1. Connect Local Server (responsive: standard WebSocket automatically answers pings with pongs)
            localServerWs = new WebSocket(`ws://127.0.0.1:${port}/connect`);
            await new Promise<void>((resolve) => localServerWs.on('open', () => resolve()));

            // 2. Connect Desktop client
            desktopWs = new WebSocket(`ws://127.0.0.1:${port}/desktop`);
            const desktopMessages: any[] = [];
            desktopWs.on('message', (data: any) => {
                desktopMessages.push(JSON.parse(data.toString()));
            });
            await new Promise<void>((resolve) => desktopWs.on('open', () => resolve()));

            // Wait across multiple heartbeat cycles (interval=100ms)
            await new Promise((r) => setTimeout(r, 350));

            // Verify server remains online and not blocked
            const status = getTargetStatus(targetId);
            assert.equal(status.online, true);
            assert.equal(status.blocked, false);
            assert.equal(controlConnections.has(targetId), true);

            // Desktop client should show online: true, blocked: false
            const statusMessages = desktopMessages.filter(m => m.type === 'server_status');
            const latestMsg = statusMessages[statusMessages.length - 1];
            assert.ok(latestMsg);
            assert.equal(latestMsg.online, true);
            assert.equal(latestMsg.blocked, false);
        } finally {
            controlConnections.get(targetId)?.terminate();
            const clients = frontendClients.get(targetId);
            if (clients) {
                for (const c of clients) c.terminate();
            }
            for (const c of wss.clients) c.terminate();
            desktopWs?.terminate();
            localServerWs?.terminate();
            wss.close();
            server.close();
            targetStatuses.delete(targetId);
            controlConnections.delete(targetId);
            frontendClients.delete(targetId);
        }
    });
});
