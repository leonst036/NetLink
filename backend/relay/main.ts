import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
import * as mongoDB from 'mongodb';
import { initializeDatabase } from './database/MongoManager.js';
import { createServer } from './websocket/httpsHelper.js';
import { handleRequest } from './http/requestHandler.js';
import { handleMainConnection } from './websocket/mainConnectionHandler.js';

dotenv.config();

const HTTP_PORT = Number(process.env.HTTP_PORT || 4535);
const WS_PORT = Number(process.env.WS_PORT || 4536);
let mongoClient: mongoDB.MongoClient | null = null;

// Initialize MongoDB database connection
mongoClient = await initializeDatabase();

// Create HTTP(S) Server for serving the web app (frontend and health check)
const httpServer = createServer(handleRequest);

// Attach WebSocketServer to the httpServer directly
const wss = new WebSocketServer({ 
    server: httpServer,
    handleProtocols: (protocols) => {
        // Echo back the first requested protocol, or false to reject
        return Array.from(protocols)[0] || false;
    }
});

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    handleMainConnection(ws, req, mongoClient);
});

httpServer.listen(HTTP_PORT, () => {
    console.log(`Relay server (HTTP & WS) started on port ${HTTP_PORT}`);
});