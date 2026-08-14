import { WebSocket, WebSocket as WsClient } from 'ws';
import http from 'http';
import { URL } from 'url';
import * as mongoDB from 'mongodb';
import { authenticateToken, extractTokenFromRequest } from '../auth/authenticator.js';
import { consumeTicket } from '../auth/ticketManager.js';
import { handleLocalServerConnection, handleClientConnection, handleDesktopConnection } from './connectionHandlers.js';
import { appRouter } from '../http/requestHandler.js';
import { denoSandbox } from '../sandbox/DenoSandbox.js';

export const handleMainConnection = async (
    ws: WebSocket, 
    req: http.IncomingMessage, 
    mongoClient: mongoDB.MongoClient | null
) => {
    try {
        const reqUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const pathname = reqUrl.pathname;
        const token = extractTokenFromRequest(req, reqUrl);
        const ticket = reqUrl.searchParams.get('ticket');
        const sessionId = reqUrl.searchParams.get('sessionId');
        const target = reqUrl.searchParams.get('target');

        // Authenticate connection
        let decodedPayload: any = null;
        try {
            if (ticket) {
                const ticketData = consumeTicket(ticket);
                if (!ticketData) {
                    throw new Error('Invalid or expired ticket');
                }
                decodedPayload = { userId: ticketData.userId, deviceId: ticketData.target || ticketData.userId };
            } else {
                decodedPayload = await authenticateToken(token, mongoClient);
            }
        } catch (authError: any) {
            console.error(`Authentication failed for IP ${req.socket.remoteAddress}: ${authError.message}`);
            ws.close(1008, `Authentication Failed: ${authError.message}`);
            return;
        }

        // Extract identifier from the token payload (fallback to token itself)
        const rawToken = token?.value || '';
        const identifier = decodedPayload?.deviceId || decodedPayload?.userId || decodedPayload?.sub || rawToken;

        console.log(`Connection established at path: ${pathname} (Identifier: ${identifier})`);

        if (pathname === '/connect') {
            handleLocalServerConnection(ws, identifier, rawToken, sessionId);
        } else if (pathname === '/client') {
            const targetId = target || identifier; // If target is not specified, assume target is the token/identifier itself
            handleClientConnection(ws, identifier, targetId, sessionId);
        } else if (pathname === '/desktop') {
            const targetId = target || identifier;
            handleDesktopConnection(ws, targetId);
        } else if (appRouter.handleWs(ws, req, reqUrl)) {
            // WS connection was successfully routed to an app router
            return;
        } else {
            // Check if it's a proxied app request: /api/<appId>/...
            const match = pathname.match(/^\/api\/([^\/]+)(?:\/|$)/);
            if (match) {
                const appId = match[1] as string;
                const userId = decodedPayload?.userId || decodedPayload?.sub || identifier || 'admin';
                const app = denoSandbox.getApp(`${userId}_${appId}`) || denoSandbox.getApp(appId);
                const systemRoutes = ['login', 'register', 'validate-target', 'install.sh', 'demo.sh', 'demo-setup', 'server-logins', 'users', 'applications', 'netstore'];
                if (app && !systemRoutes.includes(appId)) {
                    // Bridge websocket to Deno
                    const targetUrl = `ws://localhost:${app.port}${req.url}`;
                    const targetWs = new WsClient(targetUrl, {
                        headers: {
                            ...req.headers,
                            host: `localhost:${app.port}`
                        }
                    });

                    targetWs.on('open', () => console.log(`Bridged WS to Deno app ${appId}`));
                    targetWs.on('message', (msg, isBinary) => ws.send(msg, { binary: isBinary }));
                    targetWs.on('close', () => ws.close());
                    targetWs.on('error', (err) => console.error(`Deno WS Error [${appId}]:`, err));

                    ws.on('message', (msg, isBinary) => targetWs.readyState === WsClient.OPEN && targetWs.send(msg, { binary: isBinary }));
                    ws.on('close', () => targetWs.close());
                    return;
                }
            }

            console.warn(`Unsupported request path: ${pathname}`);
            ws.close(1003, 'Unsupported Path');
        }

    } catch (err: any) {
        console.error('Error handling connection:', err);
        ws.close(1011, 'Internal Server Error');
    }
};
