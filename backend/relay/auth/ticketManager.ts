import crypto from "crypto";

export interface TicketData {
    userId: string;
    target: string;
    role?: string;
    permissions?: string[];
    expiresAt: number;
}

const ticketStore = new Map<string, TicketData>();
const TICKET_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for active app sessions

export function generateTicket(userId: string, target: string, role?: string, permissions?: string[]): string {
    const ticket = crypto.randomUUID();
    ticketStore.set(ticket, {
        userId,
        target,
        role: role || (userId === "admin" ? "admin" : "user"),
        permissions: permissions || [],
        expiresAt: Date.now() + TICKET_TTL_MS
    });
    return ticket;
}

export function consumeTicket(ticket: string): TicketData | null {
    const data = ticketStore.get(ticket);
    if (!data) return null;

    if (Date.now() > data.expiresAt) {
        ticketStore.delete(ticket);
        return null;
    }

    return data;
}

setInterval(() => {
    const now = Date.now();
    for (const [ticket, data] of ticketStore.entries()) {
        if (now > data.expiresAt) {
            ticketStore.delete(ticket);
        }
    }
}, 60 * 1000);
