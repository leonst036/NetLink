import { Client } from "npm:ssh2";

const port = parseInt(Deno.env.get("PORT") || "8000");

Deno.serve({ port }, async (req) => {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        });
    }

    if (req.method === "POST" && (url.pathname.endsWith("/execute") || url.pathname.includes("/execute"))) {
        try {
            const body = await req.json();
            const { host, port: sshPort, username, password, command } = body;

            if (!host || !username || !command) {
                return new Response(JSON.stringify({ error: "Missing required fields (host, username, command)" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                });
            }

            const output = await new Promise((resolve, reject) => {
                const conn = new Client();
                let stdout = "";
                let stderr = "";

                conn.on("ready", () => {
                    conn.exec(command, (err: any, stream: any) => {
                        if (err) {
                            conn.end();
                            return reject(err);
                        }
                        stream.on("close", (code: number, signal: any) => {
                            conn.end();
                            resolve({ code, stdout, stderr });
                        }).on("data", (data: any) => {
                            stdout += data.toString();
                        }).stderr.on("data", (data: any) => {
                            stderr += data.toString();
                        });
                    });
                }).on("error", (err: any) => {
                    reject(err);
                }).connect({
                    host,
                    port: sshPort || 22,
                    username,
                    password,
                    readyTimeout: 10000,
                });
            });

            return new Response(JSON.stringify(output), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });

        } catch (error: any) {
            return new Response(JSON.stringify({ error: error.message || "Unknown error occurred" }), {
                status: 500,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
        }
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
});
