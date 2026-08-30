import dgram from 'node:dgram';
import os from 'node:os';
import dnsPacket from 'dns-packet';
import { MagicDnsRegistry, magicDnsRegistry } from './MagicDnsRegistry.js';
import type { MagicDnsServerOptions } from './types.js';

export type { MagicDnsServerOptions };

export class MagicDnsServer {
    private sockets: dgram.Socket[] = [];
    private port: number;
    private host: string;
    private ttl: number;
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
    }

    public async start(port?: number, host?: string): Promise<void> {
        if (port !== undefined) this.port = port;
        if (host !== undefined) this.host = host;

        if (this.sockets.length > 0) {
            return;
        }

        const tryBindSingle = (targetHost: string, targetPort: number): Promise<dgram.Socket> => {
            return new Promise((resolve, reject) => {
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
        };

        // If a specific non-wildcard host was configured, bind only to that host
        if (this.host !== '0.0.0.0') {
            try {
                const socket = await tryBindSingle(this.host, this.port);
                this.sockets.push(socket);
                console.log(`[MagicDNS] Server listening on ${this.host}:${this.port}`);
                return;
            } catch (err: any) {
                if (err.code === 'EACCES' && this.port === 53) {
                    console.warn('[MagicDNS] Permission denied (EACCES) on port 53. Run "npm run allow-dns-port" or setcap. Falling back to port 5300.');
                    this.port = 5300;
                    const fallbackSocket = await tryBindSingle(this.host, this.port);
                    this.sockets.push(fallbackSocket);
                    console.log(`[MagicDNS] Server listening on ${this.host}:${this.port}`);
                    return;
                }
                throw err;
            }
        }

        // Try binding 0.0.0.0 first
        try {
            const socket = await tryBindSingle('0.0.0.0', this.port);
            this.sockets.push(socket);
            console.log(`[MagicDNS] Server listening on 0.0.0.0:${this.port}`);
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

            if (err.code === 'EACCES' && this.port === 53) {
                console.warn('[MagicDNS] Permission denied (EACCES) on port 53. Run "npm run allow-dns-port" or setcap. Falling back to port 5300.');
                this.port = 5300;
                const fallbackSocket = await tryBindSingle('0.0.0.0', this.port);
                this.sockets.push(fallbackSocket);
                console.log(`[MagicDNS] Server listening on 0.0.0.0:${this.port}`);
                return;
            }

            throw err;
        }
    }

    private async bindAllActiveInterfaces(port: number): Promise<string[]> {
        const interfaces = os.networkInterfaces();
        const boundIps: string[] = [];

        for (const name of Object.keys(interfaces)) {
            for (const net of interfaces[name] || []) {
                if (net.family === 'IPv4' || (net as any).family === 4) {
                    // Skip stub resolver addresses in 127.0.0.50-127.0.0.55
                    if (net.address.startsWith('127.0.0.5')) continue;

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
                            socket.bind(port, net.address, () => {
                                resolve();
                            });
                        });
                        this.sockets.push(socket);
                        boundIps.push(net.address);
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
            if (this.sockets.length === 0) {
                return resolve();
            }

            for (const socket of this.sockets) {
                try {
                    socket.close();
                } catch {}
            }
            this.sockets = [];
            console.log('[MagicDNS] Server stopped');
            resolve();
        });
    }

    public handleMessage(socket: dgram.Socket, msg: Buffer, rinfo: dgram.RemoteInfo): void {
        try {
            const query = dnsPacket.decode(msg);
            const answers: dnsPacket.Answer[] = [];
            let rcode = 0;

            if (!query.questions || query.questions.length === 0) {
                rcode = 3;
            } else {
                for (const question of query.questions) {
                    const rawName = question.name.toLowerCase();
                    const normalizedName = rawName.endsWith('.') ? rawName.slice(0, -1) : rawName;

                    if (question.type === 'A' && normalizedName.endsWith('.netlink')) {
                        const ip = this.registry.resolve(normalizedName);
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
                    } else {
                        rcode = 3;
                    }
                }
            }

            const flags = dnsPacket.AUTHORITATIVE_ANSWER | ((query.flags || 0) & dnsPacket.RECURSION_DESIRED) | rcode;

            const response = dnsPacket.encode({
                type: 'response',
                id: query.id,
                flags,
                questions: query.questions,
                answers: rcode === 0 ? answers : []
            });

            socket.send(response, rinfo.port, rinfo.address, (err) => {
                if (err) {
                    console.error(`[MagicDNS] Failed to send response to ${rinfo.address}:${rinfo.port}`, err);
                }
            });
        } catch (err) {
            console.error('[MagicDNS] Failed to process DNS query:', err);
        }
    }
}
