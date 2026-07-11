import SftpClient from "ssh2-sftp-client";
import { WebSocket } from 'ws';
import type { ConnectConfig } from "ssh2";

export async function connectToSftp(ws: WebSocket, connectConfig: ConnectConfig) {
    const sftp = new SftpClient();
    try {
        await sftp.connect(connectConfig);
        ws.send(JSON.stringify({ type: 'connected' }));
        return sftp;
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err }));
        throw err;
    }
}

export async function listDirectory(ws: WebSocket, sftp: SftpClient, path: string) {
    try {
        const fileList = await sftp.list(path);
        ws.send(JSON.stringify({ type: 'fileList', data: fileList }));
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err }));
        throw err;
    }
}

export async function disconnectSftp(ws: WebSocket, sftp: SftpClient) {
    try {
        await sftp.end();
        ws.send(JSON.stringify({ type: 'disconnected' }));
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err }));
        throw err;
    }
}