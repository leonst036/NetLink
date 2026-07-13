import { useState, useEffect, useRef } from 'react';
// @ts-ignore
import RFB from '@novnc/novnc';
import { Maximize } from 'lucide-react';
interface VncAppProps {
    token: string;
    target: string;
    initialIp?: string;
}
export default function VncApp({ token, target, initialIp }: VncAppProps) {
    const [selectedIp, setSelectedIp] = useState(initialIp || '');
    const [vncPort, setVncPort] = useState('5900');
    const [vncPassword, setVncPassword] = useState('');
    const [selectedMonitor, setSelectedMonitor] = useState('1');
    const [savedLogins, setSavedLogins] = useState<any[]>([]);
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
        const ws = new window.WebSocket(socketUrl, ['binary']);

        let isBackendReady = false;
        let sendBuffer: any[] = [];
        const originalSend = ws.send.bind(ws);

        ws.send = function (data: any) {
            if (!isBackendReady) {
                sendBuffer.push(data);
            } else {
                originalSend(data);
            }
        };

        ws.addEventListener('message', (e) => {
            let text = '';
            if (e.data instanceof ArrayBuffer) {
                text = new TextDecoder().decode(e.data);
            } else if (typeof e.data === 'string') {
                text = e.data;
            }

            if (!isBackendReady && text.includes('ready_for_credentials')) {
                originalSend(JSON.stringify({ type: 'connect_vnc', ip: selectedIp, port: parseInt(vncPort, 10) || 5900 }));
                e.stopImmediatePropagation();
                return;
            }

            if (!isBackendReady && text.includes('vnc_started')) {
                isBackendReady = true;
                sendBuffer.forEach(data => originalSend(data));
                sendBuffer = [];
                e.stopImmediatePropagation();
                return;
            }
        });

        const rfb = new RFB(containerRef.current, ws, {
            credentials: { password: vncPassword }
        });

        rfb.scaleViewport = true;
        rfb.resizeSession = true;

        rfb.addEventListener('connect', () => {
            setStatus('connected');
            setIsConnected(true);

            // Send setMonitor as soon as connected
            try {
                if (typeof rfb.sendSetMonitor === 'function') {
                    const monitorNumber = parseInt(selectedMonitor, 10);
                    if (!isNaN(monitorNumber)) {
                        rfb.sendSetMonitor(monitorNumber);
                    }
                }
            } catch (e) {
                console.error("Failed to send set monitor message", e);
            }
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

    // Fetch saved logins
    useEffect(() => {
        fetch('/api/server-logins', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => {
                if (data.logins) {
                    setSavedLogins(data.logins.filter((l: any) => l.type === 'vnc'));
                }
            })
            .catch(err => console.error('Failed to fetch logins', err));
    }, [token]);

    const applyLogin = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const login = savedLogins.find(l => l.id === e.target.value);
        if (login) {
            setSelectedIp(login.ip);
            setVncPort(login.port || '5900');
            setVncPassword(login.password);
        }
    };

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    // Send updated monitor number to backend when it changes if we are connected
    useEffect(() => {
        if (isConnected && rfbRef.current) {
            try {
                // @ts-ignore
                if (typeof rfbRef.current.sendSetMonitor === 'function') {
                    const monitorNumber = parseInt(selectedMonitor, 10);
                    if (!isNaN(monitorNumber)) {
                        // @ts-ignore
                        rfbRef.current.sendSetMonitor(monitorNumber);
                    }
                }
            } catch (e) {
                console.error("Failed to send set monitor message", e);
            }
        }
    }, [selectedMonitor, isConnected]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#050811' }}>
            <div style={{ padding: '10px', background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                {savedLogins.length > 0 && (
                    <select onChange={applyLogin} defaultValue="" disabled={isConnected} style={{ ...inputStyle, width: 'auto' }}>
                        <option value="" disabled>Saved Logins...</option>
                        {savedLogins.map(l => (
                            <option key={l.id} value={l.id}>{l.name} ({l.ip})</option>
                        ))}
                    </select>
                )}
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
                    style={{ ...inputStyle, width: '70px' }}
                />
                <input
                    type="password"
                    value={vncPassword}
                    onChange={(e) => setVncPassword(e.target.value)}
                    placeholder="Password"
                    disabled={isConnected}
                    style={{ ...inputStyle, width: '100px' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: 'white', fontSize: '0.85rem' }}>Monitor:</span>
                    <input
                        type="number"
                        min="1"
                        value={selectedMonitor}
                        onChange={(e) => setSelectedMonitor(e.target.value)}
                        style={{ ...inputStyle, width: '50px', padding: '6px' }}
                    />
                </div>
                {isConnected ? (
                    <>
                        <button style={btnDisconnectStyle} onClick={disconnectVnc}>Disconnect</button>
                        <button style={btnIconStyle} onClick={toggleFullscreen} title="Fullscreen">
                            <Maximize size={16} />
                        </button>
                    </>
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
const btnIconStyle: React.CSSProperties = { background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '6px', borderRadius: '6px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };