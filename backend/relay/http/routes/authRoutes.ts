import http from "http";
import { URL } from "url";
import { getMongoClient, RegisterUser, StoreToken } from "../../database/MongoManager.js";
import { controlConnections } from "../../websocket/connectionManager.js";
import { GenerateToken, VerifyToken } from "../../auth/tokenManager.js";
import { generateTicket } from "../../auth/ticketManager.js";

export async function handleRegisterRoute(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", async () => {
        try {
            const parsedBody = JSON.parse(body);
            const mongoClient = getMongoClient();
            if (!mongoClient) {
                res.writeHead(503, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Database not available" }));
                return;
            }
            await RegisterUser(mongoClient, parsedBody);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
        } catch (err: any) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message || "Failed to register user" }));
        }
    });
}

export async function handleValidateTargetRoute(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    let target = parsedUrl.searchParams.get("target");
    let requestedUser = parsedUrl.searchParams.get("user") || parsedUrl.searchParams.get("userId");

    const proceed = async (targetId: string, usernameParam?: string) => {
        if (!targetId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "target parameter required" }));
            return;
        }

        const isValid = !controlConnections.has(targetId);
        if (!isValid) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ valid: false }));
            return;
        }

        const mongoClient = getMongoClient();
        let userId = usernameParam || "";
        let role = "admin";
        let permissions: string[] = ["manage_users", "manage_logins", "access_terminal", "access_vnc", "access_sftp", "scan_network"];

        if (mongoClient) {
            try {
                if (userId) {
                    const user = await mongoClient.db("NetLink").collection("users").findOne({
                        $or: [{ username: userId }, { email: userId }]
                    });
                    if (user) {
                        userId = user.username;
                        role = user.role || "user";
                        permissions = user.permissions || [];
                    }
                } else {
                    const user = await mongoClient.db("NetLink").collection("users").findOne({ targets: targetId });
                    if (user) {
                        userId = user.username;
                        role = user.role || "user";
                        permissions = user.permissions || [];
                    }
                }
            } catch (e) {
                console.error("Failed to look up user for target validation:", e);
            }
        }

        if (!userId) {
            userId = process.env.ADMIN_USERNAME || "admin";
            role = "admin";
            permissions = ["manage_users", "manage_logins", "access_terminal", "access_vnc", "access_sftp", "scan_network"];
        }

        const tokenPayload = {
            deviceId: targetId,
            userId,
            role,
            permissions
        };

        const token = await GenerateToken(tokenPayload, process.env.JWT_SECRET || "default_secret");

        if (mongoClient) {
            await StoreToken(mongoClient, token, targetId);
            try {
                await mongoClient.db("NetLink").collection("users").updateOne(
                    { username: userId },
                    { $addToSet: { targets: targetId } }
                );
            } catch (e) {}
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ valid: true, token, user: userId }));
    };

    if (req.method === "POST" && !target) {
        let body = "";
        req.on("data", chunk => { body += chunk.toString(); });
        req.on("end", async () => {
            try {
                if (body) {
                    const parsed = JSON.parse(body);
                    target = parsed.target || target;
                    requestedUser = parsed.user || parsed.userId || requestedUser;
                }
            } catch (e) {}
            await proceed(target || "", requestedUser || "");
        });
    } else {
        await proceed(target || "", requestedUser || "");
    }
}

export async function handleTicketRoute(req: http.IncomingMessage, res: http.ServerResponse, parsedUrl: URL): Promise<void> {
    if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");

    const authHeader = req.headers.authorization;
    let token = "";
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1] || "";
    } else {
        const cookieHeader = req.headers.cookie || "";
        const matchToken = cookieHeader.match(/netlink_token=([^;]+)/);
        if (matchToken) {
            token = matchToken[1] || "";
        }
    }

    if (!token) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
    }

    try {
        const decoded: any = await VerifyToken(token, process.env.JWT_SECRET || "default_secret");
        const userId = decoded.userId || decoded.deviceId;
        if (!decoded || !userId) {
            throw new Error("Invalid token payload");
        }

        let body = "";
        req.on("data", chunk => { body += chunk.toString(); });
        req.on("end", () => {
            try {
                const parsedBody = body ? JSON.parse(body) : {};
                const target = parsedBody.target || parsedUrl.searchParams.get("target") || "";
                
                const ticket = generateTicket(userId, target, decoded.role, decoded.permissions);
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, ticket }));
            } catch (err: any) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Bad request" }));
            }
        });
    } catch (err: any) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized", details: err.message }));
    }
}
