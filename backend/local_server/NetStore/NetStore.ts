import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket } from 'ws';
import { denoSandbox } from '../sandbox/DenoSandbox.js';

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
    StartLocalApps();
}

// Start any local applications that have a local_server/index.ts
export async function StartLocalApps(): Promise<void> {
    const apps = ScanApplications();
    for (const app of apps) {
        if (!app.id) continue;
        const appDir = path.join(NET_STORE_DIR, app.id);
        const localServerDir = path.join(appDir, 'local_server');
        const entryTs = path.join(localServerDir, 'index.ts');
        const entryJs = path.join(localServerDir, 'index.js');
        const entryFile = fs.existsSync(entryTs) ? entryTs : (fs.existsSync(entryJs) ? entryJs : null);

        if (entryFile) {
            try {
                await denoSandbox.startApp(app.id, entryFile, appDir);
                console.log(`Started local Deno sandbox for app: ${app.id}`);
            } catch (err) {
                console.error(`Failed to start local Deno sandbox for app ${app.id}:`, err);
            }
        }
    }
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
export async function sendApplicationJson(ws: WebSocket): Promise<void> {
    let applications = ScanApplications();
    const relayBackends = getAppSyncFiles();
    
    try {
        const { getGitHubApplicationsList } = await import('./gitHubApplications.js');
        const githubApps = await getGitHubApplicationsList();
        
        const appMap = new Map();
        for (const app of githubApps) {
            appMap.set(app.id, { ...app, installed: false });
        }
        
        for (const app of applications) {
            // Local apps override github apps properties if they exist
            const existing = appMap.get(app.id) || {};
            appMap.set(app.id, { ...existing, ...app, installed: true });
        }
        
        applications = Array.from(appMap.values());
    } catch (err) {
        console.error('Failed to load GitHub applications:', err);
    }
    
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'applications', applications }));
        if (relayBackends.length > 0) {
            ws.send(JSON.stringify({ type: 'sync-app-backends', backends: relayBackends }));
        }
    }
}

export async function installApplication(appId: string): Promise<void> {
    console.log(`Starting installation of application: ${appId}`);
    try {
        const treeUrl = `https://api.github.com/repos/leonst036/NetLink/git/trees/NetStore?recursive=1`;
        const treeRes = await fetch(treeUrl);
        if (!treeRes.ok) throw new Error(`Failed to fetch GitHub tree: ${treeRes.statusText}`);
        
        const treeData = await treeRes.json();
        if (!treeData.tree || !Array.isArray(treeData.tree)) {
            throw new Error('Invalid tree data from GitHub');
        }

        const appPrefix = `applications/${appId}/`;
        const appFiles = treeData.tree.filter((node: any) => node.type === 'blob' && node.path.startsWith(appPrefix));
        
        if (appFiles.length === 0) {
            throw new Error(`Application ${appId} not found or has no files on GitHub branch`);
        }

        const appDir = path.join(NET_STORE_DIR, appId);
        if (!fs.existsSync(appDir)) {
            fs.mkdirSync(appDir, { recursive: true });
        }

        // Fetch each file
        for (const fileNode of appFiles) {
            const rawUrl = `https://raw.githubusercontent.com/leonst036/NetLink/refs/heads/NetStore/${fileNode.path}`;
            const relativePath = fileNode.path.substring(appPrefix.length);
            const localPath = path.join(appDir, relativePath);
            
            const fileDir = path.dirname(localPath);
            if (!fs.existsSync(fileDir)) {
                fs.mkdirSync(fileDir, { recursive: true });
            }

            console.log(`Downloading ${fileNode.path}...`);
            const fileRes = await fetch(rawUrl);
            if (!fileRes.ok) throw new Error(`Failed to fetch ${fileNode.path}`);
            
            const buffer = await fileRes.arrayBuffer();
            fs.writeFileSync(localPath, Buffer.from(buffer));
        }

        console.log(`Successfully installed application: ${appId}`);
        // Reload applications and notify relay or start sandboxes
        WriteApplicationJson();
        await StartLocalApps();
    } catch (err) {
        console.error(`Error during installation of ${appId}:`, err);
        throw err;
    }
}