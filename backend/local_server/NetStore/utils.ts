import fs from 'fs';
import path from 'path';

// Format bytes into human readable string
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Calculate total size of directory in bytes
export function calculateDirectorySize(dirPath: string): number {
    if (!fs.existsSync(dirPath)) return 0;
    let totalSize = 0;
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                totalSize += calculateDirectorySize(fullPath);
            } else if (entry.isFile()) {
                try {
                    const stat = fs.statSync(fullPath);
                    totalSize += stat.size;
                } catch { }
            }
        }
    } catch (e) {
        console.error(`Failed to calculate directory size for ${dirPath}:`, e);
    }
    return totalSize;
}

export function resolveLocalNetStorePath(baseDirOrSubPath: string, ...rest: string[]): string {
    const isDir = path.isAbsolute(baseDirOrSubPath);
    const baseDir = isDir ? baseDirOrSubPath : process.cwd();
    const subPaths = isDir ? rest : [baseDirOrSubPath, ...rest];
    const baseRoots = [
        path.resolve(baseDir, '../../../../NetLink-NetStore'),
        path.resolve(baseDir, '../../../../../NetLink-NetStore'),
        path.resolve(process.cwd(), '../NetLink-NetStore'),
        path.resolve(process.cwd(), '../../NetLink-NetStore'),
        path.resolve('/home/leon/dev/NetLink/NetLink-NetStore')
    ];
    for (const baseRoot of baseRoots) {
        if (fs.existsSync(baseRoot)) {
            const resolved = path.resolve(baseRoot, ...subPaths);
            if (resolved === baseRoot || resolved.startsWith(baseRoot + path.sep)) {
                if (fs.existsSync(resolved)) return resolved;
            }
        }
    }
    return '';
}
