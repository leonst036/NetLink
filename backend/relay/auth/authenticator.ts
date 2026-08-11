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

export function extractTokenFromRequest(req: http.IncomingMessage, parsedUrl?: URL): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1] || null;
    }
    if (parsedUrl) {
        const urlToken = parsedUrl.searchParams.get('token');
        if (urlToken) return urlToken;
    }
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.netlink_token) {
        return cookies.netlink_token;
    }
    return null;
}

/**
 * Authenticates a token via JWT verify and optionally MongoDB.
 */
export async function authenticateToken(
    token: string | null, 
    mongoClient: mongoDB.MongoClient | null
): Promise<any> {
    if (!token) {
        throw new Error('Token is missing');
    }
    const secretKey = process.env.JWT_SECRET || 'default_secret';
    
    // 1. JWT verification
    const decoded = await VerifyToken(token, secretKey);
    
    // 2. Database validation if MongoDB is configured
    if (mongoClient) {
        const tokenExists = await CheckToken(mongoClient, token);
        if (!tokenExists) {
            const { StoreToken } = await import('../database/MongoManager.js');
            await StoreToken(mongoClient, token);
        }
    }
    return decoded;
}

