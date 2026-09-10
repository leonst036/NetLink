import React, { useState } from 'react';
import { StoreIcon, Pin, PinOff, Play, X } from 'lucide-react';
import { Box, Paper, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import './Dock.css';
import { useWindowStore } from '../store/useWindowStore';
import type { PinnedApp, DynamicAppInstance } from '../types';
import AppIcon from './AppIcon';

export default function Dock() {
    const {
        storeWindow, domainRouteWindow, activeWindow,
        dynamicWindows, pinnedApps, maximizedWindows,
        setStoreWindow, setDomainRouteWindow, bringToFront,
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
        icon?: string;
        color?: string;
        instanceId?: string;
        isPinned: boolean;
        isRunning: boolean;
    } | null>(null);

    const handleContextMenu = (
        e: React.MouseEvent,
        appId: string,
        title: string,
        icon?: string,
        color?: string,
        instanceId?: string
    ) => {
        e.preventDefault();
        const isDomainRoute = appId === 'domain-route';
        const running = Boolean(instanceId || (isDomainRoute ? domainRouteWindow.isOpen : dynamicWindows.some(w => w.appId === appId)));
        const pinned = isPinned(appId);
        setContextMenu({
            mouseX: e.clientX - 2,
            mouseY: e.clientY - 4,
            appId,
            title,
            icon,
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

    const handleDomainRouteClick = () => {
        if (!domainRouteWindow.isOpen) {
            setDomainRouteWindow({ isOpen: true, isMinimized: false, zIndex: 1 });
            bringToFront('domain-route');
        } else if (domainRouteWindow.isMinimized) {
            setDomainRouteWindow({ isMinimized: false });
            bringToFront('domain-route');
        } else if (activeWindow === 'domain-route') {
            setDomainRouteWindow({ isMinimized: true });
        } else {
            bringToFront('domain-route');
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

                {/* Pinned Apps */}
                {pinnedApps.map((pinned: PinnedApp) => {
                    const isDomainRoute = pinned.appId === 'domain-route';
                    const runningInstance = !isDomainRoute ? dynamicWindows.find(w => w.appId === pinned.appId) : null;
                    const isRunning = isDomainRoute ? domainRouteWindow.isOpen : Boolean(runningInstance);
                    const isOpen = isDomainRoute
                        ? (domainRouteWindow.isOpen && activeWindow === 'domain-route' && !domainRouteWindow.isMinimized)
                        : (isRunning && activeWindow === runningInstance!.id && !runningInstance!.isMinimized);
                    const isMinimized = isDomainRoute
                        ? (domainRouteWindow.isOpen && domainRouteWindow.isMinimized)
                        : (isRunning ? runningInstance!.isMinimized : false);

                    return (
                        <DockIcon
                            key={`pinned-${pinned.appId}`}
                            icon={<AppIcon appId={pinned.appId} icon={pinned.icon} color={pinned.color} size={24} />}
                            label={`${pinned.title}${isRunning ? '' : ' (Pinned)'}`}
                            isOpen={isOpen}
                            isMinimized={isMinimized}
                            isPinned={true}
                            onClick={() => {
                                if (isDomainRoute) {
                                    handleDomainRouteClick();
                                } else if (runningInstance) {
                                    handleDynamicDockClick(runningInstance);
                                } else {
                                    openDynamicApp(pinned.appId, pinned.title, undefined, pinned.icon, pinned.color);
                                }
                            }}
                            onContextMenu={(e) =>
                                handleContextMenu(
                                    e,
                                    pinned.appId,
                                    pinned.title,
                                    pinned.icon,
                                    pinned.color,
                                    isDomainRoute ? (domainRouteWindow.isOpen ? 'domain-route' : undefined) : runningInstance?.id
                                )
                            }
                        />
                    );
                })}

                {/* Unpinned Running Dynamic Apps */}
                {(unpinnedRunningApps.length > 0 || (domainRouteWindow.isOpen && !isPinned('domain-route'))) && <Box className="dock-divider" />}
                {domainRouteWindow.isOpen && !isPinned('domain-route') && (
                    <DockIcon
                        key="unpinned-domain-route"
                        icon={<AppIcon appId="domain-route" icon="Route" color="#38bdf8" size={24} />}
                        label="DomainRoute"
                        isOpen={activeWindow === 'domain-route' && !domainRouteWindow.isMinimized}
                        isMinimized={domainRouteWindow.isMinimized}
                        onClick={handleDomainRouteClick}
                        onContextMenu={(e) =>
                            handleContextMenu(e, 'domain-route', 'DomainRoute', 'Route', '#38bdf8', 'domain-route')
                        }
                    />
                )}
                {unpinnedRunningApps.map((dyn: DynamicAppInstance) => (
                    <DockIcon
                        key={dyn.id}
                        icon={<AppIcon appId={dyn.appId} icon={dyn.icon} color={dyn.color} size={24} />}
                        label={dyn.title}
                        isOpen={activeWindow === dyn.id && !dyn.isMinimized}
                        isMinimized={dyn.isMinimized}
                        onClick={() => handleDynamicDockClick(dyn)}
                        onContextMenu={(e) =>
                            handleContextMenu(e, dyn.appId, dyn.title, dyn.icon, dyn.color, dyn.id)
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
                                    if (contextMenu.appId === 'domain-route') {
                                        handleDomainRouteClick();
                                    } else {
                                        const instance = dynamicWindows.find(w => w.appId === contextMenu.appId);
                                        if (instance) {
                                            handleDynamicDockClick(instance);
                                        } else {
                                            openDynamicApp(contextMenu.appId, contextMenu.title, undefined, contextMenu.icon, contextMenu.color);
                                        }
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
                                            icon: contextMenu.icon,
                                            color: contextMenu.color
                                        });
                                        handleCloseContextMenu();
                                    }}
                                >
                                    <ListItemIcon><Pin size={16} /></ListItemIcon>
                                    <ListItemText>Pin to Dock</ListItemText>
                                </MenuItem>
                            )}

                            {contextMenu.isRunning && (contextMenu.instanceId || contextMenu.appId === 'domain-route') && (
                                <MenuItem
                                    onClick={() => {
                                        if (contextMenu.appId === 'domain-route') {
                                            setDomainRouteWindow({ isOpen: false });
                                        } else if (contextMenu.instanceId) {
                                            closeDynamicApp(contextMenu.instanceId);
                                        }
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
