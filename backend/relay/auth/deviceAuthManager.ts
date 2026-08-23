import crypto from "crypto";
import { GenerateToken } from "./tokenManager.js";
import { StoreToken } from "../database/MongoManager.js";
import * as mongoDB from "mongodb";

export interface DeviceSession {
    device_code: string;
    user_code: string;
    device_name: string;
    client_type: string;
    status: "pending" | "approved" | "denied" | "expired";
    token?: string;
    target_id?: string;
    username?: string;
    createdAt: number;
    expiresAt: number;
    expires_in: number;
    interval: number;
}

const deviceSessionStore = new Map<string, DeviceSession>();
const userCodeIndex = new Map<string, string>(); // user_code -> device_code
const SESSION_TTL_SECONDS = 300; // 5 minutes
const POLLING_INTERVAL_SECONDS = 2;

function generateRandomUserCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let randomPart = "";
    for (let i = 0; i < 4; i++) {
        const idx = crypto.randomInt(0, chars.length);
        randomPart += chars[idx];
    }
    return `NET-${randomPart}`;
}

export function createDeviceSession(
    deviceName: string,
    clientType: string,
    reqHost: string,
    reqProtocol = "http"
): {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete: string;
    expires_in: number;
    interval: number;
} {
    const device_code = `dev_session_${crypto.randomBytes(16).toString("hex")}`;
    let user_code = generateRandomUserCode();

    // Ensure user_code collision is avoided
    while (userCodeIndex.has(user_code)) {
        user_code = generateRandomUserCode();
    }

    const now = Date.now();
    const expiresAt = now + SESSION_TTL_SECONDS * 1000;

    const session: DeviceSession = {
        device_code,
        user_code,
        device_name: deviceName || "netconnect-device",
        client_type: clientType || "netconnect-desktop",
        status: "pending",
        createdAt: now,
        expiresAt,
        expires_in: SESSION_TTL_SECONDS,
        interval: POLLING_INTERVAL_SECONDS,
    };

    deviceSessionStore.set(device_code, session);
    userCodeIndex.set(user_code, device_code);

    // Build verification URIs (using frontend host)
    const normalizedHost = reqHost.replace(/:\d+$/, "") || "localhost";
    const port = reqHost.includes(":") ? reqHost.split(":")[1] : "";
    // If request comes from backend (e.g. 4535), point to frontend dev port if local
    const targetHost = reqHost;

    const verification_uri = `${reqProtocol}://${targetHost}/devices/authorize`;
    const verification_uri_complete = `${reqProtocol}://${targetHost}/devices/authorize?code=${user_code}`;

    return {
        device_code,
        user_code,
        verification_uri,
        verification_uri_complete,
        expires_in: SESSION_TTL_SECONDS,
        interval: POLLING_INTERVAL_SECONDS,
    };
}

export function getDeviceSession(code: string): DeviceSession | null {
    if (!code) return null;
    const normalizedCode = code.trim().toUpperCase();

    let deviceCode = code;
    if (userCodeIndex.has(normalizedCode)) {
        deviceCode = userCodeIndex.get(normalizedCode)!;
    }

    const session = deviceSessionStore.get(deviceCode);
    if (!session) return null;

    if (Date.now() > session.expiresAt && session.status === "pending") {
        session.status = "expired";
    }

    return session;
}

export function pollDeviceToken(deviceCode: string): {
    status: "pending" | "approved" | "denied" | "expired";
    token?: string | undefined;
    target_id?: string | undefined;
    username?: string | undefined;
} {
    const session = deviceSessionStore.get(deviceCode);
    if (!session) {
        return { status: "expired" };
    }

    if (Date.now() > session.expiresAt) {
        session.status = "expired";
        return { status: "expired" };
    }

    if (session.status === "approved") {
        return {
            status: "approved",
            token: session.token,
            target_id: session.target_id,
            username: session.username,
        };
    }

    return { status: session.status };
}

export async function approveDeviceSession(
    code: string,
    username: string,
    role: string,
    permissions: string[],
    targetId: string,
    secretKey: string,
    mongoClient: mongoDB.MongoClient | null
): Promise<{ success: boolean; status: string; error?: string }> {
    const session = getDeviceSession(code);
    if (!session) {
        return { success: false, status: "not_found", error: "Device session not found or expired" };
    }

    if (session.status === "expired" || Date.now() > session.expiresAt) {
        session.status = "expired";
        return { success: false, status: "expired", error: "Device session has expired" };
    }

    if (session.status !== "pending") {
        return { success: false, status: session.status, error: `Session already ${session.status}` };
    }

    const tokenPayload = {
        userId: username,
        deviceId: targetId,
        targetId: targetId,
        role: role || "user",
        permissions: permissions || [],
        clientType: session.client_type,
        deviceName: session.device_name,
    };

    // Scoped token for device link (30 days validity)
    const token = await GenerateToken(tokenPayload, secretKey, { expiresIn: "30d" });

    if (mongoClient) {
        await StoreToken(mongoClient, token, targetId);
    }

    session.status = "approved";
    session.token = token;
    session.target_id = targetId;
    session.username = username;

    return { success: true, status: "approved" };
}

export function denyDeviceSession(code: string): { success: boolean; status: string } {
    const session = getDeviceSession(code);
    if (!session) {
        return { success: false, status: "not_found" };
    }

    session.status = "denied";
    return { success: true, status: "denied" };
}

// Periodic cleanup of expired sessions
setInterval(() => {
    const now = Date.now();
    for (const [deviceCode, session] of deviceSessionStore.entries()) {
        if (now > session.expiresAt + 60 * 1000) {
            userCodeIndex.delete(session.user_code);
            deviceSessionStore.delete(deviceCode);
        }
    }
}, 60 * 1000);
