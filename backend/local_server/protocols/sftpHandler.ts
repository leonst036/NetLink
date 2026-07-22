import SftpClient from "ssh2-sftp-client";
import { WebSocket } from 'ws';
import type { ConnectConfig } from "ssh2";

function normalizePath(p: string): string {
    let clean = p.replace(/\/+/g, '/');
    if (clean.length > 1 && clean.endsWith('/')) {
        clean = clean.slice(0, -1);
    }
    return clean;
}

export async function connectToSftp(ws: WebSocket, connectConfig: ConnectConfig) {
    const sftp = new SftpClient();
    try {
        await sftp.connect(connectConfig);
        let homeDir = '/';
        try {
            homeDir = await sftp.realPath('.');
        } catch (e) {
            console.error('[SFTP] Failed to resolve real path of home directory:', e);
        }
        ws.send(JSON.stringify({ type: 'connected', homeDir }));
        return sftp;
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err, fatal: true }));
        throw err;
    }
}

export async function listDirectory(ws: WebSocket, sftp: SftpClient, path: string) {
    const normalizedPath = normalizePath(path);
    try {
        console.log(`[SFTP] Listing directory: "${normalizedPath}"`);
        const fileList = await sftp.list(normalizedPath);
        ws.send(JSON.stringify({ type: 'fileList', data: fileList }));
    } catch (err) {
        console.error(`[SFTP] Error listing directory "${normalizedPath}":`, err);
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

export function downloadFile(ws: WebSocket, sftp: SftpClient, path: string) {
    const normalizedPath = normalizePath(path);
    let stream: any;
    const onClose = () => {
        if (stream) {
            try {
                stream.destroy();
            } catch (err) { }
        }
    };

    const onMessage = (msg: any) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === 'downloadCancel') {
                if (stream) {
                    try { stream.destroy(); } catch (e) { }
                }
                ws.send(JSON.stringify({ type: 'downloadCancelled' }));
                ws.off('message', onMessage);
                ws.off('close', onClose);
            }
        } catch (e) { }
    };

    try {
        stream = sftp.createReadStream(normalizedPath);
        ws.on('close', onClose);
        ws.on('message', onMessage);

        stream.on('data', (chunk: Buffer) => {
            stream.pause();
            ws.send(JSON.stringify({ type: 'fileDataDownload', data: chunk.toString('base64') }), (err) => {
                if (err) {
                    stream.destroy(err);
                    return;
                }
                stream.resume();
            });
        });

        stream.on('end', () => {
            ws.send(JSON.stringify({ type: 'fileEnd' }));
            ws.off('close', onClose);
            ws.off('message', onMessage);
        });

        stream.on('error', (err: any) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : err }));
            }
            ws.off('close', onClose);
            ws.off('message', onMessage);
        });
    } catch (err) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : err }));
        }
        ws.off('close', onClose);
        ws.off('message', onMessage);
    }
}

export function uploadFile(ws: WebSocket, sftp: SftpClient, path: string) {
    const normalizedPath = normalizePath(path);
    let writeStream: any;

    const cleanup = () => {
        ws.off('message', onMessage);
        ws.off('close', onClose);
        if (writeStream) {
            try {
                writeStream.destroy();
            } catch (err) { }
        }
    };

    const onClose = () => {
        cleanup();
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

                const canWrite = writeStream.write(buffer);
                if (!canWrite) {
                    writeStream.once('drain', () => {
                        ws.send(JSON.stringify({ type: 'uploadAck' }));
                    });
                } else {
                    ws.send(JSON.stringify({ type: 'uploadAck' }));
                }
            } else if (data.type === 'uploadEnd') {
                writeStream.end(() => {
                    ws.send(JSON.stringify({ type: 'uploadSuccess' }));
                    cleanup();
                });
            } else if (data.type === 'uploadCancel') {
                cleanup();
                sftp.delete(normalizedPath).catch(() => { });
            }
        } catch (err) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : err }));
            }
            cleanup();
        }
    };

    try {
        writeStream = sftp.createWriteStream(normalizedPath);

        writeStream.on('error', (err: any) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : err }));
            }
            cleanup();
        });

        ws.on('message', onMessage);
        ws.on('close', onClose);

        ws.send(JSON.stringify({ type: 'uploadReady' }));
    } catch (err) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : err }));
        }
        cleanup();
    }
}

export async function deleteItem(ws: WebSocket, sftp: SftpClient, path: string) {
    const normalizedPath = normalizePath(path);
    try {
        const type = await sftp.exists(normalizedPath);
        if (type === 'd') {
            await sftp.rmdir(normalizedPath, true);
        } else if (type) {
            await sftp.delete(normalizedPath);
        }
        ws.send(JSON.stringify({ type: 'deleteSuccess' }));
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : err }));
    }
}

export async function createDirectory(ws: WebSocket, sftp: SftpClient, path: string) {
    const normalizedPath = normalizePath(path);
    try {
        await sftp.mkdir(normalizedPath, true);
        ws.send(JSON.stringify({ type: 'mkdirSuccess' }));
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : err }));
    }
}

export async function startSftp(ws: WebSocket, host: string, username: string, password: string): Promise<void> {
    console.log(`Initiating SFTP session to ${host} as ${username}...`);
    try {
        const sftp = await connectToSftp(ws, {
            host,
            port: 22,
            username,
            password
        });

        const onSftpMessage = async (message: any) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'list') {
                    await listDirectory(ws, sftp, data.path || '.');
                } else if (data.type === 'download') {
                    await downloadFile(ws, sftp, data.path);
                } else if (data.type === 'upload') {
                    uploadFile(ws, sftp, data.path);
                } else if (data.type === 'delete') {
                    await deleteItem(ws, sftp, data.path);
                } else if (data.type === 'mkdir') {
                    await createDirectory(ws, sftp, data.path);
                } else if (data.type === 'disconnect') {
                    await disconnectSftp(ws, sftp);
                }
            } catch (err) {
                // Ignore parse/handler errors
            }
        };

        ws.on('message', onSftpMessage);

        ws.on('close', () => {
            sftp.end().catch(() => { });
        });
    } catch (err: any) {
        console.error('Failed to initialize SFTP connection:', err);
        ws.close();
    }
}
