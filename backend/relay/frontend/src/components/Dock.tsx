import React from 'react';
import { Network, Terminal, Folder, Monitor, Settings } from 'lucide-react';
import { Box, Paper, Tooltip } from '@mui/material';

interface DockProps {
    graphWindow: { isOpen: boolean; isMinimized: boolean };
    settingsWindow: { isOpen: boolean; isMinimized: boolean };
    activeWindow: string | null;
    terminals: { id: string; ip: string; isMinimized: boolean }[];
    vncWindows: { id: string; ip: string; isMinimized: boolean }[];
    sftpWindows: { id: string; ip: string; isMinimized: boolean }[];
    onGraphClick: () => void;
    onSettingsClick: () => void;
    onOpenTerminal: (ip: string) => void;
    onOpenSftp: (ip: string) => void;
    onOpenVnc: (ip: string) => void;
    onTerminalDockClick: (term: { id: string; isMinimized: boolean }) => void;
    onVncDockClick: (vnc: { id: string; isMinimized: boolean }) => void;
    onSftpDockClick: (sftp: { id: string; isMinimized: boolean }) => void;
}

export default function Dock({
    graphWindow,
    settingsWindow,
    activeWindow,
    terminals,
    vncWindows,
    sftpWindows,
    onGraphClick,
    onSettingsClick,
    onOpenTerminal,
    onOpenSftp,
    onOpenVnc,
    onTerminalDockClick,
    onVncDockClick,
    onSftpDockClick
}: DockProps) {
    return (
        <Paper elevation={16} sx={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.05)',
            padding: '10px 16px',
            borderRadius: '24px',
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
                onClick={onGraphClick}
            />
            <DockIcon
                icon={<Terminal size={24} color="#a78bfa" />}
                label="New SSH Terminal"
                isOpen={false}
                onClick={() => onOpenTerminal('')}
            />
            <DockIcon
                icon={<Folder size={24} color="#fb923c" />}
                label="New SFTP Client"
                isOpen={false}
                onClick={() => onOpenSftp('')}
            />
            <DockIcon
                icon={<Monitor size={24} color="#10b981" />}
                label="New VNC connection"
                isOpen={false}
                onClick={() => onOpenVnc('')}
            />
            <DockIcon
                icon={<Settings size={24} color="#94a3b8" />}
                label="Settings"
                isOpen={settingsWindow.isOpen}
                isMinimized={settingsWindow.isOpen && settingsWindow.isMinimized}
                onClick={onSettingsClick}
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
                    onClick={() => onTerminalDockClick(term)}
                />
            ))}

            {vncWindows.map(vnc => (
                <DockIcon
                    key={vnc.id}
                    icon={<Monitor size={24} color="#10b981" />}
                    label={`VNC: ${vnc.ip}`}
                    isOpen={activeWindow === vnc.id && !vnc.isMinimized}
                    isMinimized={vnc.isMinimized}
                    onClick={() => onVncDockClick(vnc)}
                />
            ))}

            {sftpWindows.map(sftp => (
                <DockIcon
                    key={sftp.id}
                    icon={<Folder size={24} color="#fb923c" />}
                    label={`SFTP: ${sftp.ip}`}
                    isOpen={activeWindow === sftp.id && !sftp.isMinimized}
                    isMinimized={sftp.isMinimized}
                    onClick={() => onSftpDockClick(sftp)}
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
                onClick={onClick}
                sx={{
                    width: 48,
                    height: 48,
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '16px',
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
