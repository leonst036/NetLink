import { useState, useEffect } from 'react';
import Window from './Window';
import TerminalApp from './apps/TerminalApp';
import NetworkGraph from './apps/NetworkGraph';
import VncApp from './apps/VncApp';
import FileApp from './apps/FileApp';
import SettingsApp from './apps/SettingsApp';
import { Terminal, Network, LogOut, Search, Monitor, Folder, Settings } from 'lucide-react';
import { 
    Box, 
    AppBar, 
    Toolbar, 
    Typography, 
    Select, 
    MenuItem, 
    Button, 
    Paper,
    Tooltip,
    Alert
} from '@mui/material';

interface DesktopProps {
    token: string;
    onLogout: () => void;
    target: string;
    setTarget: (t: string) => void;
    allowedTargets: string[];
}

export default function Desktop({ token, onLogout, target, setTarget, allowedTargets }: DesktopProps) {
    const [servers, setServers] = useState<any[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    interface AppNotification {
        id: string;
        message: string;
        type: 'info' | 'success' | 'error';
    }
    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    useEffect(() => {
        const handleNotify = (e: any) => {
            const { message, type = 'info' } = e.detail;
            const id = Date.now().toString() + Math.random().toString();
            setNotifications(prev => [...prev, { id, message, type }]);
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== id));
            }, 5000);
        };

        window.addEventListener('netlink_notify', handleNotify);
        return () => window.removeEventListener('netlink_notify', handleNotify);
    }, []);

    const [settings, setSettings] = useState({
        username: localStorage.getItem('netlink_username') || 'Admin',
        wallpaper: localStorage.getItem('netlink_wallpaper') || 'default',
        theme: localStorage.getItem('netlink_theme') || 'Dark',
    });

    useEffect(() => {
        const handleSettingsChange = () => {
            setSettings({
                username: localStorage.getItem('netlink_username') || 'Admin',
                wallpaper: localStorage.getItem('netlink_wallpaper') || 'default',
                theme: localStorage.getItem('netlink_theme') || 'Dark',
            });
        };
        window.addEventListener('settingsChange', handleSettingsChange);
        return () => window.removeEventListener('settingsChange', handleSettingsChange);
    }, []);

    const getBackgroundStyle = () => {
        switch (settings.wallpaper) {
            case 'wp1': return 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)';
            case 'wp2': return 'linear-gradient(135deg, #4c1d95 0%, #0f172a 100%)';
            case 'wp3': return 'linear-gradient(135deg, #064e3b 0%, #0f172a 100%)';
            case 'solid': return '#090d1a';
            default: return 'url("https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop") center/cover no-repeat';
        }
    };

    // Window states
    const [activeWindow, setActiveWindow] = useState<string | null>('graph');
    const [graphWindow, setGraphWindow] = useState({ isOpen: true, isMinimized: false, zIndex: 1 });
    const [settingsWindow, setSettingsWindow] = useState({ isOpen: false, isMinimized: false, zIndex: 1 });

    interface TerminalInstance {
        id: string;
        ip: string;
        isMinimized: boolean;
    }
    const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
    const [vncWindows, setVncWindows] = useState<{ id: string; ip: string; isMinimized: boolean }[]>([]);
    const [sftpWindows, setSftpWindows] = useState<{ id: string; ip: string; isMinimized: boolean }[]>([]);

    const openVnc = (ip: string) => {
        const id = `vnc-${ip}-${Date.now()}`;
        setVncWindows(prev => [...prev, { id, ip, isMinimized: false }]);
        bringToFront(id);
    };

    const openSftp = (ip: string) => {
        const id = `sftp-${ip}-${Date.now()}`;
        setSftpWindows(prev => [...prev, { id, ip, isMinimized: false }]);
        bringToFront(id);
    };

    const fetchServers = async () => {
        setIsScanning(true);
        try {
            const res = await fetch(`/api/servers?target=${encodeURIComponent(target)}`);
            const data = await res.json();
            if (data.devices) {
                setServers(data.devices);
            }
        } catch (err) {
            console.error('Failed to fetch servers', err);
        } finally {
            setIsScanning(false);
        }
    };

    useEffect(() => {
        fetchServers();

        const isSecure = window.location.protocol === 'https:';
        const protocol = isSecure ? 'wss:' : 'ws:';
        let host = window.location.host;
        if (host.includes('localhost:5173')) host = 'localhost:4535'; 

        const socketUrl = `${protocol}//${host}/desktop?token=${encodeURIComponent(token)}&target=${encodeURIComponent(target)}`;
        const ws = new WebSocket(socketUrl);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'scanning') {
                    setIsScanning(true);
                } else if (data.type === 'server_list' && data.devices) {
                    setServers(data.devices);
                    setIsScanning(false);
                }
            } catch (err) {
                console.error('Failed to parse websocket message', err);
            }
        };

        return () => {
            ws.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target]);

    const bringToFront = (windowName: string) => {
        setActiveWindow(windowName);
        if (windowName === 'graph') {
            setGraphWindow(w => w.isMinimized ? { ...w, isMinimized: false } : w);
        } else if (windowName === 'settings') {
            setSettingsWindow(w => w.isMinimized ? { ...w, isMinimized: false } : w);
        } else if (windowName.startsWith('terminal-')) {
            setTerminals(prev => prev.map(t => t.id === windowName ? { ...t, isMinimized: false } : t));
        } else if (windowName.startsWith('vnc-')) {
            setVncWindows(prev => prev.map(v => v.id === windowName ? { ...v, isMinimized: false } : v));
        } else if (windowName.startsWith('sftp-')) {
            setSftpWindows(prev => prev.map(s => s.id === windowName ? { ...s, isMinimized: false } : s));
        }
    };

    const openTerminal = (ip: string) => {
        const newID = `terminal-${Date.now()}`;
        setTerminals(prev => [...prev, { id: newID, ip, isMinimized: false }]);
        setActiveWindow(newID);
    };

    return (
        <Box sx={{
            width: '100vw',
            height: '100vh',
            background: getBackgroundStyle(),
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Desktop overlay filter */}
            <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(2, 6, 23, 0.4)', pointerEvents: 'none', zIndex: 0 }} />

            {/* Notifications */}
            <Box sx={{
                position: 'absolute',
                top: 40,
                right: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                zIndex: 10000,
                pointerEvents: 'none'
            }}>
                {notifications.map(notif => (
                    <Alert 
                        key={notif.id} 
                        severity={notif.type} 
                        onClose={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                        sx={{ pointerEvents: 'auto', minWidth: 250, boxShadow: 4 }}
                    >
                        {notif.message}
                    </Alert>
                ))}
            </Box>

            {/* Top Menu Bar */}
            <AppBar position="static" color="transparent" elevation={0} sx={{ 
                bgcolor: 'rgba(2, 6, 23, 0.6)', 
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                zIndex: 9999
            }}>
                <Toolbar variant="dense" sx={{ justifyContent: 'space-between', minHeight: '32px !important' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'text.primary' }}>NetLink OS</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary">Target:</Typography>
                            {allowedTargets && allowedTargets.length > 0 ? (
                                <Select
                                    size="small"
                                    value={target}
                                    onChange={(e) => {
                                        setTarget(e.target.value);
                                        localStorage.setItem('netlink_target', e.target.value);
                                    }}
                                    sx={{ height: 24, fontSize: '0.8rem', color: 'text.primary', '& .MuiSelect-select': { py: 0 } }}
                                >
                                    {allowedTargets.map(t => (
                                        <MenuItem key={t} value={t}>{t}</MenuItem>
                                    ))}
                                </Select>
                            ) : (
                                <Typography variant="caption">{target}</Typography>
                            )}
                        </Box>
                        <Typography variant="caption" color="primary.light">{settings.username}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="caption">{currentTime.toLocaleTimeString()}</Typography>
                        <Button size="small" color="error" startIcon={<LogOut size={14} />} onClick={onLogout} sx={{ textTransform: 'none' }}>
                            Logout
                        </Button>
                    </Box>
                </Toolbar>
            </AppBar>

            {/* Windows Area */}
            <Box sx={{
                flex: 1,
                position: 'relative',
                zIndex: 1,
                filter: settings.theme === 'Light' ? 'invert(0.9) hue-rotate(180deg)' : settings.theme === 'Hacker' ? 'sepia(1) hue-rotate(80deg) saturate(4)' : 'none',
                transition: 'filter 0.3s ease'
            }}>
                {graphWindow.isOpen && (
                    <Window
                        id="graph"
                        title="Network Topology Explorer"
                        icon={<Network size={14} color="#38bdf8" />}
                        isActive={activeWindow === 'graph'}
                        isMinimized={graphWindow.isMinimized}
                        onMinimize={() => setGraphWindow(w => ({ ...w, isMinimized: true }))}
                        onFocus={() => bringToFront('graph')}
                        onClose={() => setGraphWindow(w => ({ ...w, isOpen: false }))}
                        defaultPosition={{ x: 50, y: 50 }}
                        defaultSize={{ width: 900, height: 600 }}
                    >
                        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
                            <Box sx={{ p: 1, display: 'flex', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    size="small"
                                    onClick={fetchServers}
                                    disabled={isScanning}
                                    startIcon={<Search size={14} />}
                                >
                                    {isScanning ? 'Scanning...' : 'Scan Network'}
                                </Button>
                            </Box>
                            <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
                                <NetworkGraph
                                    servers={servers}
                                    onNodeClick={(ip) => openTerminal(ip)}
                                    onVncClick={(ip) => openVnc(ip)}
                                    onSftpClick={(ip) => openSftp(ip)}
                                    token={token}
                                    target={target}
                                />
                            </Box>
                        </Box>
                    </Window>
                )}

                {settingsWindow.isOpen && (
                    <Window
                        id="settings"
                        title="System Settings"
                        icon={<Settings size={14} color="#94a3b8" />}
                        isActive={activeWindow === 'settings'}
                        isMinimized={settingsWindow.isMinimized}
                        onMinimize={() => setSettingsWindow(w => ({ ...w, isMinimized: true }))}
                        onFocus={() => bringToFront('settings')}
                        onClose={() => setSettingsWindow(w => ({ ...w, isOpen: false }))}
                        defaultPosition={{ x: 100, y: 100 }}
                        defaultSize={{ width: 840, height: 600 }}
                    >
                        <SettingsApp token={token} />
                    </Window>
                )}

                {terminals.map(term => (
                    <Window
                        key={term.id}
                        id={term.id}
                        title={`NetLink Terminal - ${term.ip || 'Localhost'}`}
                        icon={<Terminal size={14} color="#a78bfa" />}
                        isActive={activeWindow === term.id}
                        isMinimized={term.isMinimized}
                        onMinimize={() => setTerminals(prev => prev.map(t => t.id === term.id ? { ...t, isMinimized: true } : t))}
                        onFocus={() => bringToFront(term.id)}
                        onClose={() => setTerminals(prev => prev.filter(t => t.id !== term.id))}
                        defaultPosition={{ x: 150, y: 150 }}
                        defaultSize={{ width: 800, height: 500 }}
                    >
                        <TerminalApp token={token} target={target} initialIp={term.ip} />
                    </Window>
                ))}

                {vncWindows.map(vnc => (
                    <Window
                        key={vnc.id}
                        id={vnc.id}
                        title={`NetLink VNC - ${vnc.ip}`}
                        icon={<Monitor size={14} color="#10b981" />}
                        isActive={activeWindow === vnc.id}
                        isMinimized={vnc.isMinimized}
                        onMinimize={() => setVncWindows(prev => prev.map(v => v.id === vnc.id ? { ...v, isMinimized: true } : v))}
                        onFocus={() => bringToFront(vnc.id)}
                        onClose={() => setVncWindows(prev => prev.filter(v => v.id !== vnc.id))}
                        defaultPosition={{ x: 200, y: 200 }}
                        defaultSize={{ width: 800, height: 600 }}
                    >
                        <VncApp token={token} target={target} initialIp={vnc.ip} />
                    </Window>
                ))}

                {sftpWindows.map(sftp => (
                    <Window
                        key={sftp.id}
                        id={sftp.id}
                        title={`NetLink SFTP - ${sftp.ip}`}
                        icon={<Folder size={14} color="#fb923c" />}
                        isActive={activeWindow === sftp.id}
                        isMinimized={sftp.isMinimized}
                        onMinimize={() => setSftpWindows(prev => prev.map(s => s.id === sftp.id ? { ...s, isMinimized: true } : s))}
                        onFocus={() => bringToFront(sftp.id)}
                        onClose={() => setSftpWindows(prev => prev.filter(s => s.id !== sftp.id))}
                        defaultPosition={{ x: 250, y: 250 }}
                        defaultSize={{ width: 800, height: 500 }}
                    >
                        <FileApp token={token} target={target} initialIp={sftp.ip} />
                    </Window>
                ))}
            </Box>

            {/* macOS style Dock */}
            <Paper elevation={16} sx={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                bgcolor: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '10px 16px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                zIndex: 9999,
            }}>
                <DockIcon
                    icon={<Network size={24} color="#38bdf8" />}
                    label="Topology Explorer"
                    isOpen={graphWindow.isOpen}
                    isMinimized={graphWindow.isOpen && graphWindow.isMinimized}
                    onClick={() => {
                        if (!graphWindow.isOpen) {
                            setGraphWindow({ isOpen: true, isMinimized: false, zIndex: 1 });
                            bringToFront('graph');
                        } else if (graphWindow.isMinimized) {
                            setGraphWindow(w => ({ ...w, isMinimized: false }));
                            bringToFront('graph');
                        } else if (activeWindow === 'graph') {
                            setGraphWindow(w => ({ ...w, isMinimized: true }));
                        } else {
                            bringToFront('graph');
                        }
                    }}
                />
                <DockIcon
                    icon={<Terminal size={24} color="#a78bfa" />}
                    label="New SSH Terminal"
                    isOpen={false}
                    onClick={() => openTerminal('')}
                />
                <DockIcon
                    icon={<Folder size={24} color="#fb923c" />}
                    label="New SFTP Client"
                    isOpen={false}
                    onClick={() => openSftp('')}
                />
                <DockIcon
                    icon={<Monitor size={24} color="#10b981" />}
                    label="New VNC connection"
                    isOpen={false}
                    onClick={() => openVnc('')}
                />
                <DockIcon
                    icon={<Settings size={24} color="#94a3b8" />}
                    label="Settings"
                    isOpen={settingsWindow.isOpen}
                    isMinimized={settingsWindow.isOpen && settingsWindow.isMinimized}
                    onClick={() => {
                        if (!settingsWindow.isOpen) {
                            setSettingsWindow({ isOpen: true, isMinimized: false, zIndex: 1 });
                            bringToFront('settings');
                        } else if (settingsWindow.isMinimized) {
                            setSettingsWindow(w => ({ ...w, isMinimized: false }));
                            bringToFront('settings');
                        } else if (activeWindow === 'settings') {
                            setSettingsWindow(w => ({ ...w, isMinimized: true }));
                        } else {
                            bringToFront('settings');
                        }
                    }}
                />

                {(terminals.length > 0 || vncWindows.length > 0 || sftpWindows.length > 0) && (
                    <Box sx={{ width: '1px', bgcolor: 'rgba(255,255,255,0.2)', height: 24 }} />
                )}

                {terminals.map(term => (
                    <DockIcon
                        key={term.id}
                        icon={<Terminal size={24} color="#a78bfa" />}
                        label={`Terminal: ${term.ip || 'Localhost'}`}
                        isOpen={activeWindow === term.id && !term.isMinimized}
                        isMinimized={term.isMinimized}
                        onClick={() => {
                            if (term.isMinimized) {
                                setTerminals(prev => prev.map(t => t.id === term.id ? { ...t, isMinimized: false } : t));
                                bringToFront(term.id);
                            } else if (activeWindow === term.id) {
                                setTerminals(prev => prev.map(t => t.id === term.id ? { ...t, isMinimized: true } : t));
                            } else {
                                bringToFront(term.id);
                            }
                        }}
                    />
                ))}

                {vncWindows.map(vnc => (
                    <DockIcon
                        key={vnc.id}
                        icon={<Monitor size={24} color="#10b981" />}
                        label={`VNC: ${vnc.ip}`}
                        isOpen={activeWindow === vnc.id && !vnc.isMinimized}
                        isMinimized={vnc.isMinimized}
                        onClick={() => {
                            if (vnc.isMinimized) {
                                setVncWindows(prev => prev.map(v => v.id === vnc.id ? { ...v, isMinimized: false } : v));
                                bringToFront(vnc.id);
                            } else if (activeWindow === vnc.id) {
                                setVncWindows(prev => prev.map(v => v.id === vnc.id ? { ...v, isMinimized: true } : v));
                            } else {
                                bringToFront(vnc.id);
                            }
                        }}
                    />
                ))}

                {sftpWindows.map(sftp => (
                    <DockIcon
                        key={sftp.id}
                        icon={<Folder size={24} color="#fb923c" />}
                        label={`SFTP: ${sftp.ip}`}
                        isOpen={activeWindow === sftp.id && !sftp.isMinimized}
                        isMinimized={sftp.isMinimized}
                        onClick={() => {
                            if (sftp.isMinimized) {
                                setSftpWindows(prev => prev.map(s => s.id === sftp.id ? { ...s, isMinimized: false } : s));
                                bringToFront(sftp.id);
                            } else if (activeWindow === sftp.id) {
                                setSftpWindows(prev => prev.map(s => s.id === sftp.id ? { ...s, isMinimized: true } : s));
                            } else {
                                bringToFront(sftp.id);
                            }
                        }}
                    />
                ))}
            </Paper>
        </Box>
    );
}

function DockIcon({
    icon,
    label,
    onClick,
    isOpen,
    isMinimized = false
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    isOpen: boolean;
    isMinimized?: boolean;
}) {
    return (
        <Tooltip title={label} arrow placement="top">
            <Box
                onClick={onClick}
                sx={{
                    width: 48,
                    height: 48,
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 3,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s',
                    opacity: isMinimized ? 0.4 : 1,
                    '&:hover': {
                        transform: 'translateY(-5px) scale(1.1)',
                        bgcolor: 'rgba(255, 255, 255, 0.1)'
                    }
                }}
            >
                {icon}
                {isOpen && (
                    <Box sx={{ position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: '50%', bgcolor: '#f8fafc' }} />
                )}
            </Box>
        </Tooltip>
    );
}
