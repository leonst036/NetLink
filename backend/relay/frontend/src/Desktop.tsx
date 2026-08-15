import { useState, useEffect, lazy, Suspense } from 'react';
import Window from './Window';
import TopBar from './components/TopBar';
import Dock from './components/Dock';
import GeminiLoader from './components/GeminiLoader';
import DynamicAppLoader from './components/DynamicAppLoader';
import AppIcon from './components/AppIcon';
import { StoreIcon } from 'lucide-react';
import { Box, Alert } from '@mui/material';
import PermissionModal from './components/PermissionModal';
import './Desktop.css';
import { useWindowStore } from './store/useWindowStore';
import { useNotificationStore } from './store/useNotificationStore';

// Lazy loaded desktop applications for optimal code-splitting and small initial bundle size
const NetStoreApp = lazy(() => import('./apps/net-store/NetStoreApp'));

interface DesktopProps {
    token: string;
    onLogout: () => void;
    target: string;
    setTarget: (t: string) => void;
    allowedTargets: string[];
}

export default function Desktop({ token, onLogout, target, setTarget, allowedTargets }: DesktopProps) {
    // Permission state
    const [permissionRequests, setPermissionRequests] = useState<any[]>([]);
    const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);

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

    useEffect(() => {
        const handleIframeMessage = (e: MessageEvent) => {
            if (e.data && e.data.type === 'open_app') {
                const { appId, title, extraParams, icon, color } = e.data;
                if (appId) {
                    useWindowStore.getState().openDynamicApp(appId, title || appId, extraParams, icon, color);
                }
            } else if (e.data && e.data.type === 'netlink_setting_changed') {
                const { key, value } = e.data;
                if (key) {
                    try {
                        localStorage.setItem(key, value);
                        setSettings({
                            username: localStorage.getItem('netlink_username') || 'Admin',
                            wallpaper: localStorage.getItem('netlink_wallpaper') || 'default',
                            theme: localStorage.getItem('netlink_theme') || 'Dark',
                        });
                    } catch (err) {
                        console.error('Failed to sync settings from iframe', err);
                    }
                }
            }
        };
        window.addEventListener('message', handleIframeMessage);
        return () => window.removeEventListener('message', handleIframeMessage);
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
    const { activeWindow, storeWindow, dynamicWindows, setStoreWindow, bringToFront, closeDynamicApp, minimizeDynamicApp, fetchDockConfig, fetchAppMetadata } = useWindowStore();

    useEffect(() => {
        fetchDockConfig();
        fetchAppMetadata();
    }, [fetchDockConfig, fetchAppMetadata]);

    useEffect(() => {
        const isSecure = window.location.protocol === 'https:';
        const protocol = isSecure ? 'wss:' : 'ws:';
        let host = window.location.host;
        if (host.includes('localhost:5173')) host = import.meta.env.VITE_RELAY_HOST || 'localhost:4535';

        const socketUrl = `${protocol}//${host}/desktop?token=${encodeURIComponent(token)}&target=${encodeURIComponent(target)}`;
        const ws = new WebSocket(socketUrl);
        setWsConnection(ws);

        ws.onclose = (event) => {
            if (event.code === 1008 || event.reason?.includes('Authentication Failed') || event.reason?.includes('jwt expired')) {
                console.warn('Desktop WebSocket authentication failed:', event.reason);
                window.dispatchEvent(new CustomEvent('netlink_auth_expired'));
            }
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'permission_request') {
                    setPermissionRequests(prev => [...prev, data]);
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

    const handlePermissionResponse = (appId: string, granted: boolean, permissions: any) => {
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
            wsConnection.send(JSON.stringify({
                type: 'permission_response',
                appId,
                granted,
                permissions,
                folders: permissions?.folders || []
            }));
        }
        setPermissionRequests(prev => prev.filter(req => req.appId !== appId));
    };

    return (
        <Box className="desktop-container" sx={{ background: getBackgroundStyle() }}>
            {/* Desktop overlay filter */}
            <Box className="desktop-overlay" />

            {/* Notifications */}
            <Box className="notification-area">
                {notifications.map(notif => (
                    <Alert
                        key={notif.id}
                        severity={notif.type}
                        onClose={() => removeNotification(notif.id)}
                        className="notification-alert"
                    >
                        {notif.message}
                    </Alert>
                ))}
            </Box>

            {/* Top Menu Bar */}
            <TopBar
                target={target}
                setTarget={setTarget}
                allowedTargets={allowedTargets}
                username={settings.username}
                onLogout={onLogout}
            />

            {/* Permission Modals */}
            {permissionRequests.map((req, i) => (
                <PermissionModal
                    key={req.appId + i}
                    open={true}
                    appId={req.appId}
                    appName={req.appName}
                    folders={req.folders}
                    requestedPermissions={req.requestedPermissions}
                    requestedCollections={req.requestedCollections}
                    allowDatabase={req.allowDatabase}
                    onRespond={handlePermissionResponse}
                />
            ))}

            {/* Windows Area */}
            <Box
                className="windows-area"
                sx={{ filter: settings.theme === 'Light' ? 'invert(0.9) hue-rotate(180deg)' : settings.theme === 'Hacker' ? 'sepia(1) hue-rotate(80deg) saturate(4)' : 'none' }}
            >
                {storeWindow.isOpen && (
                    <Window
                        id="store"
                        title="NetStore"
                        icon={<StoreIcon size={14} color="#ec4899" />}
                        isActive={activeWindow === 'store'}
                        isMinimized={storeWindow.isMinimized}
                        onMinimize={() => setStoreWindow({ isMinimized: true })}
                        onFocus={() => bringToFront('store')}
                        onClose={() => setStoreWindow({ isOpen: false })}
                        defaultPosition={{ x: 120, y: 120 }}
                        defaultSize={{ width: 800, height: 550 }}
                    >
                        <Suspense fallback={<Box className="loader-wrapper"><GeminiLoader /></Box>}>
                            <NetStoreApp token={token} target={target} />
                        </Suspense>
                    </Window>
                )}

                {dynamicWindows.map(dyn => {
                    const builtInApps = ['net-graph', 'net-terminal', 'sftp-client', 'sys-settings', 'vnc-viewer'];
                    const isBuiltIn = builtInApps.includes(dyn.appId);

                    return (
                    <Window
                        key={dyn.id}
                        id={dyn.id}
                        title={dyn.title}
                        icon={<AppIcon appId={dyn.appId} icon={dyn.icon} color={dyn.color} size={14} />}
                        isActive={activeWindow === dyn.id}
                        isMinimized={dyn.isMinimized}
                        onMinimize={() => minimizeDynamicApp(dyn.id, true)}
                        onFocus={() => bringToFront(dyn.id)}
                        onClose={() => closeDynamicApp(dyn.id)}
                        defaultPosition={{ x: 300, y: 150 }}
                        defaultSize={{ width: 800, height: 600 }}
                    >
                        <Suspense fallback={<Box className="loader-wrapper"><GeminiLoader /></Box>}>
                            <DynamicAppLoader 
                                appId={dyn.appId} 
                                token={token} 
                                target={target} 
                                isBuiltIn={isBuiltIn}
                                extraParams={dyn.extraParams}
                            />
                        </Suspense>
                    </Window>
                )})}
            </Box>

            {/* Dock Navigation */}
            <Dock />
        </Box>
    );
}


