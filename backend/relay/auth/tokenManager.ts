import jwt from 'jsonwebtoken';

export function GenerateToken(payload: object, secretKey: string, options?: jwt.SignOptions): string {
    return jwt.sign(payload, secretKey, options);
}

export function VerifyTokenSync(token: string, secretKey: string): any {
    return jwt.verify(token, secretKey);
}

export async function VerifyToken(token: string, secretKey: string): Promise<any> {
    return jwt.verify(token, secretKey);
}
