import jwt from 'jsonwebtoken';

export async function GenerateToken(payload: object, secretKey: string, options?: jwt.SignOptions) {
    const token = jwt.sign(payload, secretKey, options);
    return token;
}

export async function VerifyToken(token: string, secretKey: string) {
    const decoded = jwt.verify(token, secretKey);
    return decoded;
}
