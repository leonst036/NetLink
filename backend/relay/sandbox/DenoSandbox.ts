import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import fs from 'fs';

export interface AppProcess {
    appId: string;
    port: number;
    process: ChildProcess;
}

export class DenoSandbox {
    private activeApps: Map<string, AppProcess> = new Map();

    // Get an available port
    private async getAvailablePort(): Promise<number> {
        return new Promise((resolve, reject) => {
            const srv = net.createServer();
            srv.listen(0, () => {
                const port = (srv.address() as net.AddressInfo).port;
                srv.close((err) => {
                    if (err) reject(err);
                    else resolve(port);
                });
            });
            srv.on('error', reject);
        });
    }

    // Start a Deno app sandbox
    public async startApp(appId: string, entryFile: string, appDir: string, extraFlags: string[] = []): Promise<AppProcess> {
        // Stop if already running
        this.stopApp(appId);

        const port = await this.getAvailablePort();
        const denoCmd = fs.existsSync('/home/leon/.deno/bin/deno') ? '/home/leon/.deno/bin/deno' : 'deno';

        const args = [
            'run',
            '--no-config',
            '--allow-net',
            `--allow-read=${appDir}`,
            `--allow-write=${appDir}`,
            '--allow-env',
            ...extraFlags.filter(f => !f.startsWith('--allow-env') && !f.startsWith('--allow-net')),
            entryFile
        ];

        const cleanEnv: Record<string, string> = {
            PORT: port.toString(),
            HTTP_PORT: (process.env.HTTP_PORT || '4535').toString(),
            RELAY_PORT: (process.env.HTTP_PORT || '4535').toString(),
            RELAY_HOST: process.env.RELAY_HOST || '127.0.0.1',
            SCAN_CIDR: process.env.SCAN_CIDR || '',
            PATH: process.env.PATH || '',
            HOME: process.env.HOME || '',
            TMPDIR: process.env.TMPDIR || '/tmp'
        };

        // Spawn deno with restricted permissions
        const denoProcess = spawn(denoCmd, args, {
            env: cleanEnv
        });

        denoProcess.stdout.on('data', (data: any) => console.log(`[App ${appId}]: ${data}`));
        denoProcess.stderr.on('data', (data: any) => console.error(`[App ${appId} Error]: ${data}`));
        denoProcess.on('close', (code: any) => {
            console.log(`App ${appId} exited with code ${code}`);
            const currentApp = this.activeApps.get(appId);
            if (currentApp && currentApp.process === denoProcess) {
                this.activeApps.delete(appId);
            }
        });

        const appProcess: AppProcess = { appId, port, process: denoProcess };
        this.activeApps.set(appId, appProcess);
        
        return appProcess;
    }

    // Stop a running app
    public stopApp(appId: string): void {
        const app = this.activeApps.get(appId);
        if (app) {
            app.process.kill();
            this.activeApps.delete(appId);
            console.log(`Stopped app ${appId}`);
        }
    }

    // Get running app info
    public getApp(appId: string): AppProcess | undefined {
        return this.activeApps.get(appId);
    }
}

export const denoSandbox = new DenoSandbox();
