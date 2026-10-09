import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureCertificates(keyPath: string, certPath: string): void {
    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        try {
            execFileSync('openssl', [
                'req', '-x509', '-newkey', 'rsa:2048',
                '-keyout', keyPath,
                '-out', certPath,
                '-sha256', '-days', '365', '-nodes',
                '-subj', '/CN=localhost'
            ], { stdio: 'inherit' });
        } catch (error: any) {
            console.error('Failed to generate SSL certificates:', error.message);
            throw new Error('SSL certificates missing and could not be auto-generated.');
        }
    }
}

/**
 * Creates either an HTTP or an HTTPS server depending on environment variables.
 */
export function createServer(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void): http.Server | https.Server {
    const useSSL = process.env.USE_SSL === 'true';
    if (useSSL) {
        const keyPath = path.resolve(__dirname, '../' + (process.env.SSL_KEY_PATH || 'key.pem'));
        const certPath = path.resolve(__dirname, '../' + (process.env.SSL_CERT_PATH || 'cert.pem'));
        ensureCertificates(keyPath, certPath);

        const options = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };
        console.log('Starting relay server in SECURE mode (HTTPS/WSS).');
        return https.createServer(options, handler);
    } else {
        console.log('Starting relay server in STANDARD mode (HTTP/WS).');
        return http.createServer(handler);
    }
}
