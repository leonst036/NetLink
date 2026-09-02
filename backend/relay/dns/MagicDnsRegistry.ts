export class MagicDnsRegistry {
    private records = new Map<string, string>();
    private deviceToDomain = new Map<string, string>();

    public registerNode(rawHostname: string, ip: string): string {
        const slug = (rawHostname || '')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/^-+|-+$/g, '');

        if (!slug) return '';

        const domain = `${slug}.netlink`;
        const cleanIp = (ip || '').replace(/^::ffff:/, '');
        this.records.set(domain, cleanIp);
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
        this.records.delete(domain);
        for (const [devId, dom] of this.deviceToDomain.entries()) {
            if (dom === domain) {
                this.deviceToDomain.delete(devId);
                break;
            }
        }
    }

    public unregisterDevice(deviceId: string): string | undefined {
        const domain = this.deviceToDomain.get(deviceId);
        if (domain) {
            this.records.delete(domain);
            this.deviceToDomain.delete(deviceId);
            return domain;
        }
        return undefined;
    }

    public resolve(domain: string): string | undefined {
        return this.records.get(domain.toLowerCase());
    }

    public getDomainForDevice(deviceId: string): string | undefined {
        return this.deviceToDomain.get(deviceId);
    }

    public getAllRecords(): Record<string, string> {
        return Object.fromEntries(this.records);
    }
}

export const magicDnsRegistry = new MagicDnsRegistry();