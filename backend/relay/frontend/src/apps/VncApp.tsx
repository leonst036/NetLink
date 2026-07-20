import { useState, useEffect, useRef } from 'react';
// @ts-ignore
import RFB from '@novnc/novnc';
import { Maximize } from 'lucide-react';
import { Box, TextField, Select, MenuItem, Button, IconButton, Toolbar, Typography, Tooltip } from '@mui/material';

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
    const [stats, setStats] = useState({ fps: 0, latency: 0 });
    const [isDebug, setIsDebug] = useState(() => localStorage.getItem('netlink_debug') === 'true');

    const containerRef = useRef<HTMLDivElement>(null);
    const rfbRef = useRef<RFB | null>(null);
    const statIntervalRef = useRef<any>(null);

    const debugLog = (...args: unknown[]) => {
        if (window.localStorage.getItem('netlink_debug') === 'true') {
            console.log('[VNC Debug]', ...args);
        }
    };

    useEffect(() => {
        const handleSettingsChange = () => setIsDebug(localStorage.getItem('netlink_debug') === 'true');
        window.addEventListener('settingsChange', handleSettingsChange);
        return () => window.removeEventListener('settingsChange', handleSettingsChange);
    }, []);

    const disconnectVnc = () => {
        if (rfbRef.current) {
            debugLog('Disconnecting existing VNC session');
            rfbRef.current.disconnect();
            rfbRef.current = null;
        }
        if (statIntervalRef.current) {
            clearInterval(statIntervalRef.current);
            statIntervalRef.current = null;
        }
        setStatus('disconnected');
        setIsConnected(false);
    };

    const connectVnc = () => {
        if (!token || !containerRef.current || !selectedIp) {
            debugLog('VNC connection skipped due to missing prerequisites', { tokenPresent: !!token, hasContainer: !!containerRef.current, selectedIp });
            return;
        }

        disconnectVnc();
        setStatus('connecting');
        debugLog('Starting VNC connection attempt', { target, selectedIp, vncPort, hasPassword: !!vncPassword, monitor: selectedMonitor });

        const isSecure = window.location.protocol === 'https:';
        const protocol = isSecure ? 'wss:' : 'ws:';
        let host = window.location.host;
        if (host.includes('localhost:5173')) host = 'localhost:4535'; // Dev mode fallback
        const socketUrl = `${protocol}//${host}/client?token=${encodeURIComponent(token)}&target=${encodeURIComponent(target)}`;
        debugLog('Connecting web socket', { socketUrl });

        const ws = new window.WebSocket(socketUrl, ['binary']);

        let isBackendReady = false;
        let sendBuffer: any[] = [];
        const originalSend = ws.send.bind(ws);

        ws.send = function (data: any) {
            if (!isBackendReady) {
                debugLog('Queuing outbound websocket message until backend is ready', { dataType: typeof data, queuedCount: sendBuffer.length + 1 });
                sendBuffer.push(data);
            } else {
                debugLog('Sending websocket message', { dataType: typeof data });
                originalSend(data);
            }
        };

        ws.addEventListener('open', () => {
            debugLog('Websocket opened');
        });

        ws.addEventListener('close', (event) => {
            debugLog('Websocket closed', { code: event.code, reason: event.reason });
        });

        ws.addEventListener('error', (event) => {
            debugLog('Websocket error', event);
        });

        let frames = 0;
        let lastTime = performance.now();
        statIntervalRef.current = setInterval(() => {
            const now = performance.now();
            const currentFps = Math.round((frames * 1000) / (now - lastTime));
            
            const startPing = performance.now();
            fetch('/health').then(() => {
                const latency = Math.round(performance.now() - startPing);
                setStats({ fps: currentFps, latency });
            }).catch(() => {
                setStats({ fps: currentFps, latency: 0 });
            });
            
            frames = 0;
            lastTime = now;
        }, 1000);

        ws.addEventListener('message', (e) => {
            frames++;
            let text = '';
            if (e.data instanceof ArrayBuffer) {
                text = new TextDecoder().decode(e.data);
            } else if (typeof e.data === 'string') {
                text = e.data;
            }

            debugLog('Received websocket message', { backendReady: isBackendReady, textSnippet: text.slice(0, 200) });

            if (!isBackendReady && text.includes('ready_for_credentials')) {
                const credentialsPayload = JSON.stringify({ type: 'connect_vnc', ip: selectedIp, port: parseInt(vncPort, 10) || 5900 });
                debugLog('Backend requested credentials; sending VNC connect request', { payload: credentialsPayload });
                originalSend(credentialsPayload);
                e.stopImmediatePropagation();
                return;
            }

            if (!isBackendReady && text.includes('vnc_started')) {
                isBackendReady = true;
                debugLog('Backend reported VNC started; flushing buffered messages', { bufferedCount: sendBuffer.length });
                sendBuffer.forEach(data => originalSend(data));
                sendBuffer = [];
                e.stopImmediatePropagation();
                return;
            }
        });

        const rfb = new RFB(containerRef.current, ws, {
            credentials: { password: vncPassword }
        });

        rfb.qualityLevel = 4;
        rfb.compressionLevel = 4;

        rfb.scaleViewport = true;
        rfb.resizeSession = true;

        rfb.addEventListener('connect', () => {
            debugLog('noVNC connected', { selectedIp, vncPort, monitor: selectedMonitor });
            setStatus('connected');
            setIsConnected(true);

            try {
                if (typeof rfb.sendSetMonitor === 'function') {
                    const monitorNumber = parseInt(selectedMonitor, 10);
                    if (!isNaN(monitorNumber)) {
                        debugLog('Sending initial monitor selection', { monitorNumber });
                        rfb.sendSetMonitor(monitorNumber);
                    }
                }
            } catch (e) {
                console.error('Failed to send set monitor message', e);
            }
        });
        rfb.addEventListener('disconnect', () => {
            debugLog('noVNC disconnected');
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
        debugLog('Fetching saved VNC logins');
        fetch('/api/server-logins', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => {
                if (data.logins) {
                    const vncLogins = data.logins.filter((l: any) => l.type === 'vnc');
                    debugLog('Loaded saved VNC logins', { count: vncLogins.length });
                    setSavedLogins(vncLogins);
                }
            })
            .catch(err => {
                debugLog('Failed to fetch saved VNC logins', err);
                console.error('Failed to fetch logins', err);
            });
    }, [token]);

    const applyLogin = (e: any) => {
        const login = savedLogins.find(l => l.id === e.target.value);
        if (login) {
            debugLog('Applying saved VNC login', { name: login.name, ip: login.ip, port: login.port || '5900' });
            setSelectedIp(login.ip);
            setVncPort(login.port || '5900');
            setVncPassword(login.password);
        }
    };

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            debugLog('Entering fullscreen');
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            debugLog('Exiting fullscreen');
            document.exitFullscreen();
        }
    };

    // Send updated monitor number to backend when it changes if we are connected
    useEffect(() => {
        if (isConnected && rfbRef.current) {
            debugLog('Monitor selection changed; updating connected session', { selectedMonitor });
            try {
                // @ts-ignore
                if (typeof rfbRef.current.sendSetMonitor === 'function') {
                    const monitorNumber = parseInt(selectedMonitor, 10);
                    if (!isNaN(monitorNumber)) {
                        // @ts-ignore
                        debugLog('Sending updated monitor selection', { monitorNumber });
                        rfbRef.current.sendSetMonitor(monitorNumber);
                    }
                }
            } catch (e) {
                console.error('Failed to send set monitor message', e);
            }
        }
    }, [selectedMonitor, isConnected]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#050811' }}>
            <Toolbar 
                variant="dense" 
                sx={{ 
                    bgcolor: 'rgba(15, 23, 42, 0.9)', 
                    borderBottom: '1px solid rgba(255,255,255,0.05)', 
                    display: 'flex', 
                    gap: 1.5, 
                    py: 1,
                    px: '10px !important'
                }}
            >
                {savedLogins.length > 0 && (
                    <Select
                        size="small"
                        value=""
                        displayEmpty
                        onChange={applyLogin}
                        disabled={isConnected}
                        sx={{ width: 140, '& .MuiSelect-select': { py: 0.8 } }}
                    >
                        <MenuItem value="" disabled>Saved Logins...</MenuItem>
                        {savedLogins.map(l => (
                            <MenuItem key={l.id} value={l.id}>{l.name} ({l.ip})</MenuItem>
                        ))}
                    </Select>
                )}
                <TextField
                    size="small"
                    value={selectedIp}
                    onChange={(e) => setSelectedIp(e.target.value)}
                    placeholder="Target IP"
                    disabled={isConnected}
                    sx={{ width: 130, '& .MuiInputBase-input': { py: 0.8 } }}
                />
                <TextField
                    size="small"
                    value={vncPort}
                    onChange={(e) => setVncPort(e.target.value)}
                    placeholder="Port"
                    disabled={isConnected}
                    sx={{ width: 80, '& .MuiInputBase-input': { py: 0.8 } }}
                />
                <TextField
                    size="small"
                    type="password"
                    value={vncPassword}
                    onChange={(e) => setVncPassword(e.target.value)}
                    placeholder="Password"
                    disabled={isConnected}
                    sx={{ width: 110, '& .MuiInputBase-input': { py: 0.8 } }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>Monitor:</Typography>
                    <TextField
                        size="small"
                        type="number"
                        slotProps={{ htmlInput: { min: 1 } }}
                        value={selectedMonitor}
                        onChange={(e) => setSelectedMonitor(e.target.value)}
                        sx={{ width: 60, '& .MuiInputBase-input': { py: 0.8 } }}
                    />
                </Box>
                {isConnected ? (
                    <>
                        <Button 
                            variant="contained" 
                            color="error" 
                            onClick={disconnectVnc}
                            sx={{ textTransform: 'none', px: 2, ml: 'auto' }}
                        >
                            Disconnect
                        </Button>
                        <Tooltip title="Fullscreen">
                            <IconButton onClick={toggleFullscreen} sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                                <Maximize size={16} />
                            </IconButton>
                        </Tooltip>
                    </>
                ) : (
                    <Button 
                        variant="contained" 
                        color="success" 
                        onClick={connectVnc} 
                        disabled={status === 'connecting' || !selectedIp}
                        sx={{ textTransform: 'none', px: 2, ml: 'auto' }}
                    >
                        {status === 'connecting' ? 'Connecting...' : 'Connect VNC'}
                    </Button>
                )}
            </Toolbar>
            
            <Box 
                ref={containerRef} 
                sx={{ 
                    flex: 1, 
                    overflow: 'hidden', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    bgcolor: '#000', 
                    position: 'relative' 
                }}
            >
                {status === 'disconnected' && <Typography color="text.secondary">VNC Disconnected</Typography>}
                
                {isDebug && isConnected && (
                    <Box sx={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        bgcolor: 'rgba(0, 0, 0, 0.7)',
                        color: 'info.main',
                        p: 1,
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        pointerEvents: 'none',
                        zIndex: 1000,
                        border: '1px solid rgba(56, 189, 248, 0.3)'
                    }}>
                        <div>FPS: {stats.fps}</div>
                        <div>Ping: {stats.latency}ms</div>
                    </Box>
                )}
            </Box>
        </Box>
    );
}