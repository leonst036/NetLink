import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { URL } from 'url';
import dotenv from 'dotenv';
import * as mongoDB from 'mongodb';
import { connectToDatabase } from './database/MongoManager.js';
import { authenticateToken } from './auth/authenticator.js';
import { handleLocalServerConnection, handleClientConnection } from './websocket/connectionHandlers.js';
import { createServer } from './websocket/httpsHelper.js';
import { handleRequest } from './http/requestHandler.js';

dotenv.config();

const PORT = Number(process.env.PORT || 4536);
let mongoClient: mongoDB.MongoClient | null = null;

// Start database connection if MONGO_URI is set
if (process.env.MONGO_URI) {
    try {
        const result = await connectToDatabase(process.env.MONGO_URI);
        if (result instanceof mongoDB.MongoClient) {
            mongoClient = result;
            console.log('Successfully connected to MongoDB database.');
        } else {
            console.warn('MongoDB connection returned an error, running in memory-only auth mode:', result);
        }
    } catch (error) {
        console.error('Failed to connect to MongoDB, running in memory-only auth mode:', error);
    }
} else {
    console.log('MONGO_URI is not set. Running in memory-only auth mode.');
}

// Create Server (HTTP or HTTPS depending on config)
const server = createServer(handleRequest);

const wss = new WebSocketServer({ server });

wss.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
    try {
        const reqUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const pathname = reqUrl.pathname;
        const token = reqUrl.searchParams.get('token');
        const sessionId = reqUrl.searchParams.get('sessionId');
        const target = reqUrl.searchParams.get('target');

        // Authenticate connection
        let decodedPayload: any = null;
        try {
            decodedPayload = await authenticateToken(token, mongoClient);
        } catch (authError: any) {
            console.error(`Authentication failed for IP ${req.socket.remoteAddress}: ${authError.message}`);
            ws.close(1008, `Authentication Failed: ${authError.message}`);
            return;
        }

        // Extract identifier from the token payload (fallback to token itself)
        const identifier = decodedPayload?.deviceId || decodedPayload?.userId || decodedPayload?.sub || token!;

        console.log(`Connection established at path: ${pathname} (Identifier: ${identifier})`);

        if (pathname === '/connect') {
            handleLocalServerConnection(ws, identifier, token, sessionId);
        } else if (pathname === '/client') {
            const targetId = target || identifier; // If target is not specified, assume target is the token/identifier itself
            handleClientConnection(ws, identifier, targetId);
        } else {
            console.warn(`Unsupported request path: ${pathname}`);
            ws.close(1003, 'Unsupported Path');
        }

    } catch (err: any) {
        console.error('Error handling connection:', err);
        ws.close(1011, 'Internal Server Error');
    }
});

server.listen(PORT, () => {
    console.log(`Relay server started on port ${PORT}`);
});