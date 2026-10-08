import dgram from 'node:dgram';
import net from 'node:net';
import os from 'node:os';
import dnsPacket from 'dns-packet';
import { MagicDnsRegistry, magicDnsRegistry } from './MagicDnsRegistry.js';
import type { MagicDnsServerOptions } from './types.js';

export type { MagicDnsServerOptions };

export class MagicDnsServer {
    private sockets: dgram.Socket[] = [];
    private tcpServers: net.Server[] = [];
    private port: number;
    private host: string;
    private ttl: number;
    private upstreamDns: string | undefined;
    private enableTcp: boolean;
    public readonly registry: MagicDnsRegistry;

    constructor(registryOrOptions?: MagicDnsRegistry | MagicDnsServerOptions, options?: MagicDnsServerOptions) {
        const opts: MagicDnsServerOptions = registryOrOptions instanceof MagicDnsRegistry
            ? { ...options, registry: registryOrOptions }
            : (registryOrOptions ?? {});

        const envPort = process.env.DNS_PORT || process.env.MAGIC_DNS_PORT;
        this.port = opts.port ?? (envPort ? parseInt(envPort, 10) : 53);
        this.host = opts.host ?? (process.env.DNS_HOST || process.env.MAGIC_DNS_HOST || '0.0.0.0');
        this.ttl = opts.ttl ?? 300;
        this.registry = opts.registry ?? magicDnsRegistry;

        const upstreamEnv = process.env.UPSTREAM_DNS;
        if (opts.upstreamDns !== undefined) {
            this.upstreamDns = opts.upstreamDns || undefined;
        } else if (upstreamEnv && upstreamEnv.toLowerCase() !== 'false' && upstreamEnv.toLowerCase() !== 'none') {
            this.upstreamDns = upstreamEnv;
        } else if (upstreamEnv === undefined) {
            this.upstreamDns = '1.1.1.1:53';
        }

        this.enableTcp = opts.enableTcp ?? true;
    }

    public async start(port?: number, host?: string): Promise<void> {
        if (port !== undefined) this.port = port;
        if (host !== undefined) this.host = host;

        if (this.sockets.length > 0 || this.tcpServers.length > 0) {
            return;
        }

        const tryBindSingle = async (targetHost: string, targetPort: number): Promise<{ udp: dgram.Socket; tcp: net.Server | undefined }> => {
            const udpSocket = await new Promise<dgram.Socket>((resolve, reject) => {
                const socket = dgram.createSocket('udp4');
                socket.once('error', (err) => {
                    try { socket.close(); } catch {}
                    reject(err);
                });
                socket.on('message', (msg, rinfo) => {
                    this.handleMessage(socket, msg, rinfo);
                });
                socket.bind(targetPort, targetHost, () => {
                    resolve(socket);
                });
            });

            let tcpServer: net.Server | undefined;
            if (this.enableTcp) {
                try {
                    tcpServer = await new Promise<net.Server>((resolve, reject) => {
                        const server = net.createServer((conn) => {
                            this.handleTcpConnection(conn);
                        });
                        server.once('error', (err) => {
                            try { server.close(); } catch {}
                            reject(err);
                        });
                        server.listen(targetPort, targetHost, () => {
                            resolve(server);
                        });
                    });
                } catch (tcpErr) {
                    try { udpSocket.close(); } catch {}
                    throw tcpErr;
                }
            }

            return { udp: udpSocket, tcp: tcpServer };
        };

        // If a specific non-wildcard host was configured, bind only to that host
        if (this.host !== '0.0.0.0') {
            try {
                const bound = await tryBindSingle(this.host, this.port);
                this.sockets.push(bound.udp);
                if (bound.tcp) this.tcpServers.push(bound.tcp);
                console.log(`[MagicDNS] Server listening on ${this.host}:${this.port} (UDP${bound.tcp ? '/TCP' : ''})`);
                return;
            } catch (err: any) {
                if ((err.code === 'EACCES' || err.code === 'EADDRINUSE') && this.port === 53) {
                    console.warn(`[MagicDNS] Could not bind ${this.host}:53 (${err.code}). Falling back to port 5300.`);
                    this.port = 5300;
                    const fallbackBound = await tryBindSingle(this.host, this.port);
                    this.sockets.push(fallbackBound.udp);
                    if (fallbackBound.tcp) this.tcpServers.push(fallbackBound.tcp);
                    console.log(`[MagicDNS] Server listening on ${this.host}:${this.port} (UDP${fallbackBound.tcp ? '/TCP' : ''})`);
                    return;
                }
                throw err;
            }
        }

        // Try binding 0.0.0.0 first
        try {
            const bound = await tryBindSingle('0.0.0.0', this.port);
            this.sockets.push(bound.udp);
            if (bound.tcp) this.tcpServers.push(bound.tcp);
            console.log(`[MagicDNS] Server listening on 0.0.0.0:${this.port} (UDP${bound.tcp ? '/TCP' : ''})`);
            return;
        } catch (err: any) {
            if (err.code === 'EADDRINUSE' && this.port === 53) {
                // systemd-resolved or another stub resolver is bound to 127.0.0.53:53.
                // Bind to individual active network interfaces instead.
                const boundIps = await this.bindAllActiveInterfaces(this.port);
                if (boundIps.length > 0) {
                    console.log(`[MagicDNS] Server listening on port ${this.port} (${boundIps.join(', ')})`);
                    return;
                }
            }

            if ((err.code === 'EACCES' || err.code === 'EADDRINUSE') && this.port === 53) {
                console.warn(`[MagicDNS] Could not bind port 53 (${err.code}). Falling back to port 5300.`);
                this.port = 5300;
                const fallbackBound = await tryBindSingle('0.0.0.0', this.port);
                this.sockets.push(fallbackBound.udp);
                if (fallbackBound.tcp) this.tcpServers.push(fallbackBound.tcp);
                console.log(`[MagicDNS] Server listening on 0.0.0.0:${this.port} (UDP${fallbackBound.tcp ? '/TCP' : ''})`);
                return;
            }

            throw err;
        }
    }

