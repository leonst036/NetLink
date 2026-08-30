import type { MagicDnsRegistry } from './MagicDnsRegistry.js';

export interface DnsRecord {
    domain: string;
    ip: string;
    ttl?: number;
    deviceId?: string;
    createdAt?: number;
}

export interface QueryContext {
    name: string;
    type: string;
    id?: number;
    clientIp: string;
    clientPort: number;
}

export interface MagicDnsServerOptions {
    port?: number;
    host?: string;
    registry?: MagicDnsRegistry;
    ttl?: number;
}

export interface DnsUpdateMessage {
    type: 'DNS_UPDATE';
    action: 'ADD' | 'REMOVE';
    domain?: string;
    ip?: string;
    deviceId?: string;
}

export interface DnsConfig {
    enabled: boolean;
    server: string;
    port: number;
    suffix: string;
    records?: Record<string, string>;
}
