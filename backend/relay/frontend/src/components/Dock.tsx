import React, { useState } from 'react';
import { StoreIcon, Pin, PinOff, Play, X } from 'lucide-react';
import { Box, Paper, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import './Dock.css';
import { useWindowStore } from '../store/useWindowStore';
import type { PinnedApp, DynamicAppInstance } from '../types';

export default function Dock() {
    const {
        storeWindow, activeWindow,
        dynamicWindows, pinnedApps, maximizedWindows,
        setStoreWindow, bringToFront,
        openDynamicApp, closeDynamicApp,
        pinApp, unpinApp, isPinned
    } = useWindowStore();

    const [isHovered, setIsHovered] = useState(false);
    const hasMaximized = maximizedWindows.length > 0;
    const isHidden = hasMaximized && !isHovered;

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{
        mouseX: number;
        mouseY: number;
        appId: string;
        title: string;
        color?: string;
        instanceId?: string;
        isPinned: boolean;
        isRunning: boolean;
    } | null>(null);

    const handleContextMenu = (
        e: React.MouseEvent,
        appId: string,
        title: string,
        color?: string,
        instanceId?: string
    ) => {
        e.preventDefault();
        const running = Boolean(instanceId || dynamicWindows.some(w => w.appId === appId));
        const pinned = isPinned(appId);
        setContextMenu({
            mouseX: e.clientX - 2,
            mouseY: e.clientY - 4,
            appId,
            title,
            color,
            instanceId,
            isPinned: pinned,
            isRunning: running
        });
    };

    const handleCloseContextMenu = () => {
        setContextMenu(null);
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

    const handleDynamicDockClick = (dyn: DynamicAppInstance) => {
        if (dyn.isMinimized) {
            useWindowStore.getState().minimizeDynamicApp(dyn.id, false);
            bringToFront(dyn.id);
        } else if (activeWindow === dyn.id) {
            useWindowStore.getState().minimizeDynamicApp(dyn.id, true);
        } else {
            bringToFront(dyn.id);
        }
    };

    // Unpinned running dynamic apps
    const unpinnedRunningApps = dynamicWindows.filter(
        (dyn) => !pinnedApps.some((p) => p.appId === dyn.appId)
    );

    const hasExtraItems = pinnedApps.length > 0 || unpinnedRunningApps.length > 0;

    return (
        <>
            {hasMaximized && (
                <Box 
                    className="dock-trigger" 
                    onMouseEnter={() => setIsHovered(true)} 
                />
            )}
            <Paper 
                className={`dock-container ${isHidden ? 'dock-hidden' : ''}`} 
                elevation={16}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
            <DockIcon
                icon={<StoreIcon size={24} color="#ec4899" />}
                label="NetStore"
                isOpen={storeWindow.isOpen}
                isMinimized={storeWindow.isOpen && storeWindow.isMinimized}
                onClick={handleStoreClick}
            />

            {hasExtraItems && <Box className="dock-divider" />}

            {/* Pinned Apps */}
            {pinnedApps.map((pinned: PinnedApp) => {
                const runningInstance = dynamicWindows.find(w => w.appId === pinned.appId);
                const isRunning = Boolean(runningInstance);
                const isOpen = isRunning && activeWindow === runningInstance!.id && !runningInstance!.isMinimized;
                const isMinimized = isRunning ? runningInstance!.isMinimized : false;

                return (
                    <DockIcon
                        key={`pinned-${pinned.appId}`}
                        icon={<StoreIcon size={24} color={pinned.color || "#a78bfa"} />}
                        label={`${pinned.title}${isRunning ? '' : ' (Pinned)'}`}
                        isOpen={isOpen}
                        isMinimized={isMinimized}
                        isPinned={true}
                        onClick={() => {
                            if (runningInstance) {
                                handleDynamicDockClick(runningInstance);
                            } else {
                                openDynamicApp(pinned.appId, pinned.title);
                            }
                        }}
                        onContextMenu={(e) =>
                            handleContextMenu(e, pinned.appId, pinned.title, pinned.color, runningInstance?.id)
                        }
                    />
                );
            })}

            {/* Unpinned Running Dynamic Apps */}
            {unpinnedRunningApps.map((dyn: DynamicAppInstance) => (
                <DockIcon
                    key={dyn.id}
                    icon={<StoreIcon size={24} color="#a78bfa" />}
                    label={dyn.title}
                    isOpen={activeWindow === dyn.id && !dyn.isMinimized}
                    isMinimized={dyn.isMinimized}
                    onClick={() => handleDynamicDockClick(dyn)}
                    onContextMenu={(e) =>
                        handleContextMenu(e, dyn.appId, dyn.title, undefined, dyn.id)
                    }
                />
            ))}

            {/* Right Click Context Menu */}
            <Menu
                open={contextMenu !== null}
                onClose={handleCloseContextMenu}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
            >
                {contextMenu && (
                    <>
                        <MenuItem
                            onClick={() => {
                                const instance = dynamicWindows.find(w => w.appId === contextMenu.appId);
                                if (instance) {
                                    handleDynamicDockClick(instance);
                                } else {
                                    openDynamicApp(contextMenu.appId, contextMenu.title);
                                }
                                handleCloseContextMenu();
                            }}
                        >
                            <ListItemIcon><Play size={16} /></ListItemIcon>
                            <ListItemText>{contextMenu.isRunning ? 'Focus' : 'Open'}</ListItemText>
                        </MenuItem>

                        {contextMenu.isPinned ? (
                            <MenuItem
                                onClick={() => {
                                    unpinApp(contextMenu.appId);
                                    handleCloseContextMenu();
                                }}
                            >
                                <ListItemIcon><PinOff size={16} /></ListItemIcon>
                                <ListItemText>Unpin from Dock</ListItemText>
                            </MenuItem>
                        ) : (
                            <MenuItem
                                onClick={() => {
                                    pinApp({
                                        appId: contextMenu.appId,
                                        title: contextMenu.title,
                                        color: contextMenu.color
                                    });
                                    handleCloseContextMenu();
                                }}
                            >
                                <ListItemIcon><Pin size={16} /></ListItemIcon>
                                <ListItemText>Pin to Dock</ListItemText>
                            </MenuItem>
                        )}

                        {contextMenu.isRunning && contextMenu.instanceId && (
                            <MenuItem
                                onClick={() => {
                                    closeDynamicApp(contextMenu.instanceId!);
                                    handleCloseContextMenu();
                                }}
                                sx={{ color: 'error.main' }}
                            >
                                <ListItemIcon><X size={16} color="red" /></ListItemIcon>
                                <ListItemText>Close</ListItemText>
                            </MenuItem>
                        )}
                    </>
                )}
            </Menu>
            </Paper>
        </>
    );
}

function DockIcon({
    icon,
    label,
    onClick,
    onContextMenu,
    isOpen,
    isMinimized = false,
    isPinned = false
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    isOpen: boolean;
    isMinimized?: boolean;
    isPinned?: boolean;
}) {
    return (
        <Tooltip title={label} arrow placement="top">
            <Box
                className={`dock-icon-button ${isPinned ? 'dock-pinned-icon' : ''}`}
                onClick={onClick}
                onContextMenu={onContextMenu}
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
