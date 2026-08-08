import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NET_STORE_DIR = __dirname.includes('dist') 
    ? path.join(__dirname, '..', '..', 'NetStore', 'Applications') 
    : path.join(__dirname, 'Applications');

// Create directory and index.json if missing
export function InitNetStore(): void {
    if (!fs.existsSync(NET_STORE_DIR)) {
        fs.mkdirSync(NET_STORE_DIR, { recursive: true });
    }
    const indexPath = path.join(NET_STORE_DIR, 'index.json');
    if (!fs.existsSync(indexPath)) {
        fs.writeFileSync(indexPath, JSON.stringify([]));
    }
    WriteApplicationJson();
}

// Scan application subdirectories for index.json
export function ScanApplications(): any[] {
    if (!fs.existsSync(NET_STORE_DIR)) {
        InitNetStore();
    }

    const entries = fs.readdirSync(NET_STORE_DIR);
    const applicationFolders = entries.filter((folder) => {
        const fullPath = path.join(NET_STORE_DIR, folder);
        return fs.statSync(fullPath).isDirectory();
    });

    const applicationJson: any[] = [];
    for (const application of applicationFolders) {
        const applicationPath = path.join(NET_STORE_DIR, application);
        const indexPath = path.join(applicationPath, 'index.json');
        if (fs.existsSync(indexPath)) {
            try {
                const indexData = fs.readFileSync(indexPath, 'utf-8');
                applicationJson.push(JSON.parse(indexData));
            } catch (err) {
                console.error(`Failed to parse ${indexPath}:`, err);
            }
        }
    }
    return applicationJson;
}

// Write scanned applications to index.json
export function WriteApplicationJson(): void {
    const indexPath = path.join(NET_STORE_DIR, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(ScanApplications(), null, 2));
}

// Get all necessary files (relay, frontend) for syncing to Relay server
export function getAppSyncFiles(): any[] {
    if (!fs.existsSync(NET_STORE_DIR)) return [];

    const entries = fs.readdirSync(NET_STORE_DIR);
    const applicationFolders = entries.filter((folder) => {
        const fullPath = path.join(NET_STORE_DIR, folder);
        return fs.statSync(fullPath).isDirectory();
    });

    const relaySyncData: any[] = [];
    
    for (const application of applicationFolders) {
        const appDirPath = path.join(NET_STORE_DIR, application);
        const filesData: any[] = [];
        
        const walkSync = (dir: string, filelist: string[] = []) => {
            if (!fs.existsSync(dir)) return filelist;
            fs.readdirSync(dir).forEach(file => {
                const filePath = path.join(dir, file);
                if (fs.statSync(filePath).isDirectory()) {
                    filelist = walkSync(filePath, filelist);
                } else {
                    filelist.push(filePath);
                }
            });
            return filelist;
        };

        const relayFiles = walkSync(path.join(appDirPath, 'relay'));
        const frontendFiles = walkSync(path.join(appDirPath, 'frontend'));
        const allFiles = [...relayFiles, ...frontendFiles];

        for (const file of allFiles) {
            const relativePath = path.relative(appDirPath, file).replace(/\\/g, '/');
            try {
                const content = fs.readFileSync(file, 'base64'); // Use base64 to avoid corrupting binary assets
                filesData.push({ path: relativePath, content });
            } catch (e) {
                console.error(`Failed to read file ${file}:`, e);
            }
        }

        if (filesData.length > 0) {
            relaySyncData.push({
                appId: application,
                files: filesData
            });
        }
    }
    return relaySyncData;
}

// Send application JSON over WebSocket to relay server
export function sendApplicationJson(ws: WebSocket): void {
    const applications = ScanApplications();
    const relayBackends = getAppSyncFiles();
    
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'applications', applications }));
        if (relayBackends.length > 0) {
            ws.send(JSON.stringify({ type: 'sync-app-backends', backends: relayBackends }));
        }
    }
}