import http from "http";
import { URL } from "url";
import { authenticateToken, extractTokenFromRequest } from "../../auth/authenticator.js";
import { getMongoClient } from "../../database/MongoManager.js";

// Handle ping request for NetConnect
export async function handleNetConnectPingRoute(req: http.IncomingMessage, res: http.ServerResponse, parsedUrl: URL): Promise<void> {
    const token = extractTokenFromRequest(req, parsedUrl);
    const mongoClient = getMongoClient();

    try {
        const decoded = await authenticateToken(token, mongoClient);
        const deviceId = decoded.deviceId || decoded.userId || "unknown";
        console.log(`Received authenticated ping from netconnect (${deviceId})`);

        if (mongoClient && deviceId !== "unknown") {
            await mongoClient.db("NetLink").collection("devices").updateOne(
                { targetId: deviceId },
                {
                    $set: {
                        targetId: deviceId,
                        deviceId: deviceId,
                        lastSeen: new Date(),
                        status: "online",
                        ip: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress
                    }
                },
                { upsert: true }
            );
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "pong", deviceId }));
    } catch (err: any) {
        console.log(`Received unauthorized ping from netconnect: ${err.message}`);
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized", details: err.message }));
    }
}
