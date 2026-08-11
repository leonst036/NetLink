import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

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

export function handleFaviconRoute(res: http.ServerResponse): void {
    const faviconPath = path.join(frontendPath, 'favicon.svg');
    if (fs.existsSync(faviconPath)) {
        const stat = fs.statSync(faviconPath);
        res.writeHead(200, {
            'Content-Type': 'image/svg+xml',
            'Content-Length': stat.size
        });
        const readStream = fs.createReadStream(faviconPath);
        readStream.pipe(res);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Favicon not found');
    }
}

export function handleStaticFileRoute(pathname: string, res: http.ServerResponse): void {
    // Normalize pathname to prevent directory traversal
    const safeSuffix = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(frontendPath, safeSuffix);

    // In dev mode (frontendPath doesn't end with dist), static files might be in public/
    if (!filePath.includes('dist') && !fs.existsSync(filePath)) {
        const publicPath = path.join(frontendPath, 'public', safeSuffix);
        if (fs.existsSync(publicPath)) {
            filePath = publicPath;
        }
    }

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

export function handleAppFrontendRoute(pathname: string, res: http.ServerResponse): void {
    // pathname like /apps/{appId}/frontend/...
    const parts = pathname.split('/');
    if (parts.length < 4 || parts[1] !== 'apps' || parts[3] !== 'frontend') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
    }
    
    const appId = parts[2] as string;
    const subPath = parts.slice(4).join('/');
    
    // Relay apps directory is at ../NetStore/Applications relative to the src/dist root
    const RELAY_APPS_DIR = path.join(__dirname, '..', 'NetStore', 'Applications');
    const safeSuffix = path.normalize(subPath).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(RELAY_APPS_DIR, appId, 'frontend', safeSuffix);

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
            res.end(content); // Raw content, no utf-8 forced (important for images)
        }
    });
}
