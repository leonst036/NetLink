import { useState, useEffect, useRef } from 'react';
import RFB from '@novnc/novnc/core/rfb';
interface VncAppProps {
    token: string;
    target: string;
    initialIp?: string;
}
export default function VncApp({ token, target, initialIp }: VncAppProps) {
    const [selectedIp, setSelectedIp] = useState(initialIp || '');
    const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [isConnected, setIsConnected] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const rfbRef = useRef<RFB | null>(null);
    const disconnectVnc = () => {
        if (rfbRef.current) {
            rfbRef.current.disconnect();
            rfbRef.current = null;
        }
        setStatus('disconnected');
        setIsConnected(false);
    };
    const connectVnc = () => {
        if (!token || !containerRef.current || !selectedIp) return;
        disconnectVnc();
        setStatus('connecting');
        const isSecure = window.location.protocol === 'https:';
        const protocol = isSecure ? 'wss:' : 'ws:';
        const wsPort = '4536';
        const host = window.location.hostname ? `${window.location.hostname}:${wsPort}` : `localhost:${wsPort}`;
        const socketUrl = `${protocol}//${host}/client?token=${encodeURIComponent(token)}&target=${encodeURIComponent(target)}`;
        const OriginalWebSocket = window.WebSocket;
        class VncWebSocket extends OriginalWebSocket {
            constructor(url: string | URL, protocols?: string | string[]) {
                super(url, protocols);
                this.addEventListener('open', () => {
                    // Inform backend that this is a VNC stream
                    this.send(JSON.stringify({ type: 'connect_vnc', ip: selectedIp }));
                });
            }
        }
        // @ts-ignore
        window.WebSocket = VncWebSocket;

        // Initialize noVNC
        const rfb = new RFB(containerRef.current, socketUrl, {
            wsProtocols: ['binary']
        });
        // restore WebSocket
        window.WebSocket = OriginalWebSocket;


        rfb.addEventListener('connect', () => {
            setStatus('connected');
            setIsConnected(true);
        });
        rfb.addEventListener('disconnect', () => {
            setStatus('disconnected');
            setIsConnected(false);
        });
        rfbRef.current = rfb;
    };
    useEffect(() => {
        return () => disconnectVnc();
    }, []);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#050811' }}>
            <div style={{ padding: '10px', background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                    type="text"
                    value={selectedIp}
                    onChange={(e) => setSelectedIp(e.target.value)}
                    placeholder="Target IP"
                    disabled={isConnected}
                    style={inputStyle}
                />
                {isConnected ? (
                    <button style={btnDisconnectStyle} onClick={disconnectVnc}>Disconnect</button>
                ) : (
                    <button style={btnConnectStyle} onClick={connectVnc} disabled={status === 'connecting' || !selectedIp}>
                        {status === 'connecting' ? '...' : 'Connect VNC'}
                    </button>
                )}
            </div>
            <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000' }}>
                {status === 'disconnected' && <div style={{ color: '#64748b' }}>VNC Disconnected</div>}
            </div>
        </div>
    );
}
const inputStyle: React.CSSProperties = { background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '6px 10px', borderRadius: '6px', color: 'white', fontSize: '0.85rem', width: '120px' };
const btnConnectStyle: React.CSSProperties = { background: '#10b981', border: 'none', padding: '6px 12px', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' };
const btnDisconnectStyle: React.CSSProperties = { ...btnConnectStyle, background: '#ef4444' };