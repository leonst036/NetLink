const port = parseInt(Deno.env.get("PORT") || "8000");
const dataFile = new URL('./topology.json', import.meta.url).pathname;

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
        return { nodes: [], edges: [], nicknames: {} };
    }
}

async function writeTopology(data: any) {
    try {
        await Deno.writeTextFile(dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error writing topology file:", error);
    }
}

function ipToLong(ip: string): number {
    return ip.split('.').reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

function longToIp(long: number): string {
    return [
        (long >>> 24) & 255,
        (long >>> 16) & 255,
        (long >>> 8) & 255,
        long & 255
    ].join('.');
}

function parseCidr(cidr: string): { startLong: number; endLong: number } | null {
    try {
        const [ip, bitsStr] = cidr.split('/');
        const bits = parseInt(bitsStr, 10);
        if (isNaN(bits) || bits < 0 || bits > 32) return null;
        const maskLong = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
        const ipLong = ipToLong(ip);
        const networkLong = (ipLong & maskLong) >>> 0;
        const broadcastLong = (networkLong | (~maskLong >>> 0)) >>> 0;
        return {
            startLong: networkLong + 1,
            endLong: broadcastLong - 1
        };
    } catch {
        return null;
    }
}

function getLocalNetworkRange(): { startLong: number; endLong: number } | null {
    const scanCidr = Deno.env.get("SCAN_CIDR");
    if (scanCidr) {
        const range = parseCidr(scanCidr);
        if (range) return range;
    }

    try {
        const interfaces = Deno.networkInterfaces();
        for (const netInfo of interfaces) {
            if (
                netInfo.family === "IPv4" &&
                !netInfo.address.startsWith("127.") &&
                !netInfo.name.startsWith("docker") &&
                !netInfo.name.startsWith("veth")
            ) {
                const ipLong = ipToLong(netInfo.address);
                const mask = netInfo.netmask || "255.255.255.0";
                const maskLong = ipToLong(mask);
                const networkLong = (ipLong & maskLong) >>> 0;
                const broadcastLong = (networkLong | (~maskLong >>> 0)) >>> 0;
                return {
                    startLong: networkLong + 1,
                    endLong: broadcastLong - 1
                };
            }
        }
    } catch (e) {
        console.error("Error detecting network interfaces:", e);
    }
    return null;
}

function ipToInAddrArpa(ip: string): string {
    return ip.split('.').reverse().join('.') + '.in-addr.arpa';
}

async function reverseDns(ip: string): Promise<string | undefined> {
    try {
        const arpa = ipToInAddrArpa(ip);
        const hostnames = await Deno.resolveDns(arpa, "PTR");
        if (hostnames && hostnames.length > 0) {
            return hostnames[0].replace(/\.$/, "");
        }
    } catch {
        // PTR record not found or DNS lookup failed
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
    const range = getLocalNetworkRange();
    if (!range || range.startLong > range.endLong) {
        console.error("Could not determine network range to scan.");
        return [];
    }

    const ips: string[] = [];
    for (let currentLong = range.startLong; currentLong <= range.endLong; currentLong++) {
        ips.push(longToIp(currentLong));
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

    foundDevices.sort((a, b) => ipToLong(a.ip) - ipToLong(b.ip));
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
