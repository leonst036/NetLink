import ipLib from "npm:ip";

const port = parseInt(Deno.env.get("PORT") || "8000");
const dataFile = new URL('.', import.meta.url).pathname + "topology.json";

export interface Device {
    ip: string;
    hostname?: string;
}

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

async function writeTopology(data: any) {
    await Deno.writeTextFile(dataFile, JSON.stringify(data, null, 2));
}

function getLocalNetworkDetails(): { address: string; netmask: string } | null {
    try {
        const interfaces = Deno.networkInterfaces();
        for (const netInfo of interfaces) {
            if (netInfo.family === "IPv4" && !netInfo.address.startsWith("127.")) {
                return {
                    address: netInfo.address,
                    netmask: netInfo.netmask || "255.255.255.0"
                };
            }
        }
    } catch (e) {
        console.error("Error detecting network interfaces:", e);
    }
    return null;
}

async function reverseDns(ip: string): Promise<string | undefined> {
    try {
        const hostnames = await Deno.resolveDns(ip, "PTR");
        if (hostnames && hostnames.length > 0) {
            return hostnames[0].replace(/\.$/, "");
        }
    } catch {
        // Reverse DNS lookup failed or not found
    }
    return undefined;
}

async function pingHost(ip: string): Promise<boolean> {
    try {
        const cmd = new Deno.Command("ping", {
            args: ["-c", "1", "-W", "1", ip],
            stdout: "null",
            stderr: "null",
        });
        const { code } = await cmd.output();
        return code === 0;
    } catch {
        return false;
    }
}

async function scanDevice(ip: string): Promise<Device | null> {
    const isAlive = await pingHost(ip);
    if (isAlive) {
        const hostname = await reverseDns(ip);
        return { ip, hostname };
    }
    return null;
}

async function runNetworkScan(): Promise<Device[]> {
    let subnet;
    const scanCidr = Deno.env.get("SCAN_CIDR");
    if (scanCidr) {
        try {
            subnet = ipLib.cidrSubnet(scanCidr);
        } catch (err) {
            console.error("Invalid SCAN_CIDR provided:", scanCidr);
            return [];
        }
    } else {
        const netDetails = getLocalNetworkDetails();
        if (!netDetails) {
            console.error("Could not automatically detect local network interfaces.");
            return [];
        }
        subnet = ipLib.subnet(netDetails.address, netDetails.netmask);
    }

    const startLong = ipLib.toLong(subnet.firstAddress);
    const endLong = ipLib.toLong(subnet.lastAddress);

    const ips: string[] = [];
    for (let currentLong = startLong; currentLong <= endLong; currentLong++) {
        ips.push(ipLib.fromLong(currentLong));
    }

    const CONCURRENCY_LIMIT = 20;
    const foundDevices: Device[] = [];
    let ipIndex = 0;

    async function worker() {
        while (ipIndex < ips.length) {
            const ip = ips[ipIndex++];
            if (ip !== undefined) {
                const device = await scanDevice(ip);
                if (device) {
                    foundDevices.push(device);
                }
            }
        }
    }

    const numWorkers = Math.min(CONCURRENCY_LIMIT, ips.length);
    const workers = Array.from({ length: numWorkers }, () => worker());
    await Promise.all(workers);

    foundDevices.sort((a, b) => ipLib.toLong(a.ip) - ipLib.toLong(b.ip));
    return foundDevices;
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

    if (url.pathname === "/api/net-graph/scan" || url.pathname === "/api/net-graph/servers") {
        if (req.method === "GET") {
            try {
                const devices = await runNetworkScan();
                return new Response(JSON.stringify(devices), { status: 200, headers });
            } catch (e: any) {
                return new Response(JSON.stringify({ error: "Failed to scan network", details: e.message }), { status: 500, headers });
            }
        }
        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
    }

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
        } catch (e: any) {
            return new Response(JSON.stringify({ error: "Internal error", details: e.message }), { status: 500, headers });
        }
    }
    return new Response("Not Found", { status: 404, headers });
});
