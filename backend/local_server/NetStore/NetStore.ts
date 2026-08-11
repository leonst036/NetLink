import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket } from 'ws';
import { denoSandbox } from '../sandbox/DenoSandbox.js';
import { getGitHubHeaders } from './gitHubApplications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NET_STORE_DIR = __dirname.includes('dist') 
    ? path.join(__dirname, '..', '..', 'NetStore', 'Applications') 
    : path.join(__dirname, 'Applications');
    
const PERMISSIONS_FILE = path.join(NET_STORE_DIR, 'permissions.json');

function getGrantedPermissions(): Record<string, any> {
    if (!fs.existsSync(PERMISSIONS_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

function getAppGranted(grantedRecord: Record<string, any>, appId: string) {
    const raw = grantedRecord[appId];
    if (!raw) return { folders: [], allowRun: false, allowEnv: [], allowNet: false };
    if (Array.isArray(raw)) {
        return { folders: raw, allowRun: false, allowEnv: [], allowNet: false };
    }
    return {
        folders: Array.isArray(raw.folders) ? raw.folders : [],
        allowRun: Boolean(raw.allowRun),
        allowEnv: Array.isArray(raw.allowEnv) ? raw.allowEnv : [],
        allowNet: typeof raw.allowNet === 'boolean' ? raw.allowNet : Boolean(raw.allowNet)
    };
}

function saveGrantedPermissions(perms: Record<string, any>) {
    fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(perms, null, 2));
}

// Create directory if missing
export function InitNetStore(): void {
    if (!fs.existsSync(NET_STORE_DIR)) {
        fs.mkdirSync(NET_STORE_DIR, { recursive: true });
    }
    StartLocalApps();
}

// Start any local applications that have a local_server/index.ts
export async function StartLocalApps(targetUserId?: string, forceStart: boolean = false): Promise<void> {
    const apps = ScanApplications(targetUserId);
    for (const app of apps) {
        if (!app.id || !app.userId) continue;
        
        // Start apps if forceStart is true (user login) or if runInBackground is true (system boot)
        if (!forceStart && app.runInBackground !== true) continue;
        
        const appDir = path.join(NET_STORE_DIR, app.userId, app.id);
        const localServerDir = path.join(appDir, 'local_server');
        const entryTs = path.join(localServerDir, 'index.ts');
        const entryJs = path.join(localServerDir, 'index.js');
        const entryFile = fs.existsSync(entryTs) ? entryTs : (fs.existsSync(entryJs) ? entryJs : null);

        if (entryFile) {
            let requestedFolders: any[] = [];
            let requestedPerms: any = app.requestedPermissions || {};

            if (Array.isArray(app.requiredExternalFolders)) {
                requestedFolders = app.requiredExternalFolders;
            }

            const grantedAll = getGrantedPermissions();
            const appGranted = getAppGranted(grantedAll, app.id);

            const foldersGranted = requestedFolders.every(f => appGranted.folders.includes(f.path));
            const runGranted = !requestedPerms.allowRun || appGranted.allowRun;
            const envGranted = !requestedPerms.allowEnv || (
                Array.isArray(requestedPerms.allowEnv) && requestedPerms.allowEnv.every((v: string) => appGranted.allowEnv.includes(v))
            );

            if (!foldersGranted || !runGranted || !envGranted) {
                console.warn(`Local App ${app.id} requires permissions that are not granted. Waiting for admin approval...`);
                continue;
            }

            const extraFlags: string[] = [];
            if (appGranted.folders.length > 0 && requestedFolders.length > 0) {
                requestedFolders.forEach(f => {
                    if (appGranted.folders.includes(f.path)) {
                        if (f.mode === 'write') extraFlags.push(`--allow-write=${f.path}`);
                        extraFlags.push(`--allow-read=${f.path}`);
                    }
                });
            }

            if (requestedPerms.allowRun && appGranted.allowRun) {
                if (Array.isArray(requestedPerms.allowRunCommands) && requestedPerms.allowRunCommands.length > 0) {
                    extraFlags.push(`--allow-run=${requestedPerms.allowRunCommands.join(',')}`);
                } else {
                    extraFlags.push('--allow-run');
                }
            }

            if (Array.isArray(requestedPerms.allowEnv) && requestedPerms.allowEnv.length > 0 && appGranted.allowEnv) {
                const allowedEnvVars = requestedPerms.allowEnv.filter((v: string) => appGranted.allowEnv.includes(v));
                if (allowedEnvVars.length > 0) {
                    extraFlags.push(`--allow-env=PORT,${allowedEnvVars.join(',')}`);
                }
            }

            if (requestedPerms.allowNet && appGranted.allowNet) {
                if (Array.isArray(requestedPerms.allowNet) && requestedPerms.allowNet.length > 0) {
                    extraFlags.push(`--allow-net=${requestedPerms.allowNet.join(',')}`);
                }
            }

            try {
                const sandboxAppId = `${app.userId}_${app.id}`;
                await denoSandbox.startApp(sandboxAppId, entryFile, appDir, extraFlags);
                console.log(`Started local Deno sandbox for app: ${sandboxAppId}`);
            } catch (err) {
                console.error(`Failed to start local Deno sandbox for app ${app.id} (User: ${app.userId}):`, err);
            }
        }
    }
}

// Scan application subdirectories for index.json
export function ScanApplications(targetUserId?: string): any[] {
    if (!fs.existsSync(NET_STORE_DIR)) {
        InitNetStore();
    }

    const applicationJson: any[] = [];
    const userFolders = fs.readdirSync(NET_STORE_DIR).filter(f => fs.statSync(path.join(NET_STORE_DIR, f)).isDirectory());
    
    for (const userId of userFolders) {
        if (targetUserId && userId !== targetUserId) continue;
        
        const userDir = path.join(NET_STORE_DIR, userId);
        const entries = fs.readdirSync(userDir);
        const applicationFolders = entries.filter((folder) => {
            const fullPath = path.join(userDir, folder);
            return fs.statSync(fullPath).isDirectory();
        });

        for (const application of applicationFolders) {
            const applicationPath = path.join(userDir, application);
            const indexPath = path.join(applicationPath, 'index.json');
            if (fs.existsSync(indexPath)) {
                try {
                    const indexData = fs.readFileSync(indexPath, 'utf-8');
                    const parsed = JSON.parse(indexData);
                    applicationJson.push({ ...parsed, installed: true, userId });
                } catch (err) {
                    console.error(`Failed to parse ${indexPath}:`, err);
                }
            }
        }
    }
    return applicationJson;
}

// Kept for legacy compatibility if needed
export function WriteApplicationJson(): void {
    // No-op
}

// Get all necessary files (relay, frontend) for syncing to Relay server
export function getAppSyncFiles(targetUserId?: string): any[] {
    if (!fs.existsSync(NET_STORE_DIR)) return [];

    const relaySyncData: any[] = [];
    const userFolders = fs.readdirSync(NET_STORE_DIR).filter(f => fs.statSync(path.join(NET_STORE_DIR, f)).isDirectory());
    
    for (const userId of userFolders) {
        if (targetUserId && userId !== targetUserId) continue;
        
        const userDir = path.join(NET_STORE_DIR, userId);
        const entries = fs.readdirSync(userDir);
        const applicationFolders = entries.filter((folder) => {
            const fullPath = path.join(userDir, folder);
            return fs.statSync(fullPath).isDirectory();
        });

        for (const application of applicationFolders) {
            const appDirPath = path.join(userDir, application);
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
        
        // Also sync index.json to relay
        const indexJsonPath = path.join(appDirPath, 'index.json');
        if (fs.existsSync(indexJsonPath)) {
            allFiles.push(indexJsonPath);
        }

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
                userId: userId,
                files: filesData
            });
        }
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
        let githubApps = await getGitHubApplicationsList();
        
        // Merge local dev applications.json if available
        const localDevCatalog = path.resolve(__dirname, '../../../../../NetLink-NetStore/applications/applications.json');
        if (fs.existsSync(localDevCatalog)) {
            try {
                const localApps = JSON.parse(fs.readFileSync(localDevCatalog, 'utf-8'));
                const map = new Map();
                for (const app of githubApps) map.set(app.id, app);
                for (const app of localApps) {
                    if (!map.has(app.id)) {
                        map.set(app.id, app);
                    }
                }
                githubApps = Array.from(map.values());
            } catch {}
        }

        const appMap = new Map();
        // Since github apps are not user-specific, we keep them generic until installed
        for (const app of githubApps) {
            appMap.set(app.id, { ...app, installed: false });
        }
        
        for (const app of applications) {
            // Local apps override github apps properties if they exist
            // Using a unique key per user installation so one user can have it installed and another doesn't
            const key = `${app.userId}_${app.id}`;
            const existing = appMap.get(app.id) || {};
            appMap.set(key, { ...existing, ...app, installed: true });
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

export async function installApplication(appId: string, branch: string = 'NetStore', githubToken?: string, userId?: string, runInBackground: boolean = false) {
    if (!userId) {
        throw new Error('userId is required to install an application');
    }
    try {
        console.log(`Starting installation of application ${appId} from branch ${branch} for user ${userId}...`);

        const sandboxAppId = `${userId}_${appId}`;
        denoSandbox.stopApp(sandboxAppId);

        // Check if application exists in local dev workspace
        const localDevAppDir = path.resolve(__dirname, '../../../../../NetLink-NetStore/applications', appId);
        const appDir = path.join(NET_STORE_DIR, userId, appId);

        // Wipe destination appDir if it exists to clean out stale files
        if (fs.existsSync(appDir)) {
            fs.rmSync(appDir, { recursive: true, force: true });
        }
        fs.mkdirSync(appDir, { recursive: true });

        if (fs.existsSync(localDevAppDir)) {
            console.log(`Installing ${appId} from local workspace (${localDevAppDir})...`);
            fs.cpSync(localDevAppDir, appDir, { recursive: true });
            await StartLocalApps();
            console.log(`Successfully installed local application: ${appId}`);
            return;
        }

        const headers = getGitHubHeaders(githubToken);
        const treeUrl = `https://api.github.com/repos/leonst036/NetLink/git/trees/${branch}?recursive=1`;
        const treeRes = await fetch(treeUrl, { headers });
        if (!treeRes.ok) {
            const errText = await treeRes.text().catch(() => '');
            throw new Error(`Failed to fetch GitHub tree (${treeRes.status} ${treeRes.statusText}): ${errText.substring(0, 100)}`);
        }
        
        const treeData = await treeRes.json();
        if (!treeData.tree || !Array.isArray(treeData.tree)) {
            throw new Error('Invalid tree data from GitHub');
        }

        const appPrefix = `applications/${appId}/`;
        const appFiles = treeData.tree.filter((node: any) => node.type === 'blob' && node.path.startsWith(appPrefix));
        
        if (appFiles.length === 0) {
            throw new Error(`Application ${appId} not found or has no files on GitHub branch ${branch}`);
        }

        // Fetch each file
        for (const fileNode of appFiles) {
            const rawUrl = `https://raw.githubusercontent.com/leonst036/NetLink/refs/heads/${branch}/${fileNode.path}`;
            const relativePath = fileNode.path.substring(appPrefix.length);
            const localPath = path.join(appDir, relativePath);
            
            const fileDir = path.dirname(localPath);
            if (!fs.existsSync(fileDir)) {
                fs.mkdirSync(fileDir, { recursive: true });
            }

            console.log(`Downloading ${fileNode.path}...`);
            const fileRes = await fetch(rawUrl, { headers });
            if (!fileRes.ok) throw new Error(`Failed to fetch ${fileNode.path}`);
            
            const buffer = await fileRes.arrayBuffer();
            fs.writeFileSync(localPath, Buffer.from(buffer));
        }

        console.log(`Successfully installed application: ${appId}`);

        // Update index.json with runInBackground flag
        const indexPath = path.join(appDir, 'index.json');
        if (fs.existsSync(indexPath)) {
            try {
                const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
                indexData.runInBackground = runInBackground;
                fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
            } catch (err) {
                console.error(`Failed to update runInBackground for ${appId}:`, err);
            }
        }

        await StartLocalApps(userId, true);
    } catch (err) {
        console.error(`Error during installation of ${appId}:`, err);
        throw err;
    }
}

export async function uninstallApplication(appId: string, userId?: string) {
    if (!userId) {
        throw new Error('userId is required to uninstall an application');
    }
    try {
        console.log(`Starting uninstallation of application ${appId} for user ${userId}...`);

        const sandboxAppId = `${userId}_${appId}`;
        denoSandbox.stopApp(sandboxAppId);

        const appDir = path.join(NET_STORE_DIR, userId, appId);
        if (fs.existsSync(appDir)) {
            fs.rmSync(appDir, { recursive: true, force: true });
            console.log(`Removed directory for application ${appId}`);
        }

        console.log(`Successfully uninstalled application: ${appId}`);
    } catch (err) {
        console.error(`Error during uninstallation of ${appId}:`, err);
        throw err;
    }
}