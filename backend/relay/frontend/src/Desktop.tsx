import { useState, useEffect, lazy, Suspense } from 'react';
import Window from './Window';
import TopBar from './components/TopBar';
import Dock from './components/Dock';
import GeminiLoader from './components/GeminiLoader';
import { Terminal, Network, Monitor, Folder, Settings } from 'lucide-react';
import { Box, Button, Alert } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useWindowStore } from './store/useWindowStore';
import { useNotificationStore } from './store/useNotificationStore';
import { fetchServers as apiFetchServers } from './api/network';
import type { ServerDevice } from './types';

// Lazy loaded desktop applications for optimal code-splitting and small initial bundle size
const TerminalApp = lazy(() => import('./apps/terminal/TerminalApp'));
const NetworkGraph = lazy(() => import('./apps/network-graph/NetworkGraph'));
const VncApp = lazy(() => import('./apps/vnc/VncApp'));
const FileApp = lazy(() => import('./apps/file-manager/FileApp'));
const SettingsApp = lazy(() => import('./apps/settings/SettingsApp'));

interface DesktopProps {
    token: string;
    onLogout: () => void;
    target: string;
    setTarget: (t: string) => void;
    allowedTargets: string[];
}

export default function Desktop({ token, onLogout, target, setTarget, allowedTargets }: DesktopProps) {
    const [servers, setServers] = useState<ServerDevice[]>([]);
    const [isScanning, setIsScanning] = useState(false);

    const { notifications, addNotification, removeNotification } = useNotificationStore();

    useEffect(() => {
        const handleNotify = (e: any) => {
            const { message, type = 'info' } = e.detail;
            addNotification(message, type);
        };
        window.addEventListener('netlink_notify', handleNotify);
        return () => window.removeEventListener('netlink_notify', handleNotify);
    }, [addNotification]);

    const [settings, setSettings] = useState({
        username: localStorage.getItem('netlink_username') || 'Admin',
        wallpaper: localStorage.getItem('netlink_wallpaper') || 'default',
        theme: localStorage.getItem('netlink_theme') || 'Dark',
    });

    useEffect(() => {
        const handleSettingsChange = () => {
            try {
                setSettings({
                    username: localStorage.getItem('netlink_username') || 'Admin',
                    wallpaper: localStorage.getItem('netlink_wallpaper') || 'default',
                    theme: localStorage.getItem('netlink_theme') || 'Dark',
                });
            } catch (err) {
                console.error('Failed to update settings from localStorage', err);
            }
        };
        window.addEventListener('settingsChange', handleSettingsChange);
        return () => window.removeEventListener('settingsChange', handleSettingsChange);
    }, []);

    const getBackgroundStyle = () => {
        switch (settings.wallpaper) {
            case 'wp1': return 'linear-gradient(135deg, #0f172a 0%, #020617 100%)';
            case 'wp2': return 'linear-gradient(135deg, #312e81 0%, #020617 100%)';
            case 'wp3': return 'linear-gradient(135deg, #064e3b 0%, #020617 100%)';
            case 'solid': return '#020617';
            default: return 'url("/login-bg.png") center/cover no-repeat';
        }
    };

    // Window states
    const { activeWindow, graphWindow, settingsWindow, terminals, vncWindows, sftpWindows, setGraphWindow, setSettingsWindow, openTerminal, openVnc, openSftp, bringToFront, closeTerminal, closeVnc, closeSftp, minimizeTerminal, minimizeVnc, minimizeSftp } = useWindowStore();

    

    const fetchServers = async () => {
        setIsScanning(true);
        try {
            const devices = await apiFetchServers(target);
            setServers(devices);
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
        if (host.includes('localhost:5173')) host = import.meta.env.VITE_RELAY_HOST || 'localhost:4535';

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

        return (
        <DesktopContainer $backgroundStyle={getBackgroundStyle()}>
            {/* Desktop overlay filter */}
            <DesktopOverlay />

            {/* Notifications */}
            <NotificationArea>
                {notifications.map(notif => (
                    <NotificationAlert
                        key={notif.id}
                        severity={notif.type}
                        onClose={() => removeNotification(notif.id)}
                    >
                        {notif.message}
                    </NotificationAlert>
                ))}
            </NotificationArea>

            {/* Top Menu Bar */}
            <TopBar
                target={target}
                setTarget={setTarget}
                allowedTargets={allowedTargets}
                username={settings.username}
                onLogout={onLogout}
            />

            {/* Windows Area */}
            <WindowsArea $themeName={settings.theme}>
                {graphWindow.isOpen && (
                    <Window
                        id="graph"
                        title="Network Topology Explorer"
                        icon={<Network size={14} color="#38bdf8" />}
                        isActive={activeWindow === 'graph'}
                        isMinimized={graphWindow.isMinimized}
                        onMinimize={() => setGraphWindow({ isMinimized: true })}
                        onFocus={() => bringToFront('graph')}
                        onClose={() => setGraphWindow({ isOpen: false })}
                        defaultPosition={{ x: 50, y: 50 }}
                        defaultSize={{ width: 900, height: 600 }}
                    >
                        <TopologyExplorerContainer>
                            <ToolbarContainer>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    size="small"
                                    onClick={fetchServers}
                                    disabled={isScanning}
                                >
                                    {isScanning ? 'Scanning...' : 'Scan Network'}
                                </Button>
                            </ToolbarContainer>
                            <GraphArea>
                                <Suspense fallback={<LoaderWrapper><GeminiLoader /></LoaderWrapper>}>
                                    <NetworkGraph
                                        servers={servers}
                                        onNodeClick={(ip: string) => openTerminal(ip)}
                                        onVncClick={(ip: string) => openVnc(ip)}
                                        onSftpClick={(ip: string) => openSftp(ip)}
                                        token={token}
                                        target={target}
                                    />
                                </Suspense>
                            </GraphArea>
                        </TopologyExplorerContainer>
                    </Window>
                )}

                {settingsWindow.isOpen && (
                    <Window
                        id="settings"
                        title="System Settings"
                        icon={<Settings size={14} color="#94a3b8" />}
                        isActive={activeWindow === 'settings'}
                        isMinimized={settingsWindow.isMinimized}
                        onMinimize={() => setSettingsWindow({ isMinimized: true })}
                        onFocus={() => bringToFront('settings')}
                        onClose={() => setSettingsWindow({ isOpen: false })}
                        defaultPosition={{ x: 100, y: 100 }}
                        defaultSize={{ width: 840, height: 600 }}
                    >
                        <Suspense fallback={<LoaderWrapper><GeminiLoader /></LoaderWrapper>}>
                            <SettingsApp token={token} />
                        </Suspense>
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
                        onMinimize={() => minimizeTerminal(term.id, true)}
                        onFocus={() => bringToFront(term.id)}
                        onClose={() => closeTerminal(term.id)}
                        defaultPosition={{ x: 150, y: 150 }}
                        defaultSize={{ width: 800, height: 500 }}
                    >
                        <Suspense fallback={<LoaderWrapper><GeminiLoader /></LoaderWrapper>}>
                            <TerminalApp token={token} target={target} initialIp={term.ip} />
                        </Suspense>
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
                        onMinimize={() => minimizeVnc(vnc.id, true)}
                        onFocus={() => bringToFront(vnc.id)}
                        onClose={() => closeVnc(vnc.id)}
                        defaultPosition={{ x: 200, y: 200 }}
                        defaultSize={{ width: 800, height: 600 }}
                    >
                        <Suspense fallback={<LoaderWrapper><GeminiLoader /></LoaderWrapper>}>
                            <VncApp token={token} target={target} initialIp={vnc.ip} />
                        </Suspense>
                    </Window>
                ))}

                {sftpWindows.map(sftp => (
                    <Window
                        key={sftp.id}
                        id={sftp.id}
                        title={`NetLink File Client ${sftp.ip ? `- ${sftp.ip}` : ''}`}
                        icon={<Folder size={14} color="#fb923c" />}
                        isActive={activeWindow === sftp.id}
                        isMinimized={sftp.isMinimized}
                        onMinimize={() => minimizeSftp(sftp.id, true)}
                        onFocus={() => bringToFront(sftp.id)}
                        onClose={() => closeSftp(sftp.id)}
                        defaultPosition={{ x: 250, y: 250 }}
                        defaultSize={{ width: 800, height: 500 }}
                    >
                        <Suspense fallback={<LoaderWrapper><GeminiLoader /></LoaderWrapper>}>
                            <FileApp token={token} target={target} initialIp={sftp.ip} />
                        </Suspense>
                    </Window>
                ))}
            </WindowsArea>

            {/* Dock Navigation */}
            <Dock />
        </DesktopContainer>
    );
}

// Styled Components
interface DesktopContainerProps {
    $backgroundStyle: string;
}

const DesktopContainer = styled(Box)<DesktopContainerProps>(({ $backgroundStyle }) => ({
    width: '100vw',
    height: '100vh',
    background: $backgroundStyle,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
}));

const DesktopOverlay = styled(Box)({
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    pointerEvents: 'none',
    zIndex: 0,
});

const NotificationArea = styled(Box)({
    position: 'absolute',
    top: 40,
    right: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: 10000,
    pointerEvents: 'none',
});

const NotificationAlert = styled(Alert)(({ theme }) => ({
    pointerEvents: 'auto',
    minWidth: 250,
    boxShadow: theme.shadows[4],
}));

interface WindowsAreaProps {
    $themeName: string;
}

const WindowsArea = styled(Box)<WindowsAreaProps>(({ $themeName }) => ({
    flex: 1,
    position: 'relative',
    zIndex: 1,
    filter: $themeName === 'Light' ? 'invert(0.9) hue-rotate(180deg)' : $themeName === 'Hacker' ? 'sepia(1) hue-rotate(80deg) saturate(4)' : 'none',
    transition: 'filter 0.3s ease',
}));

const TopologyExplorerContainer = styled(Box)(({ theme }) => ({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.default,
}));

const ToolbarContainer = styled(Box)(({ theme }) => ({
    padding: theme.spacing(1),
    display: 'flex',
    gap: theme.spacing(1),
    borderBottom: '1px solid rgba(255,255,255,0.05)',
}));

const GraphArea = styled(Box)({
    flex: 1,
    position: 'relative',
    minHeight: 0,
});

const LoaderWrapper = styled(Box)({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
});
