import { WebSocketServer, WebSocket } from 'ws';
import { createHttpsServer } from './httpServer.js';
import { handleSshConnection } from './websockets/connectionHandler.js';
import { handleRelayConnection } from './websockets/relay/relayConnector.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

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

// 4.Connect to cloud relay if configured
const RELAY_TOKEN = process.env.RELAY_TOKEN;
if (RELAY_TOKEN) {
    handleRelayConnection(RELAY_TOKEN);
} else {
    console.log('RELAY_TOKEN not set in environment. Running in local-only mode.');
}

// 5. Handle Demo Timeout (auto self-destruct)
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