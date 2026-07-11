const { WebSocketServer, WebSocket } = require('ws');
const wss = new WebSocketServer({
    port: 8081,
    handleProtocols: (protocols) => {
        console.log('protocols:', Array.from(protocols));
        return protocols.values().next().value || false;
    }
});
wss.on('connection', ws => { console.log('connected'); ws.close(); });
const ws1 = new WebSocket('ws://localhost:8081', ['binary']);
ws1.on('open', () => console.log('ws1 open'));
const ws2 = new WebSocket('ws://localhost:8081');
ws2.on('open', () => { console.log('ws2 open'); process.exit(0); });
ws2.on('error', (e) => { console.log('ws2 error', e.message); process.exit(1); });
