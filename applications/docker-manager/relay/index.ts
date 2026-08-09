import { Client } from "npm:ssh2";

const port = parseInt(Deno.env.get("PORT") || "8000");

async function executeLocal(command: string): Promise<{ code: number; stdout: string; stderr: string }> {
    try {
        const cmd = new Deno.Command("sh", {
            args: ["-c", command],
            stdout: "piped",
            stderr: "piped",
        });
        const process = cmd.spawn();
        const { code, stdout, stderr } = await process.output();
        const decoder = new TextDecoder();
        return {
            code,
            stdout: decoder.decode(stdout),
            stderr: decoder.decode(stderr),
        };
    } catch (err: any) {
        return {
            code: 1,
            stdout: "",
            stderr: err.message || "Failed to execute local command",
        };
    }
}

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

            if (!command) {
                return new Response(JSON.stringify({ error: "Missing required field (command)" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                });
            }

            const cleanHost = (host || "").trim().toLowerCase();
            const isLocal = !cleanHost || cleanHost === "localhost" || cleanHost === "127.0.0.1" || cleanHost === "local";

            let output: { code: number; stdout: string; stderr: string };

            if (!isLocal && username && password) {
                try {
                    output = await new Promise((resolve, reject) => {
                        const conn = new Client();
                        let stdout = "";
                        let stderr = "";

                        conn.on("ready", () => {
                            conn.exec(command, (err: any, stream: any) => {
                                if (err) {
                                    conn.end();
                                    return reject(err);
                                }
                                stream.on("close", (code: number) => {
                                    conn.end();
                                    resolve({ code: code || 0, stdout, stderr });
                                }).on("data", (data: any) => {
                                    stdout += data.toString();
                                }).stderr.on("data", (data: any) => {
                                    stderr += data.toString();
                                });
                            });
                        }).on("error", (err: any) => {
                            reject(err);
                        }).connect({
                            host: cleanHost,
                            port: sshPort || 22,
                            username,
                            password,
                            readyTimeout: 10000,
                        });
                    });
                } catch (sshErr: any) {
                    if (cleanHost === "localhost" || cleanHost === "127.0.0.1") {
                        output = await executeLocal(command);
                    } else {
                        throw sshErr;
                    }
                }
            } else {
                output = await executeLocal(command);
            }

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

