import { useState, useEffect, useRef, MouseEvent } from 'react';
import { LogOut, Bell, Trash2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { AppBar, Toolbar, Typography, Box, Select, MenuItem, Button, IconButton, Badge, Popover, List, ListItem, ListItemIcon, ListItemText, Tooltip, Divider } from '@mui/material';
import { useNotificationStore } from '../store/useNotificationStore';
import './TopBar.css';

interface TopBarProps {
    target: string;
    setTarget: (t: string) => void;
    allowedTargets: string[];
    username: string;
    onLogout: () => void;
}

function Clock() {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    return <Typography variant="caption">{time.toLocaleTimeString()}</Typography>;
}

export default function TopBar({ target, setTarget, allowedTargets, username, onLogout }: TopBarProps) {
    const { notifications, history, clearHistory } = useNotificationStore();
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = (event: MouseEvent<HTMLElement>) => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
        setAnchorEl(event.currentTarget);
    };

    const handleMouseLeave = () => {
        closeTimeoutRef.current = setTimeout(() => {
            setAnchorEl(null);
        }, 200);
    };

    const handlePopoverMouseEnter = () => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
    };

    const handleClick = (event: MouseEvent<HTMLElement>) => {
        if (anchorEl) {
            setAnchorEl(null);
        } else {
            setAnchorEl(event.currentTarget);
        }
    };

    const open = Boolean(anchorEl);

    const getNotificationIcon = (type: 'info' | 'success' | 'error') => {
        switch (type) {
            case 'success':
                return <CheckCircle2 size={14} color="#4caf50" />;
            case 'error':
                return <AlertTriangle size={14} color="#f44336" />;
            default:
                return <Info size={14} color="#29b6f6" />;
        }
    };

    return (
        <AppBar position="static" color="transparent" elevation={0} className="topbar-appbar">
            <Toolbar variant="dense" className="topbar-toolbar">
                <Box className="topbar-left-section">
                    <Typography variant="subtitle2" className="topbar-brand-text">NetLink OS</Typography>
                    <Box className="topbar-target-wrapper">
                        <Typography variant="caption" color="text.secondary">Target:</Typography>
                        {allowedTargets && allowedTargets.length > 0 ? (
                            <Select
                                size="small"
                                className="topbar-target-select"
                                value={target}
                                onChange={(e) => {
                                    setTarget(e.target.value as string);
                                    localStorage.setItem('netlink_target', e.target.value as string);
                                }}
                            >
                                {allowedTargets.map(t => (
                                    <MenuItem key={t} value={t}>{t}</MenuItem>
                                ))}
                            </Select>
                        ) : (
                            <Typography variant="caption">{target}</Typography>
                        )}
                    </Box>
                    <Typography variant="caption" color="primary.light">{username}</Typography>
                </Box>
                <Box className="topbar-right-section">
                    <Box
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        onClick={handleClick}
                        sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                    >
                        <Tooltip title="Notifications">
                            <IconButton size="small" className="topbar-icon-button" color="inherit">
                                <Badge badgeContent={notifications.length > 0 ? notifications.length : history.length} color={notifications.length > 0 ? "error" : "default"} max={99}>
                                    <Bell size={16} />
                                </Badge>
                            </IconButton>
                        </Tooltip>
                    </Box>
                    <Popover
                        open={open}
                        anchorEl={anchorEl}
                        onClose={() => setAnchorEl(null)}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                        PaperProps={{
                            className: 'topbar-notifications-popover',
                            onMouseEnter: handlePopoverMouseEnter,
                            onMouseLeave: handleMouseLeave
                        }}
                        sx={{ pointerEvents: 'auto' }}
                    >
                        <Box sx={{ p: 1.5, minWidth: 280, maxWidth: 360, maxHeight: 380, overflowY: 'auto' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                    Recent Notifications
                                </Typography>
                                {history.length > 0 && (
                                    <Tooltip title="Clear history">
                                        <IconButton size="small" onClick={clearHistory} sx={{ color: 'rgba(255,255,255,0.6)', p: 0.5 }}>
                                            <Trash2 size={13} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 1 }} />
                            {history.length === 0 ? (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 2 }}>
                                    No recent notifications
                                </Typography>
                            ) : (
                                <List disablePadding>
                                    {history.map((n) => (
                                        <ListItem
                                            key={n.id}
                                            disableGutters
                                            sx={{
                                                py: 0.75,
                                                px: 1,
                                                borderRadius: 1,
                                                mb: 0.5,
                                                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.07)' }
                                            }}
                                        >
                                            <ListItemIcon sx={{ minWidth: 24 }}>
                                                {getNotificationIcon(n.type)}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={n.message}
                                                secondary={n.timestamp}
                                                primaryTypographyProps={{ variant: 'caption', color: 'text.primary', sx: { lineHeight: 1.3 } }}
                                                secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary', sx: { fontSize: '0.7rem' } }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            )}
                        </Box>
                    </Popover>
                    <Clock />
                    <Button size="small" color="error" className="topbar-logout-button" startIcon={<LogOut size={14} />} onClick={onLogout}>
                        Logout
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
}




