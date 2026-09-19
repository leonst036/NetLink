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
        const denoCmd = fs.existsSync('/home/leon/.deno/bin/deno') ? '/home/leon/.deno/bin/deno' : 'deno';

        const cleanEnv: Record<string, string> = {
            PORT: port.toString(),
            PATH: process.env.PATH || '',
            HOME: process.env.HOME || '',
            TMPDIR: process.env.TMPDIR || '/tmp'
        };

        const hasNetFlag = extraFlags.some(f => f.startsWith('--allow-net'));
        const hasEnvFlag = extraFlags.some(f => f.startsWith('--allow-env'));

        const netFlags = hasNetFlag
            ? extraFlags.filter(f => f.startsWith('--allow-net'))
            : [`--allow-net=0.0.0.0:${port},127.0.0.1:${port},localhost:${port}`];

        const envFlags = hasEnvFlag
            ? extraFlags.filter(f => f.startsWith('--allow-env'))
            : ['--allow-env=PORT,PATH,HOME,TMPDIR'];

        const otherFlags = extraFlags.filter(f => !f.startsWith('--allow-net') && !f.startsWith('--allow-env'));

        const args = [
            'run',
            '--no-config',
            `--allow-read=${appDir}`,
            `--allow-write=${appDir}`,
            ...netFlags,
            ...envFlags,
            ...otherFlags,
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
