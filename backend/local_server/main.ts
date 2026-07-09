import { WebSocketServer, WebSocket } from 'ws';
import { createHttpsServer } from './httpServer.js';
import { handleSshConnection } from './websockets/sshHandler.js';
import { handleRelayConnection } from './websockets/relay/relayConnector.js';
import dotenv from 'dotenv';

dotenv.config();

// 1. Create HTTPS Server
const server = createHttpsServer();

// 2. Attach WebSocket Server to the same HTTPS Server (for direct local connections)
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
    handleSshConnection(ws);
});

// 3. Start local HTTPS server
server.listen(8080, () => {
    console.log('NetLink Server running at https://localhost:8080');
});

// 4. Optionally connect to cloud relay if configured
const RELAY_TOKEN = process.env.RELAY_TOKEN;
if (RELAY_TOKEN) {
    handleRelayConnection(RELAY_TOKEN);
} else {
    console.log('RELAY_TOKEN not set in environment. Running in local-only mode.');
}