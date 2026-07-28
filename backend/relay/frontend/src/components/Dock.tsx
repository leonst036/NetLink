import React from 'react';
import { Network, Terminal, Folder, Monitor, Settings } from 'lucide-react';
import { Box, Paper, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useWindowStore } from '../store/useWindowStore';

export default function Dock() {
    const { 
        graphWindow, settingsWindow, activeWindow, 
        terminals, vncWindows, sftpWindows,
        setGraphWindow, setSettingsWindow, bringToFront,
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

    return (
        <DockContainer elevation={16}>
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

            {(terminals.length > 0 || vncWindows.length > 0 || sftpWindows.length > 0) && (
                <DockDivider />
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
        </DockContainer>
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
            <DockIconButton
                onClick={onClick}
                $isMinimized={isMinimized}
            >
                {icon}
                {isOpen && (
                    <ActiveIndicator />
                )}
            </DockIconButton>
        </Tooltip>
    );
}

const DockContainer = styled(Paper)(({ theme }) => ({
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.05)',
    padding: '10px 16px',
    borderRadius: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    zIndex: 9999
}));

const DockDivider = styled(Box)({
    width: '1px',
    backgroundColor: 'rgba(255,255,255,0.2)',
    height: 24
});

interface DockIconButtonProps {
    $isMinimized?: boolean;
}

const DockIconButton = styled(Box)<DockIconButtonProps>(({ $isMinimized }) => ({
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.2s',
    opacity: $isMinimized ? 0.4 : 1,
    '&:hover': {
        transform: 'translateY(-5px) scale(1.1)',
        backgroundColor: 'rgba(255, 255, 255, 0.1)'
    }
}));

const ActiveIndicator = styled(Box)({
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: '50%',
    backgroundColor: '#f8fafc'
});
