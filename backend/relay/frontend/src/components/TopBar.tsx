import { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { AppBar, Toolbar, Typography, Box, Select, MenuItem, Button } from '@mui/material';

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
        <AppBar position="static" color="transparent" elevation={0} sx={{ 
            bgcolor: 'rgba(15, 23, 42, 0.65)', 
            backdropFilter: 'blur(16px)',
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
                    <Typography variant="caption" color="primary.light">{username}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Clock />
                    <Button size="small" color="error" startIcon={<LogOut size={14} />} onClick={onLogout} sx={{ textTransform: 'none' }}>
                        Logout
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
}