    private async bindAllActiveInterfaces(port: number): Promise<string[]> {
        const interfaces = os.networkInterfaces();
        const boundIps: string[] = [];

        for (const name of Object.keys(interfaces)) {
            for (const netInfo of interfaces[name] || []) {
                if (netInfo.family === 'IPv4' || (netInfo as any).family === 4) {
                    // Skip stub resolver addresses in 127.0.0.50-127.0.0.55
                    if (netInfo.address.startsWith('127.0.0.5')) continue;

                    try {
                        const socket = dgram.createSocket('udp4');
                        await new Promise<void>((resolve, reject) => {
                            socket.once('error', (err) => {
                                try { socket.close(); } catch {}
                                reject(err);
                            });
                            socket.on('message', (msg, rinfo) => {
                                this.handleMessage(socket, msg, rinfo);
                            });
                            socket.bind(port, netInfo.address, () => {
                                resolve();
                            });
                        });
                        this.sockets.push(socket);

                        if (this.enableTcp) {
                            try {
                                const server = net.createServer((conn) => {
                                    this.handleTcpConnection(conn);
                                });
                                server.once('error', () => {
                                    try { server.close(); } catch {}
                                });
                                await new Promise<void>((resolve, reject) => {
                                    server.once('error', reject);
                                    server.listen(port, netInfo.address, () => {
                                        resolve();
                                    });
                                });
                                this.tcpServers.push(server);
                            } catch {}
                        }

                        boundIps.push(netInfo.address);
                    } catch (e) {
                        // Skip interfaces that fail to bind
                    }
                }
            }
        }

        return boundIps;
    }

    public stop(): Promise<void> {
        return new Promise((resolve) => {
            for (const socket of this.sockets) {
                try {
                    socket.close();
                } catch {}
            }
            this.sockets = [];

            for (const server of this.tcpServers) {
                try {
                    server.close();
                } catch {}
            }
            this.tcpServers = [];

            console.log('[MagicDNS] Server stopped');
            resolve();
        });
    }

    public getPort(): number {
        return this.port;
    }

