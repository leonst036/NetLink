import { Box, Typography, Button, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Chip } from '@mui/material';
import { AlertTriangle, ShieldAlert, Terminal, Folder, Globe, Key } from 'lucide-react';

interface FolderRequest {
    path: string;
    reason?: string;
    mode?: string;
}

interface RequestedPermissions {
    allowRun?: boolean;
    allowRunCommands?: string[];
    allowEnv?: string[];
    allowNet?: boolean | string[];
}

interface PermissionModalProps {
    open: boolean;
    appId: string;
    appName: string;
    folders?: FolderRequest[];
    requestedPermissions?: RequestedPermissions;
    onRespond: (appId: string, granted: boolean, permissions: any) => void;
}

export default function PermissionModal({ open, appId, appName, folders = [], requestedPermissions, onRespond }: PermissionModalProps) {
    if (!open) return null;

    const handleGrant = () => {
        const perms = {
            folders: folders.map(f => f.path),
            allowRun: Boolean(requestedPermissions?.allowRun),
            allowEnv: requestedPermissions?.allowEnv || [],
            allowNet: Boolean(requestedPermissions?.allowNet)
        };
        onRespond(appId, true, perms);
    };

    const handleDeny = () => {
        onRespond(appId, false, null);
    };

    const hasRun = Boolean(requestedPermissions?.allowRun);
    const hasEnv = Array.isArray(requestedPermissions?.allowEnv) && requestedPermissions.allowEnv.length > 0;
    const hasNet = Boolean(requestedPermissions?.allowNet);
    const hasFolders = folders.length > 0;

    return (
        <Dialog open={open} maxWidth="sm" fullWidth slotProps={{ paper: { style: { backgroundColor: '#1e293b', color: '#fff' } } }}>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <ShieldAlert size={24} color="#ef4444" />
                Permission Request: {appName}
            </DialogTitle>
            <DialogContent sx={{ pt: 3 }}>
                <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
                    The application <strong>{appName}</strong> is requesting elevated system permissions.
                </Typography>

                <Box sx={{ background: 'rgba(0,0,0,0.3)', p: 2, borderRadius: 1.5, mb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {hasRun && (
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                            <Terminal size={20} color="#f59e0b" style={{ marginTop: 2 }} />
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#f59e0b' }}>
                                    Host Command Execution (--allow-run)
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                    Allows the application to run system shell commands on the host machine.
                                    {requestedPermissions?.allowRunCommands && requestedPermissions.allowRunCommands.length > 0 && (
                                        <span> (Commands: <code>{requestedPermissions.allowRunCommands.join(', ')}</code>)</span>
                                    )}
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {hasFolders && (
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                            <Folder size={20} color="#38bdf8" style={{ marginTop: 2 }} />
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#38bdf8' }}>
                                    External Host Folders
                                </Typography>
                                {folders.map((f, i) => (
                                    <Box key={i} sx={{ mt: 0.5 }}>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#e2e8f0' }}>
                                            {f.path} <Chip label={f.mode === 'write' ? 'Read/Write' : 'Read-Only'} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                                        </Typography>
                                        {f.reason && <Typography variant="caption" sx={{ color: '#94a3b8' }}>Reason: {f.reason}</Typography>}
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    )}

                    {hasEnv && (
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                            <Key size={20} color="#a855f7" style={{ marginTop: 2 }} />
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#a855f7' }}>
                                    Environment Variables
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                    Requested variables: <code>{requestedPermissions?.allowEnv?.join(', ')}</code>
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {hasNet && (
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                            <Globe size={20} color="#10b981" style={{ marginTop: 2 }} />
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#10b981' }}>
                                    Outbound Network Access
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                    Allows external network requests from the Deno backend.
                                </Typography>
                            </Box>
                        </Box>
                    )}
                </Box>

                <Alert severity="error" icon={<AlertTriangle />} sx={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }}>
                    <strong>Security Warning:</strong> Granting elevated permissions allows this app to interact directly with system resources. Only approve requests from trusted applications.
                </Alert>
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <Button 
                    onClick={handleDeny} 
                    variant="outlined" 
                    color="inherit" 
                    sx={{ borderColor: 'rgba(255,255,255,0.2)' }}
                >
                    Deny Request
                </Button>
                <Button 
                    onClick={handleGrant} 
                    variant="contained" 
                    color="error"
                >
                    Allow Access
                </Button>
            </DialogActions>
        </Dialog>
    );
}
