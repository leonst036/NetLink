export class MagicDnsRegistry {
    private records = new Map<string, string>();
    private deviceToDomain = new Map<string, string>();
    private ipToDomain = new Map<string, string>();

    public registerNode(rawHostname: string, ip: string): string {
        const slug = (rawHostname || '')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/^-+|-+$/g, '');

        if (!slug) return '';

        const domain = `${slug}.netlink`;
        const cleanIp = (ip || '').replace(/^::ffff:/, '');
        this.records.set(domain, cleanIp);
        this.ipToDomain.set(cleanIp, domain);
        return domain;
    }

    public registerDevice(deviceId: string, deviceName: string, assignedIp: string): string {
        const existingDomain = this.deviceToDomain.get(deviceId);
        if (existingDomain) {
            this.records.delete(existingDomain);
        }

        const domain = this.registerNode(deviceName || deviceId, assignedIp);
        if (domain) {
            this.deviceToDomain.set(deviceId, domain);
        }
        return domain;
    }

    public registerDeviceAliases(deviceId: string, ip: string, names: (string | undefined | null)[]): string[] {
        const registered: string[] = [];
        for (const name of names) {
            if (name && typeof name === 'string' && name.trim()) {
                const domain = this.registerNode(name.trim(), ip);
                if (domain && !registered.includes(domain)) {
                    registered.push(domain);
                }
            }
        }
        const first = registered[0];
        if (deviceId && first) {
            this.deviceToDomain.set(deviceId, first);
        }
        return registered;
    }

    public unregisterNode(domain: string): void {
        const cleanDomain = domain.toLowerCase();
        const ip = this.records.get(cleanDomain);
        this.records.delete(cleanDomain);
        if (ip && this.ipToDomain.get(ip) === cleanDomain) {
            this.ipToDomain.delete(ip);
        }
        for (const [devId, dom] of this.deviceToDomain.entries()) {
            if (dom === cleanDomain) {
                this.deviceToDomain.delete(devId);
                break;
            }
        }
    }

    public unregisterDevice(deviceId: string): string | undefined {
        const domain = this.deviceToDomain.get(deviceId);
        if (domain) {
            this.unregisterNode(domain);
            this.deviceToDomain.delete(deviceId);
            return domain;
        }
        return undefined;
    }

    public cleanDockerRecords(): number {
        let removed = 0;
        for (const [domain, ip] of this.records.entries()) {
            if (domain === 'local-server.netlink') continue;
            // Detect docker container records
            const isDockerDomain = domain.includes('-coolify.netlink') || /^[0-9a-f]{12}\.netlink$/i.test(domain);
            const isDockerIp = ip.startsWith('10.0.1.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip);
            if (isDockerDomain || isDockerIp) {
                this.unregisterNode(domain);
                removed++;
            }
        }
        return removed;
    }

    public resolve(domain: string): string | undefined {
        return this.records.get(domain.toLowerCase());
    }

    public resolveReverse(ip: string): string | undefined {
        const cleanIp = (ip || '').replace(/^::ffff:/, '');
        return this.ipToDomain.get(cleanIp);
    }

    public getDomainForDevice(deviceId: string): string | undefined {
        return this.deviceToDomain.get(deviceId);
    }

    public getAllRecords(): Record<string, string> {
        return Object.fromEntries(this.records);
    }
}

export const magicDnsRegistry = new MagicDnsRegistry();