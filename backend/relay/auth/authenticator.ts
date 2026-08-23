import * as mongoDB from 'mongodb';
import http from 'http';
import { URL } from 'url';
import { VerifyToken } from './tokenManager.js';
import { CheckToken } from '../database/MongoManager.js';

export function parseCookies(cookieHeader?: string): Record<string, string> {
    const list: Record<string, string> = {};
    if (!cookieHeader) return list;

    cookieHeader.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        if (parts.length >= 2 && parts[0]) {
            const name = parts[0].trim();
            const val = parts.slice(1).join('=').trim();
            list[name] = decodeURIComponent(val);
        }
    });

    return list;
}

export function extractTokenFromRequest(req: http.IncomingMessage, parsedUrl?: URL): { type: 'jwt' | 'ticket', value: string } | null {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        if (authHeader.startsWith('Bearer ')) {
            return { type: 'jwt', value: authHeader.split(' ')[1] || '' };
        }
        if (authHeader.startsWith('Ticket ')) {
            return { type: 'ticket', value: authHeader.split(' ')[1] || '' };
        }
    }
    if (parsedUrl) {
        const urlTicket = parsedUrl.searchParams.get('ticket');
        if (urlTicket) return { type: 'ticket', value: urlTicket };

        const urlToken = parsedUrl.searchParams.get('token');
        if (urlToken) return { type: 'jwt', value: urlToken };
    }
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.netlink_token) {
        return { type: 'jwt', value: cookies.netlink_token };
    }
    return null;
}

/**
 * Authenticates a token via JWT verify and optionally MongoDB.
 */
export async function authenticateToken(
    authResult: { type: 'jwt' | 'ticket', value: string } | string | null, 
    mongoClient: mongoDB.MongoClient | null
): Promise<any> {
    if (!authResult) {
        throw new Error('Token is missing');
    }
    
    let tokenType = 'jwt';
    let token = '';

    if (typeof authResult === 'string') {
        token = authResult;
    } else {
        tokenType = authResult.type;
        token = authResult.value;
    }

    if (tokenType === 'ticket') {
        const { consumeTicket } = await import('./ticketManager.js');
        const ticketData = consumeTicket(token);
        if (!ticketData) throw new Error('Invalid or expired ticket');
        return { userId: ticketData.userId, deviceId: ticketData.target || ticketData.userId, role: ticketData.role || (ticketData.userId === 'admin' ? 'admin' : 'user'), permissions: ticketData.permissions || [] };
    }

    const secretKey = process.env.JWT_SECRET || 'default_secret';
    
    // 1. Try JWT verification first
    try {
        const decoded = await VerifyToken(token, secretKey);
        
        // 2. Database validation if MongoDB is configured
        if (mongoClient) {
            const tokenExists = await CheckToken(mongoClient, token);
            if (!tokenExists) {
                const { StoreToken } = await import('../database/MongoManager.js');
                const targetId = typeof decoded === "object" && decoded !== null ? ((decoded as any).deviceId || (decoded as any).targetId || (decoded as any).target) : undefined;
                await StoreToken(mongoClient, token, targetId);
            }
        }
        return decoded;
    } catch (jwtErr) {
        // Fallback: Check if token is actually a session Ticket
        const { consumeTicket } = await import('./ticketManager.js');
        const ticketData = consumeTicket(token);
        if (ticketData) {
            return {
                userId: ticketData.userId,
                deviceId: ticketData.target || ticketData.userId,
                role: ticketData.role || (ticketData.userId === 'admin' ? 'admin' : 'user'),
                permissions: ticketData.permissions || []
            };
        }
        throw jwtErr;
    }
}

