const port = parseInt(Deno.env.get("PORT") || "8000");
const dataFile = "./topology.json";

async function readTopology() {
    try {
        const text = await Deno.readTextFile(dataFile);
        return JSON.parse(text);
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            return { nodes: [], edges: [], nicknames: {} };
        }
        console.error("Error reading topology file:", error);
        return { nodes: [], edges: [], nicknames: {} };
    }
}

async function writeTopology(data) {
    await Deno.writeTextFile(dataFile, JSON.stringify(data, null, 2));
}

Deno.serve({ port }, async (req) => {
    const url = new URL(req.url);
    const headers = new Headers({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

    if (url.pathname === "/api/net-graph/topology") {
        try {
            if (req.method === "GET") {
                const data = await readTopology();
                return new Response(JSON.stringify(data), { status: 200, headers });
            } 
            if (req.method === "POST") {
                const body = await req.json();
                const { nodes, edges, nicknames } = body;
                if (!nodes || !edges) return new Response(JSON.stringify({ error: "nodes and edges required" }), { status: 400, headers });
                await writeTopology({ nodes, edges, nicknames: nicknames || {} });
                return new Response(JSON.stringify({ success: true }), { status: 200, headers });
            }
            return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: "Internal error", details: e.message }), { status: 500, headers });
        }
    }
    return new Response("Not Found", { status: 404, headers });
});
