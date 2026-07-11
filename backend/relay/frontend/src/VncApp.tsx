import { useState, useEffect, useRef } from 'react';
// @ts-ignore
import RFB from '@novnc/novnc';
interface VncAppProps {
    token: string;
    target: string;
    initialIp?: string;
}
export default function VncApp({ token, target, initialIp }: VncAppProps) {
    const [selectedIp, setSelectedIp] = useState(initialIp || '');
    const [vncPort, setVncPort] = useState('5900');
    const [vncPassword, setVncPassword] = useState('');
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
            private _onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null;
            private _messageListeners: any[] = [];
            
            constructor(url: string | URL, protocols?: string | string[]) {
                super(url, protocols);

                super.addEventListener('message', (e) => {
                    let text = '';
                    if (e.data instanceof ArrayBuffer) {
                        text = new TextDecoder().decode(e.data);
                    } else if (typeof e.data === 'string') {
                        text = e.data;
                    }

                    if (text.includes('ready_for_credentials')) {
                        // Backend is ready, send the VNC connect payload
                        this.send(JSON.stringify({ type: 'connect_vnc', ip: selectedIp, port: parseInt(vncPort, 10) || 5900 }));
                        return; // Hide this message from noVNC
                    }

                    // Forward all other messages to noVNC
                    if (this._onmessage) {
                        this._onmessage.call(this, e);
                    }
                    this._messageListeners.forEach(listener => listener.call(this, e));
                });
            }

            set onmessage(listener: ((this: WebSocket, ev: MessageEvent) => any) | null) {
                this._onmessage = listener;
            }

            get onmessage() {
                return this._onmessage;
            }

            addEventListener(type: string, listener: any, options?: any) {
                if (type === 'message') {
                    this._messageListeners.push(listener);
                } else {
                    super.addEventListener(type, listener, options);
                }
            }

            removeEventListener(type: string, listener: any, options?: any) {
                if (type === 'message') {
                    this._messageListeners = this._messageListeners.filter(l => l !== listener);
                } else {
                    super.removeEventListener(type, listener, options);
                }
            }
        }
        // @ts-ignore
        window.WebSocket = VncWebSocket;

        // Initialize noVNC
        const rfb = new RFB(containerRef.current, socketUrl, {
            wsProtocols: ['binary'],
            credentials: { password: vncPassword }
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
                <input
                    type="text"
                    value={vncPort}
                    onChange={(e) => setVncPort(e.target.value)}
                    placeholder="Port"
                    disabled={isConnected}
                    style={{...inputStyle, width: '70px'}}
                />
                <input
                    type="password"
                    value={vncPassword}
                    onChange={(e) => setVncPassword(e.target.value)}
                    placeholder="Password"
                    disabled={isConnected}
                    style={{...inputStyle, width: '100px'}}
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