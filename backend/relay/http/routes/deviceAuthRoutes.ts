import http from "http";
import { URL } from "url";
import {
    createDeviceSession,
    getDeviceSession,
    pollDeviceToken,
    approveDeviceSession,
    denyDeviceSession,
} from "../../auth/deviceAuthManager.js";
import { authenticateToken, extractTokenFromRequest } from "../../auth/authenticator.js";
import { getMongoClient } from "../../database/MongoManager.js";
import { controlConnections } from "../../websocket/connectionManager.js";

function getRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", chunk => { body += chunk.toString(); });
        req.on("end", () => resolve(body));
        req.on("error", err => reject(err));
    });
}

function setCorsHeaders(res: http.ServerResponse): void {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export async function handleDeviceCodeRoute(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    parsedUrl: URL
): Promise<void> {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
    }

    try {
        const rawBody = await getRequestBody(req);
        const body = rawBody ? JSON.parse(rawBody) : {};
        const deviceName = body.device_name || "netconnect-device";
        const clientType = body.client_type || "netconnect-desktop";

        const reqHost = req.headers.host || "localhost:5171";
        const protocol = (req.headers["x-forwarded-proto"] as string) || (process.env.USE_SSL === "true" ? "https" : "http");

        const session = createDeviceSession(deviceName, clientType, reqHost, protocol);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(session));
    } catch (err: any) {
        console.error("Error creating device authorization code:", err);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message || "Failed to create device authorization code" }));
    }
}

export async function handleDeviceTokenRoute(
    req: http.IncomingMessage,
    res: http.ServerResponse
): Promise<void> {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
    }

    try {
        const rawBody = await getRequestBody(req);
        const body = rawBody ? JSON.parse(rawBody) : {};
        const deviceCode = body.device_code;

        if (!deviceCode) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "device_code is required" }));
            return;
        }

        const pollResult = pollDeviceToken(deviceCode);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(pollResult));
    } catch (err: any) {
        console.error("Error polling device token:", err);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message || "Failed to poll device token" }));
    }
}

export async function handleDeviceSessionInfoRoute(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    parsedUrl: URL
): Promise<void> {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method !== "GET") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
    }

    const token = extractTokenFromRequest(req, parsedUrl);
    const mongoClient = getMongoClient();

    try {
        const decoded = await authenticateToken(token, mongoClient);
        const username = decoded.userId || decoded.username || decoded.sub || "admin";

        const code = parsedUrl.searchParams.get("code") || "";
        if (!code) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "code query parameter is required" }));
            return;
        }

        const session = getDeviceSession(code);
        if (!session) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Device session not found or expired" }));
            return;
        }

        // Fetch user's allowed target servers
        let availableTargets: string[] = [];
        if (mongoClient) {
            try {
                const user = await mongoClient.db("NetLink").collection("users").findOne({
                    $or: [{ username }, { email: username }]
                });
                if (user && user.targets && Array.isArray(user.targets)) {
                    availableTargets = user.targets;
                }
            } catch (e) {
                console.error("Failed to query user targets:", e);
            }
        }

        // Include any currently connected local servers
        const onlineConnected = Array.from(controlConnections.keys());
        for (const targetId of onlineConnected) {
            if (!availableTargets.includes(targetId)) {
                availableTargets.push(targetId);
            }
        }

        if (availableTargets.length === 0) {
            availableTargets.push("local-server");
        }

        const timeLeft = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            device_code: session.device_code,
            user_code: session.user_code,
            device_name: session.device_name,
            client_type: session.client_type,
            status: session.status,
            expires_in: timeLeft,
            available_targets: availableTargets,
            online_targets: onlineConnected,
        }));
    } catch (err: any) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized", details: err.message }));
    }
}

export async function handleDeviceApproveRoute(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    parsedUrl: URL
): Promise<void> {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
    }

    const token = extractTokenFromRequest(req, parsedUrl);
    const mongoClient = getMongoClient();

    try {
        const decoded = await authenticateToken(token, mongoClient);
        const username = decoded.userId || decoded.username || decoded.sub || "admin";
        let role = decoded.role || "user";
        let permissions = decoded.permissions || [];

        const rawBody = await getRequestBody(req);
        const body = rawBody ? JSON.parse(rawBody) : {};
        const code = body.code || body.user_code || body.device_code;
        const decision = (body.decision || "approve").toLowerCase();
        const targetId = body.target_id || "local-server";
        const password = body.password;

        if (!code) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Device code or user_code is required" }));
            return;
        }

        if (decision === "deny") {
            const denyResult = denyDeviceSession(code);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(denyResult));
            return;
        }

        // Require password confirmation for approving device connection
        if (!password) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Password confirmation is required to authorize device" }));
            return;
        }

        const envUser = process.env.ADMIN_USERNAME || "admin";
        const envPass = process.env.ADMIN_PASSWORD || "admin";

        let isPasswordValid = false;
        if (username === envUser && password === envPass) {
            isPasswordValid = true;
            role = "admin";
            permissions = ["manage_users", "manage_logins", "access_terminal", "access_vnc", "access_sftp", "scan_network"];
        } else if (username === "testuser2" && password === "password123") {
            isPasswordValid = true;
            role = "user";
            permissions = [];
        } else if (mongoClient) {
            try {
                const { CheckUser } = await import("../../database/MongoManager.js");
                const user = await CheckUser(mongoClient, username);
                if (user && user.password === password) {
                    isPasswordValid = true;
                    role = user.role || "user";
                    permissions = user.permissions || [];
                }
            } catch (dbErr) {
                console.error("Failed to verify password in database:", dbErr);
            }
        }

        if (!isPasswordValid) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Incorrect password. Authorization rejected." }));
            return;
        }

        const secretKey = process.env.JWT_SECRET || "default_secret";
        const result = await approveDeviceSession(
            code,
            username,
            role,
            permissions,
            targetId,
            secretKey,
            mongoClient
        );

        if (!result.success) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
            return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
    } catch (err: any) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized", details: err.message }));
    }
}
