import React from 'react';
import { Network, Terminal, Folder, Monitor, Settings, StoreIcon } from 'lucide-react';
import { Box, Paper, Tooltip } from '@mui/material';
import './Dock.css';
import { useWindowStore } from '../store/useWindowStore';

export default function Dock() {
    const {
        graphWindow, settingsWindow, storeWindow, activeWindow,
        terminals, vncWindows, sftpWindows, dynamicWindows,
        setGraphWindow, setSettingsWindow, setStoreWindow, bringToFront,
        openTerminal, openSftp, openVnc
    } = useWindowStore();

    const handleGraphClick = () => {
        if (!graphWindow.isOpen) {
            setGraphWindow({ isOpen: true, isMinimized: false, zIndex: 1 });
            bringToFront('graph');
        } else if (graphWindow.isMinimized) {
            setGraphWindow({ isMinimized: false });
            bringToFront('graph');
        } else if (activeWindow === 'graph') {
            setGraphWindow({ isMinimized: true });
        } else {
            bringToFront('graph');
        }
    };

    const handleSettingsClick = () => {
        if (!settingsWindow.isOpen) {
            setSettingsWindow({ isOpen: true, isMinimized: false, zIndex: 1 });
            bringToFront('settings');
        } else if (settingsWindow.isMinimized) {
            setSettingsWindow({ isMinimized: false });
            bringToFront('settings');
        } else if (activeWindow === 'settings') {
            setSettingsWindow({ isMinimized: true });
        } else {
            bringToFront('settings');
        }
    };

    const handleStoreClick = () => {
        if (!storeWindow.isOpen) {
            setStoreWindow({ isOpen: true, isMinimized: false, zIndex: 1 });
            bringToFront('store');
        } else if (storeWindow.isMinimized) {
            setStoreWindow({ isMinimized: false });
            bringToFront('store');
        } else if (activeWindow === 'store') {
            setStoreWindow({ isMinimized: true });
        } else {
            bringToFront('store');
        }
    };

    const handleTerminalDockClick = (term: any) => {
        if (term.isMinimized) {
            useWindowStore.getState().minimizeTerminal(term.id, false);
            bringToFront(term.id);
        } else if (activeWindow === term.id) {
            useWindowStore.getState().minimizeTerminal(term.id, true);
        } else {
            bringToFront(term.id);
        }
    };

    const handleVncDockClick = (vnc: any) => {
        if (vnc.isMinimized) {
            useWindowStore.getState().minimizeVnc(vnc.id, false);
            bringToFront(vnc.id);
        } else if (activeWindow === vnc.id) {
            useWindowStore.getState().minimizeVnc(vnc.id, true);
        } else {
            bringToFront(vnc.id);
        }
    };

    const handleSftpDockClick = (sftp: any) => {
        if (sftp.isMinimized) {
            useWindowStore.getState().minimizeSftp(sftp.id, false);
            bringToFront(sftp.id);
        } else if (activeWindow === sftp.id) {
            useWindowStore.getState().minimizeSftp(sftp.id, true);
        } else {
            bringToFront(sftp.id);
        }
    };

    const handleDynamicDockClick = (dyn: any) => {
        if (dyn.isMinimized) {
            useWindowStore.getState().minimizeDynamicApp(dyn.id, false);
            bringToFront(dyn.id);
        } else if (activeWindow === dyn.id) {
            useWindowStore.getState().minimizeDynamicApp(dyn.id, true);
        } else {
            bringToFront(dyn.id);
        }
    };

    return (
        <Paper className="dock-container" elevation={16}>
            <DockIcon
                icon={<Network size={24} color="#38bdf8" />}
                label="Topology Explorer"
                isOpen={graphWindow.isOpen}
                isMinimized={graphWindow.isOpen && graphWindow.isMinimized}
                onClick={handleGraphClick}
            />
            <DockIcon
                icon={<Terminal size={24} color="#a78bfa" />}
                label="New SSH Terminal"
                isOpen={false}
                onClick={() => openTerminal('')}
            />
            <DockIcon
                icon={<Folder size={24} color="#fb923c" />}
                label="New File Client"
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
                onClick={handleSettingsClick}
            />
            <DockIcon
                icon={<StoreIcon size={24} color="#ec4899" />}
                label="NetStore"
                isOpen={storeWindow.isOpen}
                isMinimized={storeWindow.isOpen && storeWindow.isMinimized}
                onClick={handleStoreClick}
            />

            {(terminals.length > 0 || vncWindows.length > 0 || sftpWindows.length > 0 || dynamicWindows.length > 0) && (
                <Box className="dock-divider" />
            )}

            {terminals.map((term: any) => (
                <DockIcon
                    key={term.id}
                    icon={<Terminal size={24} color="#a78bfa" />}
                    label={`Terminal: ${term.ip || 'Localhost'}`}
                    isOpen={activeWindow === term.id && !term.isMinimized}
                    isMinimized={term.isMinimized}
                    onClick={() => handleTerminalDockClick(term)}
                />
            ))}

            {vncWindows.map((vnc: any) => (
                <DockIcon
                    key={vnc.id}
                    icon={<Monitor size={24} color="#10b981" />}
                    label={`VNC: ${vnc.ip}`}
                    isOpen={activeWindow === vnc.id && !vnc.isMinimized}
                    isMinimized={vnc.isMinimized}
                    onClick={() => handleVncDockClick(vnc)}
                />
            ))}

            {sftpWindows.map((sftp: any) => (
                <DockIcon
                    key={sftp.id}
                    icon={<Folder size={24} color="#fb923c" />}
                    label={`File Client: ${sftp.ip || 'Manager'}`}
                    isOpen={activeWindow === sftp.id && !sftp.isMinimized}
                    isMinimized={sftp.isMinimized}
                    onClick={() => handleSftpDockClick(sftp)}
                />
            ))}

            {dynamicWindows.map((dyn: any) => (
                <DockIcon
                    key={dyn.id}
                    icon={<StoreIcon size={24} color="#a78bfa" />}
                    label={dyn.title}
                    isOpen={activeWindow === dyn.id && !dyn.isMinimized}
                    isMinimized={dyn.isMinimized}
                    onClick={() => handleDynamicDockClick(dyn)}
                />
            ))}
        </Paper>
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
                className="dock-icon-button"
                onClick={onClick}
                style={{ opacity: isMinimized ? 0.4 : 1 }}
            >
                {icon}
                {isOpen && (
                    <Box className="dock-active-indicator" />
                )}
            </Box>
        </Tooltip>
    );
}


