import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

function ensureCertificates(keyPath: string, certPath: string): void {
    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        console.log('SSL certificate or key not found. Attempting to generate self-signed certificate using openssl...');
        try {
            execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -sha256 -days 365 -nodes -subj "/CN=localhost"`, { stdio: 'inherit' });
            console.log('Self-signed certificate generated successfully.');
        } catch (error: any) {
            console.error('Failed to generate self-signed certificates using openssl. Please ensure openssl is installed and in your PATH, or generate them manually.');
            console.error(error.message);
            throw new Error('SSL certificates missing and could not be auto-generated.');
        }
    }
}

export function createHttpsServer(): https.Server {
    const keyPath = path.resolve(__dirname, process.env.SSL_KEY_PATH || 'key.pem');
    const certPath = path.resolve(__dirname, process.env.SSL_CERT_PATH || 'cert.pem');

    ensureCertificates(keyPath, certPath);

    const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    };

    return https.createServer(options, (req, res) => {
        if (req.url === '/' || req.url === '/index.html') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(fs.readFileSync(path.join(__dirname, '../../frontend/index.html')));
        } else if (req.url === '/xterm.js') {
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(fs.readFileSync(path.join(__dirname, 'node_modules/xterm/lib/xterm.js')));
        } else if (req.url === '/xterm.css') {
            res.writeHead(200, { 'Content-Type': 'text/css' });
            res.end(fs.readFileSync(path.join(__dirname, 'node_modules/xterm/css/xterm.css')));
        } else {
            res.writeHead(404);
            res.end();
        }
    });
}
