import React, { useState } from 'react';
import { type AppItem } from '../types';
import {
    Dialog,
    DialogTitle,
    Box,
    Typography,
    IconButton,
    DialogContent,
    DialogActions,
    Button,
} from '@mui/material';
import {
    Star,
    X,
    Pin,
    PinOff,
    Trash2,
    RefreshCw,
    ExternalLink,
    Download,
} from 'lucide-react';

export interface AppDetailsDialogProps {
    app: AppItem | null;
    isOpen: boolean;
    onClose: () => void;
    isInstalled: boolean;
    isPinned: boolean;
    installedVersion?: string;
    installProgress?: number;
    onOpenApp: (app: AppItem, e?: React.MouseEvent) => void;
    onInstall: (app: AppItem, e?: React.MouseEvent, runInBackground?: boolean) => void;
    onUninstall: (app: AppItem, e?: React.MouseEvent) => void;
    onTogglePin: (app: AppItem, e?: React.MouseEvent) => void;
}

export const AppDetailsDialog = ({
    app,
    isOpen,
    onClose,
    isInstalled,
    isPinned,
    installedVersion,
    installProgress,
    onOpenApp,
    onInstall,
    onUninstall,
    onTogglePin,
}: AppDetailsDialogProps) => {
    const [runInBackground, setRunInBackground] = useState<boolean>(false);

    const handleClose = () => {
        setRunInBackground(false);
        onClose();
    };

    if (!app) return null;

    const isInstalling = installProgress !== undefined;

    return (
        <Dialog
            open={isOpen}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    className: 'netstore-dialog-paper',
                    sx: {
                        backgroundColor: '#0f172a',
                        backgroundImage: 'none',
                        color: '#fff',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
                    },
                },
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box className="netstore-icon-box" sx={{ width: 40, height: 40 }}>
                        {app.icon}
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {app.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {app.author}
                        </Typography>
                    </Box>
                </Box>
                <IconButton size="small" onClick={handleClose}>
                    <X size={18} />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                {/* Meta Row */}
                <Box
                    sx={{
                        display: 'flex',
                        gap: 2,
                        mb: 3,
                        p: 1.5,
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        borderRadius: 1.5,
                        border: '1px solid rgba(255,255,255,0.05)',
                    }}
                >
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                            Rating
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 0.5,
                            }}
                        >
                            <Star size={12} fill="#fbbf24" color="#fbbf24" /> {app.rating}
                        </Typography>
                    </Box>
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                            Downloads
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {app.downloads}
                        </Typography>
                    </Box>
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                            Size
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {app.size}
                        </Typography>
                    </Box>
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                            Version
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {app.version}
                        </Typography>
                    </Box>
                </Box>

                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    About
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.6 }}>
                    {app.fullDesc}
                </Typography>

                {app.features && app.features.length > 0 && (
                    <>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                            Features
                        </Typography>
                        <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
                            {app.features.map((feat, i) => (
                                <Typography key={i} component="li" variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                    {feat}
                                </Typography>
                            ))}
                        </Box>
                    </>
                )}
            </DialogContent>

            <DialogActions
                className="netstore-dialog-actions"
                sx={{
                    px: 3,
                    py: 2,
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: 1.5,
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                }}
            >
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                    <Button
                        size="small"
                        color={isPinned ? 'secondary' : 'inherit'}
                        variant="outlined"
                        startIcon={isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                        onClick={(e) => {
                            e.stopPropagation();
                            onTogglePin(app, e);
                        }}
                        sx={{ whiteSpace: 'nowrap' }}
                    >
                        {isPinned ? 'Unpin' : 'Pin to Dock'}
                    </Button>
                    {isInstalled && !app.nativeKey && (
                        <>
                            <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                disabled={isInstalling}
                                startIcon={<Trash2 size={16} />}
                                onClick={(e) => {
                                    onUninstall(app, e);
                                    handleClose();
                                }}
                                sx={{ whiteSpace: 'nowrap' }}
                            >
                                Uninstall
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                color="info"
                                disabled={isInstalling}
                                startIcon={<RefreshCw size={16} className={isInstalling ? "spin-icon" : undefined} />}
                                onClick={(e) => {
                                    onInstall(app, e);
                                }}
                                sx={{ whiteSpace: 'nowrap' }}
                            >
                                {isInstalling
                                    ? 'Updating...'
                                    : (installedVersion && app.version && installedVersion !== app.version
                                        ? 'Update App'
                                        : 'Reinstall App')}
                            </Button>
                        </>
                    )}
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', ml: 'auto' }}>
                    {!isInstalled && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                            <input
                                type="checkbox"
                                id="runInBackground"
                                checked={runInBackground}
                                disabled={isInstalling}
                                onChange={(e) => setRunInBackground(e.target.checked)}
                                style={{ marginRight: '8px', cursor: 'pointer', accentColor: '#38bdf8' }}
                            />
                            <label
                                htmlFor="runInBackground"
                                style={{
                                    fontSize: '0.85rem',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                }}
                            >
                                Run in background
                            </label>
                        </Box>
                    )}
                    <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        onClick={handleClose}
                        sx={{ whiteSpace: 'nowrap', borderColor: 'rgba(255,255,255,0.2)' }}
                    >
                        Close
                    </Button>
                    {isInstalled ? (
                        <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<ExternalLink size={16} />}
                            onClick={(e) => {
                                onOpenApp(app, e);
                                handleClose();
                            }}
                            sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}
                        >
                            Open App
                        </Button>
                    ) : (
                        <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            disabled={isInstalling}
                            startIcon={<Download size={16} className={isInstalling ? "spin-icon" : undefined} />}
                            onClick={(e) => {
                                onInstall(app, e, runInBackground);
                            }}
                            sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}
                        >
                            {isInstalling ? 'Installing...' : 'Install'}
                        </Button>
                    )}
                </Box>
            </DialogActions>
        </Dialog>
    );
};

export default AppDetailsDialog;