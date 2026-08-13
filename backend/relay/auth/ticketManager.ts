import crypto from 'crypto';

interface TicketData {
    userId: string;
    target: string;
    expiresAt: number;
}

// In-memory store for single-use tickets
const ticketStore = new Map<string, TicketData>();

// Tickets expire after 30 seconds
const TICKET_TTL_MS = 30 * 1000; 

/**
 * Generates a single-use authentication ticket
 */
export function generateTicket(userId: string, target: string): string {
    const ticket = crypto.randomUUID();
    ticketStore.set(ticket, {
        userId,
        target,
        expiresAt: Date.now() + TICKET_TTL_MS
    });
    return ticket;
}

/**
 * Validates and consumes a single-use ticket.
 * If valid, returns the associated user data and destroys the ticket.
 */
export function consumeTicket(ticket: string): TicketData | null {
    const data = ticketStore.get(ticket);
    if (!data) return null;

    if (Date.now() > data.expiresAt) {
        ticketStore.delete(ticket); // Clean up on expired access
        return null; // Expired
    }

    return data;
}

// Optional: cleanup interval for expired tickets (prevents memory leaks over time)
setInterval(() => {
    const now = Date.now();
    for (const [ticket, data] of ticketStore.entries()) {
        if (now > data.expiresAt) {
            ticketStore.delete(ticket);
        }
    }
}, 60 * 1000);
