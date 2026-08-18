import type React from 'react';
import { type AppItem } from '../types';
import { Box, Card, Typography, Chip, LinearProgress, Button, Tooltip, IconButton } from '@mui/material';
import { Star, Pin, PinOff, ExternalLink, RefreshCw, Trash2, Download } from 'lucide-react';

export interface AppCardProps {
    app: AppItem;
    isInstalled: boolean;
    isPinned: boolean;
    installedVersion?: string;
    installProgress?: number;
    onSelect: (app: AppItem) => void;
    onOpenApp: (app: AppItem, e: React.MouseEvent) => void;
    onInstall: (app: AppItem, e: React.MouseEvent) => void;
    onUninstall: (app: AppItem, e: React.MouseEvent) => void;
    onTogglePin: (app: AppItem, e: React.MouseEvent) => void;
}

export const AppCard = ({
    app,
    isInstalled,
    isPinned,
    installedVersion,
    installProgress,
    onSelect,
    onOpenApp,
    onInstall,
    onUninstall,
    onTogglePin
}: AppCardProps) => {
    return (
        <Card
            className="netstore-app-card"
            variant="outlined"
            onClick={() => onSelect(app)}
        >
            <Box className="netstore-card-body">
                <Box className="netstore-card-header">
                    <Box className="netstore-icon-box">
                        {app.icon}
                    </Box>
                    <Box className="netstore-card-meta">
                        <Typography className="netstore-app-name">
                            {app.name}
                        </Typography>
                        <Typography className="netstore-app-author">
                            {app.author}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                            <Chip
                                label={app.category}
                                size="small"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.675rem' }}
                            />
                            <Chip
                                label={app.size}
                                size="small"
                                variant="outlined"
                                color="info"
                                sx={{ height: 20, fontSize: '0.675rem', opacity: 0.85 }}
                            />
                        </Box>
                    </Box>
                </Box>

                <Typography className="netstore-card-desc">
                    {app.shortDesc}
                </Typography>

                {installProgress !== undefined && (
                    <Box sx={{ width: '100%', mt: 1 }}>
                        <LinearProgress variant="determinate" value={installProgress} color="secondary" />
                    </Box>
                )}

                <Box className="netstore-card-actions">
                    <Box className="netstore-rating">
                        <Star size={12} fill="#fbbf24" color="#fbbf24" /> {app.rating}
                    </Box>

                    {installProgress !== undefined ? (
                        <Button size="small" variant="outlined" disabled startIcon={<RefreshCw size={14} className="spin-icon" />}>
                            Installing...
                        </Button>
                    ) : isInstalled ? (
                        app.nativeKey ? (
                            <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                startIcon={<ExternalLink size={14} />}
                                onClick={(e) => onOpenApp(app, e)}
                            >
                                Open
                            </Button>
                        ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Tooltip title={isPinned ? "Unpin from Dock" : "Pin to Dock"} arrow placement="top">
                                    <IconButton
                                        size="small"
                                        color={isPinned ? "secondary" : "default"}
                                        onClick={(e) => onTogglePin(app, e)}
                                        sx={{ padding: '4px' }}
                                    >
                                        {isPinned ? <PinOff size={15} /> : <Pin size={15} />}
                                    </IconButton>
                                </Tooltip>

                                <Tooltip title="Uninstall App" arrow placement="top">
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={(e) => onUninstall(app, e)}
                                        sx={{ padding: '4px' }}
                                    >
                                        <Trash2 size={15} />
                                    </IconButton>
                                </Tooltip>

                                <Tooltip title={installedVersion && app.version && installedVersion !== app.version ? "Update App" : "Reinstall App"} arrow placement="top">
                                    <IconButton
                                        size="small"
                                        color={installedVersion && app.version && installedVersion !== app.version ? "info" : "default"}
                                        onClick={(e) => onInstall(app, e)}
                                        sx={{ padding: '4px' }}
                                    >
                                        <RefreshCw size={15} />
                                    </IconButton>
                                </Tooltip>

                                <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    startIcon={<ExternalLink size={14} />}
                                    onClick={(e) => onOpenApp(app, e)}
                                    sx={{ ml: 0.5 }}
                                >
                                    Open
                                </Button>
                            </Box>
                        )
                    ) : (
                        <Button
                            size="small"
                            variant="contained"
                            color="secondary"
                            startIcon={<Download size={14} />}
                            onClick={(e) => onInstall(app, e)}
                        >
                            Install
                        </Button>
                    )}
                </Box>
            </Box>
        </Card>
    );
};

export default AppCard;