import { WebSocket } from 'ws';
import { Client as SSHClient } from 'ssh2';

export function startSsh(ws: WebSocket, host: string, username: string, password: string): void {
    console.log(`Initiating SSH session to ${host} as ${username}...`);
    const ssh = new SSHClient();

    ssh.on('ready', () => {
        ssh.shell((err, stream) => {
            if (err) {
                ws.send(`\r\n[SSH Error]: ${err.message}\r\n`);
                return ws.close();
            }
            stream.on('data', (data: Buffer) => ws.send(data.toString('utf-8')));
            stream.on('close', () => ws.close());
            ws.on('message', (message: any) => stream.write(message));
        });
    });

    ssh.on('error', (err) => {
        ws.send(`\r\n[Connection Error]: ${err.message}\r\n`);
        ws.close();
    });

    ssh.connect({
        host,
        port: 22,
        username,
        password
    });

    ws.on('close', () => {
        ssh.end();
    });
}
