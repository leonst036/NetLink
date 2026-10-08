import jwt from 'jsonwebtoken';
import crypto from 'crypto';

let runtimeSecret: string = process.env.JWT_SECRET || '';
if (!runtimeSecret) {
    runtimeSecret = crypto.randomBytes(32).toString('hex');
    process.env.JWT_SECRET = runtimeSecret;
}

export function getJwtSecret(): string {
    return process.env.JWT_SECRET || runtimeSecret;
}

export function GenerateToken(payload: object, secretKey?: string, options?: jwt.SignOptions): string {
    return jwt.sign(payload, secretKey || getJwtSecret(), options);
}

export function VerifyTokenSync(token: string, secretKey?: string): any {
    return jwt.verify(token, secretKey || getJwtSecret());
}

export async function VerifyToken(token: string, secretKey?: string): Promise<any> {
    return jwt.verify(token, secretKey || getJwtSecret());
}
