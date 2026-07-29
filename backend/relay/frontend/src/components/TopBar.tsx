import { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { AppBar, Toolbar, Typography, Box, Select, MenuItem, Button } from '@mui/material';
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
                    <Clock />
                    <Button size="small" color="error" className="topbar-logout-button" startIcon={<LogOut size={14} />} onClick={onLogout}>
                        Logout
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
}


