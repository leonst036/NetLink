import { WebSocket } from 'ws';
import { Client as SSHClient } from 'ssh2';
import dotenv from 'dotenv';
dotenv.config();

export function handleSshConnection(ws: WebSocket): void {
    console.log('Client connected. Initiating SSH session...');
    const ssh = new SSHClient();

    ssh.on('ready', () => {
        ssh.shell((err, stream) => {
            if (err) {
                ws.send(`\r\n[SSH Error]: ${err.message}\r\n`);
                return ws.close();
            }
            stream.on('data', (data: Buffer) => ws.send(data.toString('utf-8')));
            stream.on('close', () => ws.close());
            ws.on('message', (message: string) => stream.write(message));
        });
    });

    ssh.on('error', (err) => {
        ws.send(`\r\n[Connection Error]: ${err.message}\r\n`);
        ws.close();
    });

    // TODO: Add JWT authentication to authenticate the SSH connection
    ssh.connect({
        host: process.env.SSH_HOST || 'localhost',
        port: Number(process.env.SSH_PORT || 22),
        username: process.env.SSH_USERNAME || 'NetLink',
        password: process.env.SSH_PASSWORD || 'NetLink123'
    });

    ws.on('close', () => {
        ssh.end();
    });
}
