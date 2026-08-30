export class MagicDnsRegistry {
    private records = new Map<string, string>();
    private deviceToDomain = new Map<string, string>();

    public registerNode(rawHostname: string, ip: string): string {
        const slug = rawHostname
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/^-+|-+$/g, '');

        const domain = `${slug}.netlink`;
        this.records.set(domain, ip);
        return domain;
    }

    public registerDevice(deviceId: string, deviceName: string, assignedIp: string): string {
        const existingDomain = this.deviceToDomain.get(deviceId);
        if (existingDomain) {
            this.records.delete(existingDomain);
        }

        const domain = this.registerNode(deviceName || deviceId, assignedIp);
        this.deviceToDomain.set(deviceId, domain);
        return domain;
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