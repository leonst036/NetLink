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
    let target = '';
    try {
        const parsed = JSON.parse(body);
        username = parsed.username;
        password = parsed.password;
        target = parsed.target;
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
    let userRole = 'user';
    let userPermissions: string[] = [];

    if (username === envUser && password === envPass) {
        isAuthenticated = true;
        userRole = 'admin';
        userPermissions = ['manage_users', 'manage_logins', 'access_terminal', 'access_vnc', 'access_sftp', 'scan_network'];
    } else {
        const client = getMongoClient();
        if (client) {
            try {
                const { CheckUser } = await import('../database/MongoManager.js');
                const user = await CheckUser(client, username);
                if (user && user.password === password) {
                    isAuthenticated = true;
                    userRole = user.role || 'user';
                    userPermissions = user.permissions || [];
                    
                    // Save target to user if provided
                    if (target) {
                        await client.db("NetLink").collection("users").updateOne(
                            { _id: user._id },
                            { $addToSet: { targets: target } }
                        );
                    }
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
            role: userRole,
            permissions: userPermissions
        };

        // Generate token with 1 day expiration
        const token = await GenerateToken(payload, secretKey, { expiresIn: '1d' });

        // Store token in MongoDB if active
        const client = getMongoClient();
        if (client) {
            await StoreToken(client, token);
        }

        // Fetch targets if any
        let userTargets: string[] = [];
        if (username !== envUser) {
            const client = getMongoClient();
            if (client) {
                const { CheckUser } = await import('../database/MongoManager.js');
                const user = await CheckUser(client, username);
                if (user && user.targets) {
                    userTargets = user.targets;
                }
            }
        } else if (target) {
            userTargets = [target]; // admin just uses the provided target
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token, targets: userTargets }));
    } catch (err: any) {
        console.error('Login error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
}
