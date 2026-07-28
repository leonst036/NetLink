import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { URL } from 'url';
import dotenv from 'dotenv';
import * as mongoDB from 'mongodb';
import { initializeDatabase } from './database/MongoManager.js';
import { authenticateToken } from './auth/authenticator.js';
import { handleLocalServerConnection, handleClientConnection, handleDesktopConnection } from './websocket/connectionHandlers.js';
import { createServer } from './websocket/httpsHelper.js';
import { handleRequest } from './http/requestHandler.js';

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
            handleClientConnection(ws, identifier, targetId, sessionId);
        } else if (pathname === '/desktop') {
            const targetId = target || identifier;
            handleDesktopConnection(ws, targetId);
        } else {
            console.warn(`Unsupported request path: ${pathname}`);
            ws.close(1003, 'Unsupported Path');
        }

    } catch (err: any) {
        console.error('Error handling connection:', err);
        ws.close(1011, 'Internal Server Error');
    }
});

httpServer.listen(HTTP_PORT, () => {
    console.log(`Relay server (HTTP & WS) started on port ${HTTP_PORT}`);
});