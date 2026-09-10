import net from 'net';
import { WebSocket } from 'ws';
import type { DomainRouteStats, ActiveChannelInfo } from '../domainroute/domainRouteTypes.js';

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

export const activeDemuxers = new Set<DomainRouteDemuxer>();
let historicalBytesIn = 0;
let historicalBytesOut = 0;

export class DomainRouteDemuxer {
    private ws: WebSocket;
    private activeChannels = new Map<number, ActiveChannel>();
    private isDestroyed = false;

    // Traffic tracking
    public totalBytesIn = 0;
    public totalBytesOut = 0;

    // Bandwidth calculation
    private bandwidthUp = 0;
    private bandwidthDown = 0;
    private lastSampleTime = Date.now();
    private lastSampleBytesIn = 0;
    private lastSampleBytesOut = 0;
    private bandwidthTimer: NodeJS.Timeout | null = null;
    private resumeCheckTimer: NodeJS.Timeout | null = null;

    constructor(ws: WebSocket) {
        this.ws = ws;
        activeDemuxers.add(this);

        this.ws.on('message', (data: any) => this.handleWsMessage(data));
        this.ws.on('close', () => this.destroy());
        this.ws.on('error', () => this.destroy());

        // Periodically calculate bandwidth
        this.bandwidthTimer = setInterval(() => this.calculateBandwidth(), 1000);
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

            // Apply backpressure if WebSocket output buffer is high
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
            const canWrite = channel.socket.write(payload);
            if (!canWrite) {
                // Socket internal buffer full, will drain automatically
            }
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

    private calculateBandwidth(): void {
        const now = Date.now();
        const elapsedSec = (now - this.lastSampleTime) / 1000;
        if (elapsedSec > 0) {
            const deltaIn = this.totalBytesIn - this.lastSampleBytesIn;
            const deltaOut = this.totalBytesOut - this.lastSampleBytesOut;
            this.bandwidthUp = deltaIn / elapsedSec;
            this.bandwidthDown = deltaOut / elapsedSec;
            this.lastSampleTime = now;
            this.lastSampleBytesIn = this.totalBytesIn;
            this.lastSampleBytesOut = this.totalBytesOut;
        }
    }

    public getStats(): { channels: ActiveChannelInfo[]; bandwidthUp: number; bandwidthDown: number; bytesIn: number; bytesOut: number } {
        const now = Date.now();
        const channels: ActiveChannelInfo[] = Array.from(this.activeChannels.values()).map(ch => ({
            channelId: ch.channelId,
            domain: ch.domain,
            port: ch.port,
            bytesIn: ch.bytesIn,
            bytesOut: ch.bytesOut,
            startTime: ch.startTime,
            duration: Math.round((now - ch.startTime) / 1000)
        }));

        return {
            channels,
            bandwidthUp: Math.round(this.bandwidthUp),
            bandwidthDown: Math.round(this.bandwidthDown),
            bytesIn: this.totalBytesIn,
            bytesOut: this.totalBytesOut
        };
    }

    public destroy(): void {
        if (this.isDestroyed) return;
        this.isDestroyed = true;

        activeDemuxers.delete(this);
        historicalBytesIn += this.totalBytesIn;
        historicalBytesOut += this.totalBytesOut;

        if (this.bandwidthTimer) {
            clearInterval(this.bandwidthTimer);
            this.bandwidthTimer = null;
        }
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

// Global aggregated stats query
export function getDomainRouteStats(): DomainRouteStats {
    let activeChannelCount = 0;
    let bandwidthUp = 0;
    let bandwidthDown = 0;
    let bytesIn = historicalBytesIn;
    let bytesOut = historicalBytesOut;
    const connectedDomainsSet = new Set<string>();
    const channels: ActiveChannelInfo[] = [];

    for (const demuxer of activeDemuxers) {
        const stats = demuxer.getStats();
        activeChannelCount += stats.channels.length;
        bandwidthUp += stats.bandwidthUp;
        bandwidthDown += stats.bandwidthDown;
        bytesIn += stats.bytesIn;
        bytesOut += stats.bytesOut;
        for (const ch of stats.channels) {
            connectedDomainsSet.add(ch.domain);
            channels.push(ch);
        }
    }

    return {
        activeChannels: activeChannelCount,
        activeChannelCount,
        channels,
        bandwidthUp: Math.round(bandwidthUp),
        bandwidthDown: Math.round(bandwidthDown),
        bytesIn,
        bytesOut,
        connectedDomains: Array.from(connectedDomainsSet)
    };
}
