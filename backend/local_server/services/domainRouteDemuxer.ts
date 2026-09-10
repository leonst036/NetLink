import net from 'net';
import { WebSocket } from 'ws';

export const CMD_CONNECT = 0x01;
export const CMD_DATA = 0x02;
export const CMD_CLOSE = 0x03;

const HIGH_WATER_MARK = 512 * 1024;
const LOW_WATER_MARK = 256 * 1024;

export interface ActiveChannel {
    channelId: number;
    socket: net.Socket;
    domain: string;
    port: number;
    bytesIn: number;
    bytesOut: number;
    startTime: number;
    isPaused: boolean;
    connected: boolean;
    pendingQueue: Buffer[];
}

export class DomainRouteDemuxer {
    private ws: WebSocket;
    private activeChannels = new Map<number, ActiveChannel>();
    private isDestroyed = false;

    public totalBytesIn = 0;
    public totalBytesOut = 0;

    private resumeCheckTimer: NodeJS.Timeout | null = null;

    constructor(ws: WebSocket) {
        this.ws = ws;

        this.ws.on('message', (data: any) => this.handleWsMessage(data));
        this.ws.on('close', () => this.destroy());
        this.ws.on('error', () => this.destroy());
    }

    private handleWsMessage(data: any): void {
        if (this.isDestroyed) return;

        let buffer: Buffer;
        if (Buffer.isBuffer(data)) {
            buffer = data;
        } else if (Array.isArray(data)) {
            buffer = Buffer.concat(data);
        } else if (data instanceof ArrayBuffer) {
            buffer = Buffer.from(data);
        } else {
            buffer = Buffer.from(data);
        }

        if (buffer.length < 5) return;

        const cmd = buffer.readUInt8(0);
        const channelId = buffer.readUInt32BE(1);

        switch (cmd) {
            case CMD_CONNECT:
                this.handleConnect(channelId, buffer);
                break;
            case CMD_DATA:
                this.handleData(channelId, buffer.subarray(5));
                break;
            case CMD_CLOSE:
                this.handleClose(channelId);
                break;
            default:
                break;
        }
    }

    private handleConnect(channelId: number, buffer: Buffer): void {
        if (buffer.length < 9) return;

        const port = buffer.readUInt16BE(5);
        const domainLength = buffer.readUInt16BE(7);

        if (buffer.length < 9 + domainLength) return;

        const domain = buffer.toString('utf-8', 9, 9 + domainLength);

        if (this.activeChannels.has(channelId)) {
            this.closeChannel(channelId, false);
        }

        const startTime = Date.now();
        let socket: net.Socket;

        try {
            socket = net.createConnection({ host: domain, port });
        } catch (err) {
            this.sendCloseFrame(channelId);
            return;
        }

        socket.setNoDelay(true);

        const channel: ActiveChannel = {
            channelId,
            socket,
            domain,
            port,
            bytesIn: 0,
            bytesOut: 0,
            startTime,
            isPaused: false,
            connected: false,
            pendingQueue: []
        };

        this.activeChannels.set(channelId, channel);

        socket.on('connect', () => {
            channel.connected = true;
            if (channel.pendingQueue.length > 0) {
                for (const chunk of channel.pendingQueue) {
                    socket.write(chunk);
                }
                channel.pendingQueue = [];
            }
        });

        socket.on('data', (chunk: Buffer) => {
            channel.bytesOut += chunk.length;
            this.totalBytesOut += chunk.length;
            this.sendDataFrame(channelId, chunk);

            if (this.ws.bufferedAmount > HIGH_WATER_MARK) {
                if (!channel.isPaused) {
                    socket.pause();
                    channel.isPaused = true;
                    this.scheduleResumeCheck();
                }
            }
        });

        socket.on('error', () => {
            this.closeChannel(channelId, true);
        });

        socket.on('close', () => {
            this.closeChannel(channelId, true);
        });
    }

    private handleData(channelId: number, payload: Buffer): void {
        const channel = this.activeChannels.get(channelId);
        if (!channel) return;

        channel.bytesIn += payload.length;
        this.totalBytesIn += payload.length;

        if (!channel.connected) {
            channel.pendingQueue.push(payload);
        } else {
            channel.socket.write(payload);
        }
    }

    private handleClose(channelId: number): void {
        this.closeChannel(channelId, false);
    }

    private sendDataFrame(channelId: number, chunk: Buffer): void {
        if (this.ws.readyState !== WebSocket.OPEN) return;

        const header = Buffer.allocUnsafe(5);
        header.writeUInt8(CMD_DATA, 0);
        header.writeUInt32BE(channelId, 1);
        const frame = Buffer.concat([header, chunk]);
        this.ws.send(frame, { binary: true });
    }

    private sendCloseFrame(channelId: number): void {
        if (this.ws.readyState !== WebSocket.OPEN) return;

        const frame = Buffer.allocUnsafe(5);
        frame.writeUInt8(CMD_CLOSE, 0);
        frame.writeUInt32BE(channelId, 1);
        this.ws.send(frame, { binary: true });
    }

    public closeChannel(channelId: number, sendClose: boolean): void {
        const channel = this.activeChannels.get(channelId);
        if (!channel) return;

        this.activeChannels.delete(channelId);

        if (sendClose) {
            this.sendCloseFrame(channelId);
        }

        try {
            channel.socket.removeAllListeners();
            channel.socket.destroy();
        } catch {}
    }

    private scheduleResumeCheck(): void {
        if (this.resumeCheckTimer) return;

        const rawSocket = (this.ws as any)._socket as net.Socket | undefined;
        if (rawSocket && typeof rawSocket.once === 'function' && !rawSocket.destroyed) {
            rawSocket.once('drain', () => {
                this.checkAndResumeSockets();
            });
        }

        this.resumeCheckTimer = setInterval(() => {
            this.checkAndResumeSockets();
        }, 50);
    }

    private checkAndResumeSockets(): void {
        if (this.isDestroyed) return;

        if (this.ws.bufferedAmount <= LOW_WATER_MARK) {
            if (this.resumeCheckTimer) {
                clearInterval(this.resumeCheckTimer);
                this.resumeCheckTimer = null;
            }

            for (const channel of this.activeChannels.values()) {
                if (channel.isPaused) {
                    channel.isPaused = false;
                    channel.socket.resume();
                }
            }
        }
    }

    public destroy(): void {
        if (this.isDestroyed) return;
        this.isDestroyed = true;

        if (this.resumeCheckTimer) {
            clearInterval(this.resumeCheckTimer);
            this.resumeCheckTimer = null;
        }

        for (const channelId of Array.from(this.activeChannels.keys())) {
            this.closeChannel(channelId, false);
        }
        this.activeChannels.clear();
    }
}
