import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getRelayRootDir(): string {
    if (__dirname.includes('dist')) {
        const parts = __dirname.split('dist');
        return path.resolve(parts[0] || __dirname);
    }
    return path.resolve(__dirname);
}

export const RELAY_APPS_DIR = path.join(getRelayRootDir(), 'NetStore', 'Applications');

export function resolveLocalNetStorePath(...subPaths: string[]): string {
    const relayRoot = getRelayRootDir();
    const baseRoots = [
        path.resolve(relayRoot, '../../NetLink-NetStore'),
        path.resolve(process.cwd(), '../../NetLink-NetStore'),
        path.resolve(process.cwd(), '../NetLink-NetStore'),
        path.resolve(relayRoot, '../../../NetLink-NetStore'),
        path.resolve('/home/leon/dev/NetLink/NetLink-NetStore')
    ];

    for (const baseRoot of baseRoots) {
        if (fs.existsSync(baseRoot)) {
            const resolved = path.resolve(baseRoot, ...subPaths);
            if (resolved === baseRoot || resolved.startsWith(baseRoot + path.sep)) {
                if (fs.existsSync(resolved)) {
                    return resolved;
                }
            }
        }
    }
    return '';
}
