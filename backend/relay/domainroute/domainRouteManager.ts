import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMongoClient } from '../database/MongoManager.js';
import type { DomainRouteConfig, DomainRouteRule } from './domainRouteTypes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_DOMAIN_ROUTE_CONFIG: DomainRouteConfig = {
    enabled: true,
    proxyPort: 1080,
    rules: [
        { id: 'rule-netflix-1', pattern: '*.netflix.com', enabled: true, description: 'Netflix Main' },
        { id: 'rule-netflix-2', pattern: '*.nflxvideo.net', enabled: true, description: 'Netflix Video CDN' },
        { id: 'rule-netflix-3', pattern: '*.nflximg.net', enabled: true, description: 'Netflix Images' },
        { id: 'rule-netflix-4', pattern: '*.nflxext.com', enabled: true, description: 'Netflix Assets' },
        { id: 'rule-netflix-5', pattern: '*.nflxso.net', enabled: true, description: 'Netflix Services' },
        { id: 'rule-ipify', pattern: '*.ipify.org', enabled: true, description: 'IPify Test' }
    ]
};

let currentConfig: DomainRouteConfig = { ...DEFAULT_DOMAIN_ROUTE_CONFIG };
let isLoaded = false;

// Resolve path to local fallback json file
export function getLocalConfigPath(): string {
    const candidates = [
        path.join(__dirname, '..', 'config', 'domainroute.json'),
        path.join(__dirname, '..', '..', 'config', 'domainroute.json'),
        path.join(process.cwd(), 'backend', 'relay', 'config', 'domainroute.json'),
        path.join(process.cwd(), 'config', 'domainroute.json')
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) {
            return c;
        }
    }
    return candidates[0]!;
}

// Save config to local fallback json file
export function saveToLocalFile(cfg: DomainRouteConfig): void {
    try {
        const filePath = getLocalConfigPath();
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2), 'utf-8');
    } catch (e) {
        console.error('[DomainRoute] Failed to save config to local file:', e);
    }
}

// Load config from MongoDB or local json file
export async function loadDomainRouteConfig(): Promise<DomainRouteConfig> {
    const client = getMongoClient();
    if (client) {
        try {
            const db = client.db('NetLink');
            const doc = await db.collection('domainroute_config').findOne({ _id: 'config' as any });
            if (doc) {
                currentConfig = {
                    enabled: typeof doc.enabled === 'boolean' ? doc.enabled : DEFAULT_DOMAIN_ROUTE_CONFIG.enabled,
                    proxyPort: typeof doc.proxyPort === 'number' ? doc.proxyPort : DEFAULT_DOMAIN_ROUTE_CONFIG.proxyPort,
                    rules: Array.isArray(doc.rules) ? doc.rules : DEFAULT_DOMAIN_ROUTE_CONFIG.rules
                };
                saveToLocalFile(currentConfig);
                isLoaded = true;
                return currentConfig;
            }
        } catch (e) {
            console.warn('[DomainRoute] Failed to load config from MongoDB, checking local file:', e);
        }
    }

    const filePath = getLocalConfigPath();
    if (fs.existsSync(filePath)) {
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            currentConfig = {
                enabled: typeof data.enabled === 'boolean' ? data.enabled : DEFAULT_DOMAIN_ROUTE_CONFIG.enabled,
                proxyPort: typeof data.proxyPort === 'number' ? data.proxyPort : DEFAULT_DOMAIN_ROUTE_CONFIG.proxyPort,
                rules: Array.isArray(data.rules) ? data.rules : DEFAULT_DOMAIN_ROUTE_CONFIG.rules
            };
            isLoaded = true;
            return currentConfig;
        } catch (e) {
            console.warn('[DomainRoute] Failed to parse local config file:', e);
        }
    }

    currentConfig = { ...DEFAULT_DOMAIN_ROUTE_CONFIG };
    saveToLocalFile(currentConfig);
    isLoaded = true;
    return currentConfig;
}

// Get current config synchronously with fallback
export function getDomainRouteConfig(): DomainRouteConfig {
    if (!isLoaded) {
        // Attempt quick sync load from local file
        const filePath = getLocalConfigPath();
        if (fs.existsSync(filePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                currentConfig = {
                    enabled: typeof data.enabled === 'boolean' ? data.enabled : DEFAULT_DOMAIN_ROUTE_CONFIG.enabled,
                    proxyPort: typeof data.proxyPort === 'number' ? data.proxyPort : DEFAULT_DOMAIN_ROUTE_CONFIG.proxyPort,
                    rules: Array.isArray(data.rules) ? data.rules : DEFAULT_DOMAIN_ROUTE_CONFIG.rules
                };
            } catch {}
        }
        isLoaded = true;
    }
    return currentConfig;
}

// Update and persist config
export async function updateDomainRouteConfig(newConfig: Partial<DomainRouteConfig>): Promise<DomainRouteConfig> {
    if (typeof newConfig.enabled === 'boolean') {
        currentConfig.enabled = newConfig.enabled;
    }
    if (typeof newConfig.proxyPort === 'number' && newConfig.proxyPort > 0 && newConfig.proxyPort <= 65535) {
        currentConfig.proxyPort = newConfig.proxyPort;
    }
    if (Array.isArray(newConfig.rules)) {
        currentConfig.rules = newConfig.rules.map(r => ({
            id: r.id || `rule-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            pattern: String(r.pattern || '').trim(),
            enabled: Boolean(r.enabled),
            ...(r.description ? { description: String(r.description) } : {})
        }));
    }

    saveToLocalFile(currentConfig);

    const client = getMongoClient();
    if (client) {
        try {
            const db = client.db('NetLink');
            await db.collection('domainroute_config').updateOne(
                { _id: 'config' as any },
                {
                    $set: {
                        enabled: currentConfig.enabled,
                        proxyPort: currentConfig.proxyPort,
                        rules: currentConfig.rules,
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );
        } catch (e) {
            console.warn('[DomainRoute] Failed to persist config to MongoDB:', e);
        }
    }

    return currentConfig;
}

// Test if domain matches pattern
export function matchDomainPattern(domain: string, pattern: string): boolean {
    if (!domain || !pattern) return false;
    const cleanDomain = domain.toLowerCase().trim();
    const cleanPattern = pattern.toLowerCase().trim();

    // Regex pattern: /regex/flags
    if (cleanPattern.startsWith('/') && cleanPattern.lastIndexOf('/') > 0) {
        const lastSlash = cleanPattern.lastIndexOf('/');
        const regexBody = cleanPattern.substring(1, lastSlash);
        const regexFlags = cleanPattern.substring(lastSlash + 1);
        try {
            const regex = new RegExp(regexBody, regexFlags);
            return regex.test(cleanDomain);
        } catch {
            return false;
        }
    }

    // Exact match
    if (cleanDomain === cleanPattern) {
        return true;
    }

    // Wildcard prefix like *.example.com
    if (cleanPattern.startsWith('*.')) {
        const base = cleanPattern.slice(2);
        if (cleanDomain === base || cleanDomain.endsWith('.' + base)) {
            return true;
        }
    } else if (cleanPattern.includes('*')) {
        const escaped = cleanPattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');
        const regex = new RegExp(`^${escaped}$`, 'i');
        return regex.test(cleanDomain);
    }

    return false;
}

// Check if domain matches any active rule
export function isDomainRouted(domain: string): boolean {
    const config = getDomainRouteConfig();
    if (!config.enabled) return false;

    for (const rule of config.rules) {
        if (rule.enabled && matchDomainPattern(domain, rule.pattern)) {
            return true;
        }
    }
    return false;
}
