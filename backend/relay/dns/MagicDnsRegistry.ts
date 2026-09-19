import net from 'node:net';
import type * as mongoDB from 'mongodb';

export interface DnsRecordDoc {
    domain: string;
    ip: string;
    deviceId?: string;
    updatedAt: Date;
}

export class MagicDnsRegistry {
    private records = new Map<string, string>();
    private deviceToDomains = new Map<string, Set<string>>();
    private ipToDomain = new Map<string, string>();
    private mongoClient: mongoDB.MongoClient | null = null;

    public setMongoClient(client: mongoDB.MongoClient | null): void {
        this.mongoClient = client;
    }

    public async loadFromDatabase(client?: mongoDB.MongoClient | null): Promise<void> {
        const mongo = client || this.mongoClient;
        if (!mongo) return;
        this.mongoClient = mongo;

        try {
            const docs = await mongo.db("NetLink").collection<DnsRecordDoc>("dns_records").find({}).toArray();
            for (const doc of docs) {
                if (doc.domain && doc.ip) {
                    if (doc.deviceId) {
                        this.registerDeviceAliases(doc.deviceId, doc.ip, [doc.domain.replace(/\.netlink$/, '')], false);
                    } else {
                        this.registerNode(doc.domain.replace(/\.netlink$/, ''), doc.ip, false);
                    }
                }
            }
            console.log(`[MagicDNS] Loaded ${docs.length} DNS records from database.`);
        } catch (err: any) {
            console.error('[MagicDNS] Failed to load records from database:', err.message);
        }
    }

    private persistRecord(domain: string, ip: string, deviceId?: string): void {
        if (!this.mongoClient) return;
        this.mongoClient.db("NetLink").collection("dns_records").updateOne(
            { domain },
            { $set: { domain, ip, deviceId: deviceId || null, updatedAt: new Date() } },
            { upsert: true }
        ).catch(err => {
            console.warn(`[MagicDNS] Failed to persist record ${domain}:`, err.message);
        });
    }

    private removePersistedRecord(domain: string): void {
        if (!this.mongoClient) return;
        this.mongoClient.db("NetLink").collection("dns_records").deleteOne({ domain }).catch(err => {
            console.warn(`[MagicDNS] Failed to remove record ${domain}:`, err.message);
        });
    }

    private removePersistedDevice(deviceId: string): void {
        if (!this.mongoClient) return;
        this.mongoClient.db("NetLink").collection("dns_records").deleteMany({ deviceId }).catch(err => {
            console.warn(`[MagicDNS] Failed to remove device records for ${deviceId}:`, err.message);
        });
    }

    public registerNode(rawHostname: string, ip: string, persist: boolean = true): string {
        const stripped = (rawHostname || '').replace(/\.netlink\.?$/i, '');
        const slug = stripped
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/^-+|-+$/g, '');

        if (!slug) return '';

        const domain = `${slug}.netlink`;
        const cleanIp = (ip || '').replace(/^::ffff:/, '');
        if (!net.isIP(cleanIp)) return '';

        const oldIp = this.records.get(domain);
        if (oldIp && oldIp !== cleanIp && this.ipToDomain.get(oldIp) === domain) {
            this.ipToDomain.delete(oldIp);
        }

        this.records.set(domain, cleanIp);
        this.ipToDomain.set(cleanIp, domain);

        if (persist) {
            this.persistRecord(domain, cleanIp);
        }
        return domain;
    }

    public registerDevice(deviceId: string, deviceName: string, assignedIp: string, persist: boolean = true): string {
        const domains = this.registerDeviceAliases(deviceId, assignedIp, [deviceName || deviceId], persist);
        return domains[0] || '';
    }

    public registerDeviceAliases(deviceId: string, ip: string, names: (string | undefined | null)[], persist: boolean = true): string[] {
        const existingDomains = this.deviceToDomains.get(deviceId);
        const registered: string[] = [];

        for (const name of names) {
            if (name && typeof name === 'string' && name.trim()) {
                const domain = this.registerNode(name.trim(), ip, persist);
                if (domain && !registered.includes(domain)) {
                    registered.push(domain);
                    if (persist && deviceId) {
                        this.persistRecord(domain, ip, deviceId);
                    }
                }
            }
        }

        // Remove any old domains for this device that are no longer in aliases
        if (existingDomains) {
            for (const oldDomain of existingDomains) {
                if (!registered.includes(oldDomain)) {
                    this.unregisterNode(oldDomain, persist);
                }
            }
        }

        if (deviceId && registered.length > 0) {
            this.deviceToDomains.set(deviceId, new Set(registered));
        }
        return registered;
    }

    public unregisterNode(domain: string, persist: boolean = true): void {
        const cleanDomain = domain.toLowerCase().replace(/\.$/, '');
        const ip = this.records.get(cleanDomain);
        this.records.delete(cleanDomain);

        if (persist) {
            this.removePersistedRecord(cleanDomain);
        }

        if (ip && this.ipToDomain.get(ip) === cleanDomain) {
            this.ipToDomain.delete(ip);
            // Restore reverse lookup if another domain points to the same IP
            for (const [otherDom, otherIp] of this.records.entries()) {
                if (otherIp === ip) {
                    this.ipToDomain.set(ip, otherDom);
                    break;
                }
            }
        }

        for (const [devId, doms] of this.deviceToDomains.entries()) {
            doms.delete(cleanDomain);
            if (doms.size === 0) {
                this.deviceToDomains.delete(devId);
            }
        }
    }

    public unregisterDevice(deviceId: string, persist: boolean = true): string | undefined {
        const domains = this.deviceToDomains.get(deviceId);
        if (domains && domains.size > 0) {
            const first = Array.from(domains)[0];
            for (const domain of domains) {
                this.unregisterNode(domain, false);
            }
            this.deviceToDomains.delete(deviceId);
            if (persist) {
                this.removePersistedDevice(deviceId);
            }
            return first;
        }
        return undefined;
    }

    public cleanDockerRecords(): number {
        let removed = 0;
        for (const [domain, ip] of this.records.entries()) {
            if (domain === 'local-server.netlink') continue;
            // Detect docker container records
            const isDockerDomain = domain.includes('-coolify.netlink') || /^[0-9a-f]{12,64}\.netlink$/i.test(domain);
            const isDockerIp = ip.startsWith('10.0.1.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip);
            if (isDockerDomain || isDockerIp) {
                this.unregisterNode(domain);
                removed++;
            }
        }
        return removed;
    }

    public resolve(domain: string): string | undefined {
        const clean = domain.toLowerCase().replace(/\.$/, '');
        const direct = this.records.get(clean);
        if (direct) return direct;
        if (clean.endsWith('.netlik')) {
            const corrected = clean.slice(0, -7) + '.netlink';
            return this.records.get(corrected);
        }
        return undefined;
    }

    public resolveReverse(ip: string): string | undefined {
        const cleanIp = (ip || '').replace(/^::ffff:/, '');
        return this.ipToDomain.get(cleanIp);
    }

    public getDomainForDevice(deviceId: string): string | undefined {
        const domains = this.deviceToDomains.get(deviceId);
        if (domains && domains.size > 0) {
            return Array.from(domains)[0];
        }
        return undefined;
    }

    public getDomainsForDevice(deviceId: string): string[] {
        const domains = this.deviceToDomains.get(deviceId);
        return domains ? Array.from(domains) : [];
    }

    public getAllRecords(): Record<string, string> {
        return Object.fromEntries(this.records);
    }
}

export const magicDnsRegistry = new MagicDnsRegistry();