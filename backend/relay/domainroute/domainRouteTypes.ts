export interface DomainRouteRule {
    id: string;
    pattern: string;
    enabled: boolean;
    description?: string;
}

export interface DomainRouteConfig {
    enabled: boolean;
    proxyPort: number;
    rules: DomainRouteRule[];
}

export interface ActiveChannelInfo {
    channelId: number;
    domain: string;
    port: number;
    bytesIn: number;
    bytesOut: number;
    startTime: number;
    duration: number;
}

export interface DomainRouteStats {
    activeChannels: number;
    activeChannelCount: number;
    channels: ActiveChannelInfo[];
    bandwidthUp: number;
    bandwidthDown: number;
    bytesIn: number;
    bytesOut: number;
    connectedDomains: string[];
}