    public async processQuery(msg: Buffer): Promise<Buffer | null> {
        try {
            const query = dnsPacket.decode(msg);
            if (query.type !== 'query') {
                return null;
            }

            if (!query.questions || query.questions.length === 0) {
                const flags = dnsPacket.AUTHORITATIVE_ANSWER | ((query.flags || 0) & dnsPacket.RECURSION_DESIRED) | 3;
                return dnsPacket.encode({
                    type: 'response',
                    id: query.id,
                    flags,
                    questions: [],
                    answers: []
                });
            }

            // Check if query is targeting local NetLink domains or overlay IPs
            let isLocal = false;
            for (const question of query.questions) {
                const rawName = (question.name || '').toLowerCase();
                const normalizedName = rawName.endsWith('.') ? rawName.slice(0, -1) : rawName;

                if (normalizedName.endsWith('.netlink') || this.registry.resolve(normalizedName) || this.registry.resolve(`${normalizedName}.netlink`)) {
                    isLocal = true;
                    break;
                }

                if (question.type === 'PTR') {
                    const arpaMatch = normalizedName.match(/^([0-9]+)\.([0-9]+)\.([0-9]+)\.([0-9]+)\.in-addr\.arpa$/);
                    if (arpaMatch) {
                        const ip = `${arpaMatch[4]}.${arpaMatch[3]}.${arpaMatch[2]}.${arpaMatch[1]}`;
                        if (this.registry.resolveReverse(ip)) {
                            isLocal = true;
                            break;
                        }
                    }
                }
            }

            // Forward to upstream DNS server if not local
            if (!isLocal && this.upstreamDns) {
                const upstreamResponse = await this.forwardToUpstream(msg);
                if (upstreamResponse) {
                    return upstreamResponse;
                }
            }

            // Resolve locally
            const answers: dnsPacket.Answer[] = [];
            let rcode = 0;

            for (const question of query.questions) {
                const rawName = question.name.toLowerCase();
                const normalizedName = rawName.endsWith('.') ? rawName.slice(0, -1) : rawName;

                if (question.type === 'A') {
                    let ip = this.registry.resolve(normalizedName);
                    if (!ip && !normalizedName.endsWith('.netlink')) {
                        ip = this.registry.resolve(`${normalizedName}.netlink`);
                    }
                    if (ip) {
                        answers.push({
                            type: 'A',
                            name: question.name,
                            class: 'IN',
                            ttl: this.ttl,
                            data: ip
                        });
                    } else {
                        rcode = 3;
                    }
                } else if (question.type === 'PTR') {
                    const arpaMatch = normalizedName.match(/^([0-9]+)\.([0-9]+)\.([0-9]+)\.([0-9]+)\.in-addr\.arpa$/);
                    if (arpaMatch) {
                        const ip = `${arpaMatch[4]}.${arpaMatch[3]}.${arpaMatch[2]}.${arpaMatch[1]}`;
                        const domain = this.registry.resolveReverse(ip);
                        if (domain) {
                            answers.push({
                                type: 'PTR',
                                name: question.name,
                                class: 'IN',
                                ttl: this.ttl,
                                data: domain.endsWith('.') ? domain : `${domain}.`
                            });
                        } else {
                            rcode = 3;
                        }
                    } else {
                        rcode = 3;
                    }
                } else {
                    // Non-A query (e.g. AAAA, TXT, SRV, HTTPS)
                    let exists = Boolean(this.registry.resolve(normalizedName));
                    if (!exists && !normalizedName.endsWith('.netlink')) {
                        exists = Boolean(this.registry.resolve(`${normalizedName}.netlink`));
                    }
                    if (!exists) {
                        rcode = 3;
                    }
                }
            }

            if (answers.length > 0) {
                rcode = 0;
            }

            const flags = dnsPacket.AUTHORITATIVE_ANSWER | ((query.flags || 0) & dnsPacket.RECURSION_DESIRED) | rcode;

            return dnsPacket.encode({
                type: 'response',
                id: query.id,
                flags,
                questions: query.questions,
                answers: rcode === 0 ? answers : []
            });
        } catch (err) {
            console.error('[MagicDNS] Failed to process DNS query:', err);
            return null;
        }
    }

    private async forwardToUpstream(queryBuffer: Buffer): Promise<Buffer | null> {
        if (!this.upstreamDns) return null;
        const parts = this.upstreamDns.split(':');
        const upstreamHost = parts[0] || '1.1.1.1';
        const upstreamPort = parts[1] ? parseInt(parts[1], 10) : 53;

        return new Promise((resolve) => {
            const client = dgram.createSocket('udp4');
            let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
                timeoutId = null;
                try { client.close(); } catch {}
                resolve(null);
            }, 2500);

            client.once('error', () => {
                if (timeoutId) clearTimeout(timeoutId);
                try { client.close(); } catch {}
                resolve(null);
            });

            client.once('message', (response) => {
                if (timeoutId) clearTimeout(timeoutId);
                try { client.close(); } catch {}
                resolve(response);
            });

            client.send(queryBuffer, upstreamPort, upstreamHost, (err) => {
                if (err) {
                    if (timeoutId) clearTimeout(timeoutId);
                    try { client.close(); } catch {}
                    resolve(null);
                }
            });
        });
    }

    public async handleMessage(socket: dgram.Socket, msg: Buffer, rinfo: dgram.RemoteInfo): Promise<void> {
        const response = await this.processQuery(msg);
        if (response) {
            socket.send(response, rinfo.port, rinfo.address, (err) => {
                if (err) {
                    console.error(`[MagicDNS] Failed to send response to ${rinfo.address}:${rinfo.port}`, err);
                }
            });
        }
    }

    public handleTcpConnection(conn: net.Socket): void {
        let buffer = Buffer.alloc(0);

        conn.on('data', async (chunk) => {
            const chunkBuf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            buffer = Buffer.concat([buffer, chunkBuf]);

            while (buffer.length >= 2) {
                const messageLength = buffer.readUInt16BE(0);
                if (buffer.length < 2 + messageLength) {
                    break;
                }

                const queryMsg = buffer.subarray(2, 2 + messageLength);
                buffer = buffer.subarray(2 + messageLength);

                const responseMsg = await this.processQuery(queryMsg);
                if (responseMsg && !conn.destroyed) {
                    const lenBuf = Buffer.alloc(2);
                    lenBuf.writeUInt16BE(responseMsg.length, 0);
                    conn.write(Buffer.concat([lenBuf, responseMsg]));
                }
            }
        });

        conn.on('error', () => {
            try { conn.destroy(); } catch {}
        });
    }
}
