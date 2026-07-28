import { WebSocket } from 'ws';

function toSmbPath(p: string): string {
    return (p || '').replace(/^\/+|\/+$/g, '').replace(/\//g, '\\');
}

export function listDirectory(ws: WebSocket, smb2Client: any, path: string) {
    const cleanPath = toSmbPath(path);
    smb2Client.readdir(cleanPath, async (err: any, files: any[]) => {
        if (err) {
            console.error(`[SMB] Error listing directory "${cleanPath}":`, err);
            ws.send(JSON.stringify({ type: 'error', message: err.message || String(err) }));
            return;
        }
        if (!Array.isArray(files)) {
            ws.send(JSON.stringify({ type: 'fileList', data: [] }));
            return;
        }

        try {
            const fileItems = await Promise.all(
                files.map(async (filename: string) => {
                    const itemPath = cleanPath ? `${cleanPath}\\${filename}` : filename;
                    return new Promise((resolve) => {
                        smb2Client.stat(itemPath, (statErr: any, stat: any) => {
                            if (statErr || !stat) {
                                resolve({
                                    type: '-',
                                    name: filename,
                                    size: 0,
                                    modifyTime: Date.now()
                                });
                            } else {
                                const isDir = typeof stat.isDirectory === 'function' ? stat.isDirectory() : false;
                                resolve({
                                    type: isDir ? 'd' : '-',
                                    name: filename,
                                    size: stat.size || 0,
                                    modifyTime: stat.mtime ? new Date(stat.mtime).getTime() : Date.now()
                                });
                            }
                        });
                    });
                })
            );

            ws.send(JSON.stringify({ type: 'fileList', data: fileItems }));
        } catch (e: any) {
            ws.send(JSON.stringify({ type: 'error', message: e.message || String(e) }));
        }
    });
}

export function downloadFile(ws: WebSocket, smb2Client: any, path: string) {
    const cleanPath = toSmbPath(path);
    try {
        smb2Client.readFile(cleanPath, (err: any, data: Buffer) => {
            if (err) {
                console.error(`[SMB] Error reading file "${cleanPath}":`, err);
                ws.send(JSON.stringify({ type: 'error', message: err.message || String(err) }));
                return;
            }
            if (data) {
                ws.send(JSON.stringify({ type: 'fileDataDownload', data: data.toString('base64') }));
            }
            ws.send(JSON.stringify({ type: 'fileEnd' }));
        });
    } catch (err: any) {
        ws.send(JSON.stringify({ type: 'error', message: err.message || String(err) }));
    }
}

export function uploadFile(ws: WebSocket, smb2Client: any, path: string) {
    const cleanPath = toSmbPath(path);
    const chunks: Buffer[] = [];

    const cleanup = () => {
        ws.off('message', onMessage);
    };

    const onMessage = (message: any) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'uploadChunk') {
                let buffer: Buffer;
                if (data.data && data.data.type === 'Buffer' && Array.isArray(data.data.data)) {
                    buffer = Buffer.from(data.data.data);
                } else if (typeof data.data === 'string') {
                    buffer = Buffer.from(data.data, 'base64');
                } else {
                    buffer = Buffer.from(data.data);
                }
                chunks.push(buffer);
                ws.send(JSON.stringify({ type: 'uploadAck' }));
            } else if (data.type === 'uploadEnd') {
                const completeBuffer = Buffer.concat(chunks);
                smb2Client.writeFile(cleanPath, completeBuffer, (err: any) => {
                    if (err) {
                        ws.send(JSON.stringify({ type: 'error', message: err.message || String(err) }));
                    } else {
                        ws.send(JSON.stringify({ type: 'uploadSuccess' }));
                    }
                    cleanup();
                });
            } else if (data.type === 'uploadCancel') {
                cleanup();
            }
        } catch (err: any) {
            ws.send(JSON.stringify({ type: 'error', message: err.message || String(err) }));
            cleanup();
        }
    };

    ws.on('message', onMessage);
    ws.send(JSON.stringify({ type: 'uploadReady' }));
}

export function deleteFile(ws: WebSocket, smb2Client: any, path: string) {
    const cleanPath = toSmbPath(path);
    smb2Client.stat(cleanPath, (statErr: any, stat: any) => {
        const isDir = stat && typeof stat.isDirectory === 'function' ? stat.isDirectory() : false;
        const removeFn = isDir ? smb2Client.rmdir.bind(smb2Client) : smb2Client.unlink.bind(smb2Client);
        removeFn(cleanPath, (err: any) => {
            if (err) {
                ws.send(JSON.stringify({ type: 'error', message: err.message || String(err) }));
            } else {
                ws.send(JSON.stringify({ type: 'deleteSuccess' }));
            }
        });
    });
}

export function createDirectory(ws: WebSocket, smb2Client: any, path: string) {
    const cleanPath = toSmbPath(path);
    smb2Client.mkdir(cleanPath, (err: any) => {
        if (err) {
            ws.send(JSON.stringify({ type: 'error', message: err.message || String(err) }));
        } else {
            ws.send(JSON.stringify({ type: 'mkdirSuccess' }));
        }
    });
}

export function disconnectSmb(ws: WebSocket, smb2Client: any) {
    try {
        smb2Client.close();
        ws.send(JSON.stringify({ type: 'disconnected' }));
    } catch (err: any) {
        ws.send(JSON.stringify({ type: 'error', message: err.message || String(err) }));
    }
}

export function startSmb(
    ws: WebSocket,
    host: string,
    username: string,
    password: string,
    share: string = 'C$',
    domain: string = 'WORKGROUP'
): void {
    console.log(`[SMB] Initiating session to \\\\${host}\\${share} as ${username}...`);
    try {
        const SMB2 = require('@marsaud/smb2');
        const smb2Client = new SMB2({
            share: `\\\\${host}\\${share}`,
            domain: domain || 'WORKGROUP',
            username,
            password,
            autoCloseTimeout: 0
        });

        smb2Client.readdir('', (err: any) => {
            if (err) {
                console.error('[SMB] Connection test failed:', err);
                ws.send(JSON.stringify({ type: 'error', message: err.message || String(err), fatal: true }));
            } else {
                console.log('[SMB] Connected successfully.');
                ws.send(JSON.stringify({ type: 'connected', homeDir: '/' }));
            }
        });

        const onSmbMessage = (message: any) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'list') {
                    listDirectory(ws, smb2Client, data.path || '');
                } else if (data.type === 'download') {
                    downloadFile(ws, smb2Client, data.path);
                } else if (data.type === 'upload') {
                    uploadFile(ws, smb2Client, data.path);
                } else if (data.type === 'delete') {
                    deleteFile(ws, smb2Client, data.path);
                } else if (data.type === 'mkdir') {
                    createDirectory(ws, smb2Client, data.path);
                } else if (data.type === 'disconnect') {
                    disconnectSmb(ws, smb2Client);
                }
            } catch (err) {
                // Ignore non-JSON
            }
        };

        ws.on('message', onSmbMessage);
        ws.on('close', () => {
            try { smb2Client.close(); } catch (e) {}
        });
    } catch (err: any) {
        console.error('[SMB] Failed to initialize SMB connection:', err);
        ws.send(JSON.stringify({ type: 'error', message: err.message || String(err), fatal: true }));
        ws.close();
    }
}
