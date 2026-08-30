import http from "http";
import { URL } from "url";
import crypto from "crypto";
import { authenticateToken, extractTokenFromRequest } from "../../auth/authenticator.js";
import { getMongoClient } from "../../database/MongoManager.js";
import { magicDnsRegistry } from "../../dns/MagicDnsRegistry.js";

async function updateNetConnectDevice(
    mongoClient: any,
    decoded: any,
    req: http.IncomingMessage
): Promise<void> {
    const deviceId = decoded.deviceId || decoded.userId || "unknown";
    if (!mongoClient || deviceId === "unknown") return;

    const username = decoded.userId || decoded.username || "";
    let userUuid = decoded.userUuid || decoded.user_uuid || "";

    if (!userUuid && username) {
        try {
            const user = await mongoClient.db("NetLink").collection("users").findOne({
                $or: [{ username }, { email: username }]
            });
            if (user) {
                if (!user.uuid) {
                    userUuid = crypto.randomUUID();
                    await mongoClient.db("NetLink").collection("users").updateOne(
                        { _id: user._id },
                        { $set: { uuid: userUuid } }
                    );
                } else {
                    userUuid = user.uuid;
                }
            }
        } catch (e) {
            console.error("Failed to query user for device update:", e);
        }
    }

    const updateFields: any = {
        targetId: deviceId,
        deviceId: deviceId,
        lastSeen: new Date(),
        status: "online",
        ip: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress
    };

    if (userUuid) updateFields.userUuid = userUuid;
    if (username) updateFields.username = username;
    if (decoded.deviceName) updateFields.deviceName = decoded.deviceName;
    if (decoded.clientType) updateFields.clientType = decoded.clientType;

    await mongoClient.db("NetLink").collection("devices").updateOne(
        { targetId: deviceId },
        {
            $set: updateFields,
            $setOnInsert: {
                createdAt: new Date()
            }
        },
        { upsert: true }
    );
}

function setCorsHeaders(res: http.ServerResponse): void {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function getDnsConfig(req: http.IncomingMessage) {
    return {
        enabled: true,
        server: process.env.MAGIC_DNS_HOST || req.headers.host?.split(':')[0] || '127.0.0.1',
        port: process.env.DNS_PORT ? parseInt(process.env.DNS_PORT, 10) : 53,
        suffix: 'netlink'
    };
}

// Handle ping request for NetConnect
export async function handleNetConnectPingRoute(req: http.IncomingMessage, res: http.ServerResponse, parsedUrl: URL): Promise<void> {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const token = extractTokenFromRequest(req, parsedUrl);
    const mongoClient = getMongoClient();

    try {
        const decoded = await authenticateToken(token, mongoClient);
        const deviceId = decoded.deviceId || decoded.userId || "unknown";
        console.log(`Received authenticated ping from netconnect (${deviceId})`);

        await updateNetConnectDevice(mongoClient, decoded, req);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ 
            message: "pong", 
            deviceId,
            dns: getDnsConfig(req)
        }));
    } catch (err: any) {
        console.log(`Received unauthorized ping from netconnect: ${err.message}`);
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized", details: err.message }));
    }
}

// Handle list request for NetConnect
export async function handleNetConnectListRoute(req: http.IncomingMessage, res: http.ServerResponse, parsedUrl: URL): Promise<void> {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const token = extractTokenFromRequest(req, parsedUrl);
    const mongoClient = getMongoClient();

    try {
        const decoded = await authenticateToken(token, mongoClient);
        const deviceId = decoded.deviceId || decoded.userId || "unknown";
        console.log(`Received authenticated list from netconnect (${deviceId})`);

        await updateNetConnectDevice(mongoClient, decoded, req);

        const username = decoded.userId || decoded.username || "";
        let userUuid = decoded.userUuid || decoded.user_uuid || "";

        if (!userUuid && username && mongoClient) {
            try {
                const user = await mongoClient.db("NetLink").collection("users").findOne({
                    $or: [{ username }, { email: username }]
                });
                if (user?.uuid) {
                    userUuid = user.uuid;
                }
            } catch (e) {
                console.error("Failed to lookup user UUID:", e);
            }
        }

        const requestedUuid = parsedUrl.searchParams.get("uuid") || parsedUrl.searchParams.get("userUuid");
        let filter: any = {};

        if (requestedUuid && (decoded.role === "admin" || requestedUuid === userUuid)) {
            filter = { userUuid: requestedUuid };
        } else if (userUuid) {
            filter = { $or: [{ userUuid }, { username }] };
        } else if (username && username !== "admin") {
            filter = { username };
        }

        const devices = mongoClient
            ? await mongoClient.db("NetLink").collection("devices").find(filter).toArray()
            : [];

        const enrichedDevices = devices.map((d: any) => {
            const devId = d.targetId || d.deviceId;
            const domain = magicDnsRegistry.getDomainForDevice(devId) || `${(d.deviceName || devId || '').toLowerCase().replace(/[^a-z0-9-]/g, '-')}.netlink`;
            return {
                ...d,
                domain
            };
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: true,
            userUuid: userUuid || undefined,
            devices: enrichedDevices,
            dns: {
                ...getDnsConfig(req),
                records: magicDnsRegistry.getAllRecords()
            }
        }));
    } catch (err: any) {
        console.log(`Received unauthorized list from netconnect: ${err.message}`);
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized", details: err.message }));
    }
}