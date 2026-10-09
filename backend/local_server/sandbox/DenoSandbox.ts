import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';

export interface AppProcess {
    appId: string;
    port: number;
    process: ChildProcess;
}

export class DenoSandbox {
    private activeApps: Map<string, AppProcess> = new Map();

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

    public async startApp(appId: string, entryFile: string, appDir: string, extraFlags: string[] = []): Promise<AppProcess> {
        this.stopApp(appId);

        const port = await this.getAvailablePort();
        const defaultDeno = path.join(process.env.HOME || '', '.deno/bin/deno');
        const denoCmd = process.env.DENO_PATH || (fs.existsSync(defaultDeno) ? defaultDeno : 'deno');

        const cleanEnv: Record<string, string> = {
            PORT: port.toString(),
            PATH: process.env.PATH || '',
            HOME: process.env.HOME || '',
            TMPDIR: process.env.TMPDIR || '/tmp'
        };

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

        const denoProcess = spawn(denoCmd, args, {
            env: cleanEnv
        });

        denoProcess.stdout.on('data', (data: any) => console.log(`[Local App ${appId}]: ${data}`));
        denoProcess.stderr.on('data', (data: any) => console.error(`[Local App ${appId} Error]: ${data}`));
        denoProcess.on('close', (code: any) => {
            console.log(`Local App ${appId} exited with code ${code}`);
            this.activeApps.delete(appId);
        });

        const appProcess: AppProcess = { appId, port, process: denoProcess };
        this.activeApps.set(appId, appProcess);
        
        return appProcess;
    }

    public stopApp(appId: string): void {
        const app = this.activeApps.get(appId);
        if (app) {
            app.process.kill();
            this.activeApps.delete(appId);
            console.log(`Stopped local app ${appId}`);
        }
    }

    public getApp(appId: string): AppProcess | undefined {
        return this.activeApps.get(appId);
    }
}

export const denoSandbox = new DenoSandbox();
