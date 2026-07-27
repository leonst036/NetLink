import { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { AppBar, Toolbar, Typography, Box, Select, MenuItem, Button } from '@mui/material';
import { styled } from '@mui/material/styles';

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
        <TopBarAppBar position="static" color="transparent" elevation={0}>
            <TopBarToolbar variant="dense">
                <LeftSection>
                    <BrandText variant="subtitle2">NetLink OS</BrandText>
                    <TargetWrapper>
                        <Typography variant="caption" color="text.secondary">Target:</Typography>
                        {allowedTargets && allowedTargets.length > 0 ? (
                            <TargetSelect
                                size="small"
                                value={target}
                                onChange={(e) => {
                                    setTarget(e.target.value as string);
                                    localStorage.setItem('netlink_target', e.target.value as string);
                                }}
                            >
                                {allowedTargets.map(t => (
                                    <MenuItem key={t} value={t}>{t}</MenuItem>
                                ))}
                            </TargetSelect>
                        ) : (
                            <Typography variant="caption">{target}</Typography>
                        )}
                    </TargetWrapper>
                    <Typography variant="caption" color="primary.light">{username}</Typography>
                </LeftSection>
                <RightSection>
                    <Clock />
                    <LogoutButton size="small" color="error" startIcon={<LogOut size={14} />} onClick={onLogout}>
                        Logout
                    </LogoutButton>
                </RightSection>
            </TopBarToolbar>
        </TopBarAppBar>
    );
}

const TopBarAppBar = styled(AppBar)({
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    zIndex: 9999
});

const TopBarToolbar = styled(Toolbar)({
    justifyContent: 'space-between',
    minHeight: '32px !important'
});

const LeftSection = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2)
}));

const BrandText = styled(Typography)(({ theme }) => ({
    fontWeight: 'bold',
    color: theme.palette.text.primary
}));

const TargetWrapper = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1)
}));

const TargetSelect = styled(Select)(({ theme }) => ({
    height: 24,
    fontSize: '0.8rem',
    color: theme.palette.text.primary,
    '& .MuiSelect-select': {
        paddingTop: 0,
        paddingBottom: 0
    }
}));

const RightSection = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2)
}));

const LogoutButton = styled(Button)({
    textTransform: 'none'
});
