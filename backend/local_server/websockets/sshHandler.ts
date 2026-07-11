import { WebSocket } from 'ws';
import { Client as SSHClient } from 'ssh2';
import dotenv from 'dotenv';
import { startVnc } from './vncHandler.js';
dotenv.config();

export function handleSshConnection(ws: WebSocket): void {
    console.log('Client connected. Waiting for SSH credentials...');
    const onMessage = (message: any) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'connect') {
                if (data.ip && data.username) {
                    console.log(`Valid credentials received for ${data.username}@${data.ip}, starting SSH...`);
                    ws.removeListener('message', onMessage);
                    try {
                        startSsh(ws, data.ip, data.username, data.password || '');
                    } catch (err: any) {
                        console.error('Error starting SSH:', err);
                        ws.send(`\r\n[Backend] Error starting SSH: ${err.message}\r\n`);
                        ws.close();
                    }
                } else {
                    console.warn('Received connect payload but missing ip or username:', data);
                    ws.send('\r\n[Backend] Error: Missing IP or Username in connection payload\r\n');
                }
            }
            else if (data.type === 'connect_vnc') { // VNC connection
                if (data.ip) {
                    console.log(`VNC request received for ${data.ip}, starting VNC proxy...`);
                    ws.removeListener('message', onMessage);
                    startVnc(ws, data.ip, 5900);
                } else {
                    console.warn('Received VNC connect payload but missing IP');
                    ws.close();
                }
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
