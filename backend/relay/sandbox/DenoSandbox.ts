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
            '--allow-net', // Need net to run web server
            `--allow-read=${appDir}`, // Only read own app dir
            '--allow-env=PORT', // Allow reading PORT
            ...extraFlags,
            entryFile
        ];

        // Spawn deno with restricted permissions
        const denoProcess = spawn(denoCmd, args, {
            env: { ...process.env, PORT: port.toString() }
        });

        denoProcess.stdout.on('data', (data: any) => console.log(`[App ${appId}]: ${data}`));
        denoProcess.stderr.on('data', (data: any) => console.error(`[App ${appId} Error]: ${data}`));
        denoProcess.on('close', (code: any) => {
            console.log(`App ${appId} exited with code ${code}`);
            this.activeApps.delete(appId);
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
