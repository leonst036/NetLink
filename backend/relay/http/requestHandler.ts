import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, URL } from 'url';

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
console.log(`[HTTP Server] Serving frontend files from: ${frontendPath}`);

/**
 * Handles incoming HTTP requests to serve frontend files and support basic health checks.
 */
export function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Health check route
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('NetLink Relay Server is running.\n');
        return;
    }

    // Resolve static file path
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    let pathname = parsedUrl.pathname;
    
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
