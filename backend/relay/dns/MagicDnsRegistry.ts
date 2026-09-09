export class MagicDnsRegistry {
    private records = new Map<string, string>();
    private deviceToDomains = new Map<string, Set<string>>();
    private ipToDomain = new Map<string, string>();

    public registerNode(rawHostname: string, ip: string): string {
        const stripped = (rawHostname || '').replace(/\.netlink\.?$/i, '');
        const slug = stripped
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/^-+|-+$/g, '');

        if (!slug) return '';

        const domain = `${slug}.netlink`;
        const cleanIp = (ip || '').replace(/^::ffff:/, '');

        // Clean up old IP reverse mapping if this domain had a different IP previously
        const oldIp = this.records.get(domain);
        if (oldIp && oldIp !== cleanIp && this.ipToDomain.get(oldIp) === domain) {
            this.ipToDomain.delete(oldIp);
        }

        this.records.set(domain, cleanIp);
        this.ipToDomain.set(cleanIp, domain);
        return domain;
    }

    public registerDevice(deviceId: string, deviceName: string, assignedIp: string): string {
        const domains = this.registerDeviceAliases(deviceId, assignedIp, [deviceName || deviceId]);
        return domains[0] || '';
    }

    public registerDeviceAliases(deviceId: string, ip: string, names: (string | undefined | null)[]): string[] {
        const existingDomains = this.deviceToDomains.get(deviceId);
        const registered: string[] = [];

        for (const name of names) {
            if (name && typeof name === 'string' && name.trim()) {
                const domain = this.registerNode(name.trim(), ip);
                if (domain && !registered.includes(domain)) {
                    registered.push(domain);
                }
            }
        }

        // Remove any old domains for this device that are no longer in aliases
        if (existingDomains) {
            for (const oldDomain of existingDomains) {
                if (!registered.includes(oldDomain)) {
                    this.unregisterNode(oldDomain);
                }
            }
        }

        if (deviceId && registered.length > 0) {
            this.deviceToDomains.set(deviceId, new Set(registered));
        }
        return registered;
    }

    public unregisterNode(domain: string): void {
        const cleanDomain = domain.toLowerCase().replace(/\.$/, '');
        const ip = this.records.get(cleanDomain);
        this.records.delete(cleanDomain);

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

    public unregisterDevice(deviceId: string): string | undefined {
        const domains = this.deviceToDomains.get(deviceId);
        if (domains && domains.size > 0) {
            const first = Array.from(domains)[0];
            for (const domain of domains) {
                this.unregisterNode(domain);
            }
            this.deviceToDomains.delete(deviceId);
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