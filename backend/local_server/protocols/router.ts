import { WebSocket } from 'ws';
import { startSsh } from './sshHandler.js';
import { startVnc } from './vncHandler.js';
import { startSftp } from './sftpHandler.js';

export function handleWebSocketConnection(ws: WebSocket): void {
    console.log('Client connected. Waiting for handshake payload...');
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
            else if (data.type === 'connect_vnc') {
                if (data.ip) {
                    const port = data.port || 5900;
                    console.log(`VNC request received for ${data.ip}:${port}, starting VNC proxy...`);
                    ws.removeListener('message', onMessage);
                    startVnc(ws, data.ip, port);
                } else {
                    console.warn('Received VNC connect payload but missing IP');
                    ws.close();
                }
            }
            else if (data.type === 'connect_sftp') {
                if (data.ip && data.username) {
                    console.log(`SFTP request received for ${data.username}@${data.ip}, starting SFTP session...`);
                    ws.removeListener('message', onMessage);
                    startSftp(ws, data.ip, data.username, data.password || '');
                } else {
                    console.warn('Received SFTP connect payload but missing IP or Username');
                    ws.close();
                }
            }
        } catch (err) {
            // Ignore non-JSON messages while waiting
        }
    };

    ws.on('message', onMessage);
}

// Backwards-compatible alias for existing imports
export const handleSshConnection = handleWebSocketConnection;
