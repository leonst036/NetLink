import http from 'http';
import { GenerateToken } from './tokenManager.js';
import { getMongoClient, StoreToken } from '../database/MongoManager.js';

function getRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            resolve(body);
        });
        req.on('error', err => {
            reject(err);
        });
    });
}

export async function handleLogin(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
    }

    let body = '';
    try {
        body = await getRequestBody(req);
    } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read request body' }));
        return;
    }

    let username = '';
    let password = '';
    try {
        const parsed = JSON.parse(body);
        username = parsed.username;
        password = parsed.password;
    } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
    }

    if (!username || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Username and password are required' }));
        return;
    }

    const envUser = process.env.ADMIN_USERNAME || 'admin';
    const envPass = process.env.ADMIN_PASSWORD || 'admin';

    let isAuthenticated = false;
    if (username === envUser && password === envPass) {
        isAuthenticated = true;
    } else {
        const client = getMongoClient();
        if (client) {
            try {
                const db = client.db('NetLink');
                const usersCollection = db.collection('users');
                const user = await usersCollection.findOne({ username });
                if (user && user.password === password) {
                    isAuthenticated = true;
                }
            } catch (dbError) {
                console.error('Failed to check user in database:', dbError);
            }
        }
    }

    if (!isAuthenticated) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid username or password' }));
        return;
    }

    try {
        const secretKey = process.env.JWT_SECRET || 'default_secret';
        const payload = {
            userId: username,
            role: 'user'
        };

        // Generate token with 1 day expiration
        const token = await GenerateToken(payload, secretKey, { expiresIn: '1d' });

        // Store token in MongoDB if active
        const client = getMongoClient();
        if (client) {
            await StoreToken(client, token);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token }));
    } catch (err: any) {
        console.error('Login error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
}
