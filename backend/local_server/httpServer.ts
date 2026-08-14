import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import dotenv from "dotenv";
import httpProxy from "http-proxy";
import { denoSandbox } from "./sandbox/DenoSandbox.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

function ensureCertificates(keyPath: string, certPath: string): void {
    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        console.log("SSL certificate or key not found. Attempting to generate self-signed certificate using openssl...");
        try {
            execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -sha256 -days 365 -nodes -subj "/CN=localhost"`, { stdio: "inherit" });
            console.log("Self-signed certificate generated successfully.");
        } catch (error: any) {
            console.error("Failed to generate self-signed certificates using openssl. Please ensure openssl is installed and in your PATH, or generate them manually.");
            console.error(error.message);
            throw new Error("SSL certificates missing and could not be auto-generated.");
        }
    }
}

export function createHttpsServer(): https.Server {
    const keyPath = path.resolve(__dirname, process.env.SSL_KEY_PATH || "key.pem");
    const certPath = path.resolve(__dirname, process.env.SSL_CERT_PATH || "cert.pem");

    ensureCertificates(keyPath, certPath);

    const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    };

    const proxy = httpProxy.createProxyServer({});
    proxy.on("error", (err, req, res) => {
        console.error("Local Proxy error:", err);
        if (res instanceof http.ServerResponse) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Bad Gateway");
        }
    });

    return https.createServer(options, (req, res) => {
        // Proxy app requests
        const match = req.url?.match(/^\/api\/([^\/]+)(?:\/|$)/);
        if (match) {
            const appId = match[1] as string;
            const app = denoSandbox.getApp(appId);
            if (app) {
                proxy.web(req, res, { target: `http://localhost:${app.port}` });
                return;
            }
        }

        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
    });
}
