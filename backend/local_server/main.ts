import { WebSocketServer, WebSocket } from 'ws';
import { createHttpsServer } from './httpServer.js';
import { handleWebSocketConnection } from './protocols/router.js';
import { handleRelayConnection } from './services/relayConnector.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { InitNetStore } from './NetStore/NetStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

// 1. Initialize NetStore applications
InitNetStore();

// 2. Create HTTPS Server
const server = createHttpsServer();

// 3. Attach WebSocket Server to the same HTTPS Server (for direct local connections)
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
    handleWebSocketConnection(ws);
});

// 4. Start local HTTPS server
server.listen(8080, () => {
    console.log('NetLink Server running at https://localhost:8080');
});

// 5. Connect to cloud relay if configured
const RELAY_TOKEN = process.env.RELAY_TOKEN;
if (RELAY_TOKEN) {
    handleRelayConnection(RELAY_TOKEN);
} else {
    console.log('RELAY_TOKEN not set in environment. Running in local-only mode.');
}

// 6. Handle Demo Timeout (auto self-destruct)
if (process.env.DEMO_TIMEOUT) {
    const timeoutSeconds = parseInt(process.env.DEMO_TIMEOUT, 10);
    if (!isNaN(timeoutSeconds)) {
        console.log(`[DEMO MODE] Node will automatically shut down in ${timeoutSeconds} seconds.`);
        setTimeout(() => {
            console.log(`[DEMO MODE] Time's up! Shutting down local server...`);
            process.exit(0);
        }, timeoutSeconds * 1000);
    }
}