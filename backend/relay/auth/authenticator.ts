import * as mongoDB from 'mongodb';
import { VerifyToken } from './tokenManager.js';
import { CheckToken } from '../database/MongoManager.js';

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
            throw new Error('Token not found in database or revoked');
        }
    }
    return decoded;
}
