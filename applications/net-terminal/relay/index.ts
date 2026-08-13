const port = parseInt(Deno.env.get("PORT") || "8000");
const dataFile = new URL('.', import.meta.url).pathname + "ssh-sessions.json";

// Helper to read data
async function readSessions() {
    try {
        const text = await Deno.readTextFile(dataFile);
        return JSON.parse(text);
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            return [];
        }
        console.error("Error reading sessions file:", error);
        return [];
    }
}

// Helper to write data
async function writeSessions(sessions) {
    await Deno.writeTextFile(dataFile, JSON.stringify(sessions, null, 2));
}

Deno.serve({ port }, async (req) => {
    const url = new URL(req.url);
    const headers = new Headers({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

    if (url.pathname === "/api/net-terminal/ssh-sessions") {
        try {
            if (req.method === "GET") {
                const sessions = await readSessions();
                return new Response(JSON.stringify({ sessions }), { status: 200, headers });
            } 
            if (req.method === "POST") {
                const body = await req.json();
                if (!body.sessionId || !body.target) return new Response(JSON.stringify({ error: "sessionId and target required" }), { status: 400, headers });
                const sessions = await readSessions();
                const existingIndex = sessions.findIndex(s => s.sessionId === body.sessionId);
                if (existingIndex >= 0) sessions[existingIndex] = { ...sessions[existingIndex], ...body };
                else sessions.push(body);
                await writeSessions(sessions);
                return new Response(JSON.stringify({ success: true, sessionId: body.sessionId }), { status: 200, headers });
            }
            if (req.method === "DELETE") {
                const sessionId = url.searchParams.get('sessionId');
                if (!sessionId) return new Response(JSON.stringify({ error: "sessionId required" }), { status: 400, headers });
                const sessions = await readSessions();
                const newSessions = sessions.filter(s => s.sessionId !== sessionId);
                await writeSessions(newSessions);
                return new Response(JSON.stringify({ success: true }), { status: 200, headers });
            }
            return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: "Internal error", details: e.message }), { status: 500, headers });
        }
    }
    return new Response("Not Found", { status: 404, headers });
});
