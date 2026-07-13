import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, URL } from 'url';
import { handleLogin } from '../auth/login.js';
import { serverDevices } from '../websocket/connectionManager.js';
import { getMongoClient } from '../database/MongoManager.js';
import { authenticateToken } from '../auth/authenticator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find frontend path
let frontendPath = process.env.FRONTEND_PATH || '';
if (!frontendPath) {
    const candidates = [
        path.join(__dirname, 'frontend'),
        path.join(__dirname, '../frontend'),
        path.join(__dirname, '../../frontend'),
        path.join(__dirname, '../../../frontend'),
        path.join(__dirname, '../../../../frontend')
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            frontendPath = candidate;
            break;
        }
    }
}
if (!frontendPath) {
    frontendPath = path.join(__dirname, '../../frontend');
}
if (fs.existsSync(path.join(frontendPath, 'dist'))) {
    frontendPath = path.join(frontendPath, 'dist');
}
console.log(`[HTTP Server] Serving frontend files from: ${frontendPath}`);

/**
 * Handles incoming HTTP requests to serve frontend files and support basic health checks.
 */
export function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // Health check route
    if (pathname === '/health') {
        let MongoDbStatus = getMongoClient();
        if (MongoDbStatus) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('NetLink Relay Server is running with MongoDB.\n');
        } else {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('NetLink Relay Server is running but MongoDB is not available.\n');
        }
        return;
    }

    // Login API route
    if (pathname === '/api/login' || pathname === '/login') {
        handleLogin(req, res);
        return;
    }

    // Register API route
    if (pathname === '/api/register' || pathname === '/register') {
        if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.writeHead(204);
            res.end();
            return;
        }
        if (req.method === 'POST') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    const parsedBody = JSON.parse(body);
                    const mongoClient = getMongoClient();
                    if (!mongoClient) {
                        res.writeHead(503, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Database not available' }));
                        return;
                    }
                    import('../database/MongoManager.js').then(({ RegisterUser }) => {
                        RegisterUser(mongoClient, parsedBody).then(() => {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true }));
                        }).catch(err => {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: err.message || 'Failed to register user' }));
                        });
                    });
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
        return;
    }

    // Get servers API route
    if (pathname === '/api/servers') {
        const target = parsedUrl.searchParams.get('target');
        if (!target) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'target parameter required' }));
            return;
        }
        const devices = serverDevices.get(target) || [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ devices }));
        return;
    }

    // Validate Target API route
    if (pathname === '/api/validate-target') {
        const target = parsedUrl.searchParams.get('target');
        if (!target) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'target parameter required' }));
            return;
        }
        import('../websocket/connectionManager.js').then(({ controlConnections }) => {
            const isValid = !controlConnections.has(target);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ valid: isValid }));
        });
        return;
    }

    // Install Script route
    if (pathname === '/api/install.sh') {
        const isHttps = (req.socket as any).encrypted || req.headers['x-forwarded-proto'] === 'https';
        const protocol = isHttps ? 'https' : 'http';
        const host = req.headers.host || 'localhost';
        const relayUrl = `${protocol}://${host}`;

        const script = fs.readFileSync(path.join(__dirname, '../../assets/scripts/install_local_server.sh'), 'utf-8').replaceAll('${relayUrl}', relayUrl);
        res.writeHead(200, { 'Content-Type': 'application/x-sh' });
        res.end(script);
        return;
    }

    // Topology API routes
    if (pathname === '/api/topology') {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1] || parsedUrl.searchParams.get('token');
        const target = parsedUrl.searchParams.get('target');

        if (!target) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'target parameter required' }));
            return;
        }

        const mongoClient = getMongoClient();
        if (!mongoClient) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Database not available' }));
            return;
        }

        authenticateToken(token || null, mongoClient).then((decoded) => {
            const username = decoded.userId || decoded.username || decoded.sub;

            if (req.method === 'GET') {
                import('../database/MongoManager.js').then(({ GetTopology }) => {
                    GetTopology(mongoClient, username, target).then(data => {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(data || { nodes: [], edges: [], nicknames: {} }));
                    }).catch(err => {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to fetch topology' }));
                    });
                });
            } else if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk.toString(); });
                req.on('end', () => {
                    try {
                        const { nodes, edges, nicknames } = JSON.parse(body);
                        import('../database/MongoManager.js').then(({ SaveTopology }) => {
                            SaveTopology(mongoClient, username, target, nodes, edges, nicknames).then(() => {
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: true }));
                            }).catch(err => {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Failed to save topology' }));
                            });
                        });
                    } catch (e) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid JSON' }));
                    }
                });
            } else {
                res.writeHead(405, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Method not allowed' }));
            }
        }).catch((err) => {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized', details: err.message }));
        });
        return;
    }

    // Server Logins API routes
    if (pathname === '/api/server-logins') {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1] || parsedUrl.searchParams.get('token');

        const mongoClient = getMongoClient();
        if (!mongoClient) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Database not available' }));
            return;
        }

        authenticateToken(token || null, mongoClient).then((decoded) => {
            const username = decoded.userId || decoded.username || decoded.sub;

            if (req.method === 'GET') {
                import('../database/MongoManager.js').then(({ GetServerLogins }) => {
                    GetServerLogins(mongoClient, username).then(logins => {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ logins }));
                    }).catch(err => {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to fetch logins' }));
                    });
                });
            } else if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk.toString(); });
                req.on('end', () => {
                    try {
                        const parsedBody = JSON.parse(body);
                        if (!parsedBody.id) parsedBody.id = Date.now().toString();

                        import('../database/MongoManager.js').then(({ SaveServerLogin }) => {
                            SaveServerLogin(mongoClient, username, parsedBody).then(() => {
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: true, id: parsedBody.id }));
                            }).catch(err => {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Failed to save login' }));
                            });
                        });
                    } catch (e) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid JSON' }));
                    }
                });
            } else if (req.method === 'DELETE') {
                const id = parsedUrl.searchParams.get('id');
                if (!id) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'id parameter required for deletion' }));
                    return;
                }
                import('../database/MongoManager.js').then(({ DeleteServerLogin }) => {
                    DeleteServerLogin(mongoClient, username, id).then(() => {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    }).catch(err => {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to delete login' }));
                    });
                });
            } else {
                res.writeHead(405, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Method not allowed' }));
            }
        }).catch((err) => {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized', details: err.message }));
        });
        return;
    }

    // Users API routes
    if (pathname === '/api/users') {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1] || parsedUrl.searchParams.get('token');

        const mongoClient = getMongoClient();
        if (!mongoClient) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Database not available' }));
            return;
        }

        authenticateToken(token || null, mongoClient).then((decoded) => {
            const hasPermission = decoded.role === 'admin' || (decoded.permissions && decoded.permissions.includes('manage_users'));
            if (!hasPermission) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Forbidden: Missing manage_users permission' }));
                return;
            }

            if (req.method === 'GET') {
                import('../database/MongoManager.js').then(({ GetUsers }) => {
                    GetUsers(mongoClient).then(users => {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ users }));
                    }).catch(err => {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to fetch users' }));
                    });
                });
            } else if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk.toString(); });
                req.on('end', () => {
                    try {
                        const parsedBody = JSON.parse(body);
                        import('../database/MongoManager.js').then(({ CreateUser }) => {
                            CreateUser(mongoClient, parsedBody).then(() => {
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: true }));
                            }).catch(err => {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Failed to create user' }));
                            });
                        });
                    } catch (e) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid JSON' }));
                    }
                });
            } else if (req.method === 'PUT') {
                let body = '';
                req.on('data', chunk => { body += chunk.toString(); });
                req.on('end', () => {
                    try {
                        const parsedBody = JSON.parse(body);
                        const username = parsedUrl.searchParams.get('username') || parsedBody.username;
                        if (!username) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'username parameter required' }));
                            return;
                        }
                        import('../database/MongoManager.js').then(({ UpdateUser }) => {
                            UpdateUser(mongoClient, username, parsedBody).then(() => {
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: true }));
                            }).catch(err => {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Failed to update user' }));
                            });
                        });
                    } catch (e) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid JSON' }));
                    }
                });
            } else if (req.method === 'DELETE') {
                const username = parsedUrl.searchParams.get('username');
                if (!username) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'username parameter required for deletion' }));
                    return;
                }
                import('../database/MongoManager.js').then(({ DeleteUser }) => {
                    DeleteUser(mongoClient, username).then(() => {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    }).catch(err => {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to delete user' }));
                    });
                });
            } else {
                res.writeHead(405, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Method not allowed' }));
            }
        }).catch((err) => {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized', details: err.message }));
        });
        return;
    }

    // Normalize pathname to prevent directory traversal
    const safeSuffix = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(frontendPath, safeSuffix);

    // If filePath is a directory, append index.html
    try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }
    } catch (e) {
        // Fallback or ignore, handle in fs.readFile
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found\n');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Server Error: ${error.code}\n`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}
