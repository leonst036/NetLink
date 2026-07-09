import jwt from 'jsonwebtoken';

export async function GenerateToken(payload: object, secretKey: string) {
    const token = jwt.sign(payload, secretKey);
    return token;
}

export async function VerifyToken(token: string, secretKey: string) {
    const decoded = jwt.verify(token, secretKey);
    return decoded;
}
