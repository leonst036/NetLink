import { WebSocket } from 'ws';
import { Client as SSHClient } from 'ssh2';
import dotenv from 'dotenv';
dotenv.config();

export function handleSshConnection(ws: WebSocket): void {
    console.log('Client connected. Waiting for SSH credentials...');
    
    // Signal the client that the backend bridge is ready to receive credentials
    ws.send(JSON.stringify({ type: 'ready_for_credentials' }));

    const onMessage = (message: any) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'connect' && data.ip && data.username) {
                ws.removeListener('message', onMessage);
                startSsh(ws, data.ip, data.username, data.password || '');
            }
        } catch (err) {
            // Ignore non-JSON messages while waiting
        }
    };

    ws.on('message', onMessage);
}

function startSsh(ws: WebSocket, host: string, username: string, password: string): void {
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
