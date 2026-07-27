import type { ConnectConfig } from 'ssh2';

// Note: Requires @marsaud/smb2 package if SMB feature is enabled
export function connectSMB(ws: WebSocket, connectConfig: ConnectConfig) {
    try {
        const SMB2 = require('@marsaud/smb2');
        const shareName = (connectConfig as any).share || 'C$';
        const smb2Client = new SMB2({
            share: `\\\\${connectConfig.host}\\${shareName}`,
            domain: 'WORKGROUP',
            username: connectConfig.username,
            password: connectConfig.password,
            autoCloseTimeout: 0
        });

        smb2Client.readdir('', (err: any) => {
            if (err) {
                ws.send(JSON.stringify({ type: 'error', message: err.message || err }));
            } else {
                ws.send(JSON.stringify({ type: 'connected' }));
            }
        });
        return smb2Client;
    } catch (err: any) {
        ws.send(JSON.stringify({ type: 'error', message: err.message || err }));
    }
}

export function disconnectSmb(ws: WebSocket, smb2Client: any) {
    try {
        smb2Client.close();
        ws.send(JSON.stringify({ type: 'disconnected' }));
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err }));
        throw err;
    }
}

export function listDirectory(ws: WebSocket, smb2Client: any, path: string) {
    try {
        smb2Client.readdir(path || '', (err: any, files: any) => {
            if (err) {
                ws.send(JSON.stringify({ type: 'error', message: err }));
                throw err;
            }
            ws.send(JSON.stringify({ type: 'fileList', data: files }));
        });
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err }));
        throw err;
    }
}

export function downloadFile(ws: WebSocket, smb2Client: any, path: string) {
    try {
        smb2Client.readFile(path, (err: any, data: Buffer) => {
            if (err) {
                ws.send(JSON.stringify({ type: 'error', message: err }));
                throw err;
            }
            ws.send(JSON.stringify({ type: 'fileDataDownload', data: data.toString('base64') }));
        });
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err }));
        throw err;
    }
}

export function uploadFile(ws: WebSocket, smb2Client: any, path: string) {
    try {
        smb2Client.writeFile(path, 'data', (err: any) => {
            if (err) {
                ws.send(JSON.stringify({ type: 'error', message: err }));
                throw err;
            }
            ws.send(JSON.stringify({ type: 'uploadSuccess' }));
        });
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err }));
        throw err;
    }
}

export function deleteFile(ws: WebSocket, smb2Client: any, path: string) {
    try {
        smb2Client.unlink(path, (err: any) => {
            if (err) {
                ws.send(JSON.stringify({ type: 'error', message: err }));
                throw err;
            }
            ws.send(JSON.stringify({ type: 'deleteSuccess' }));
        });
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err }));
        throw err;
    }
}

export function renameFile(ws: WebSocket, smb2Client: any, oldPath: string, newPath: string) {
    try {
        smb2Client.rename(oldPath, newPath, (err: any) => {
            if (err) {
                ws.send(JSON.stringify({ type: 'error', message: err }));
                throw err;
            }
            ws.send(JSON.stringify({ type: 'renameSuccess' }));
        });
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err }));
        throw err;
    }
}
