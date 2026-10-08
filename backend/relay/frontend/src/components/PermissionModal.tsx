import { Box, Typography, Button, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Chip } from '@mui/material';
import { AlertTriangle, ShieldAlert, Terminal, Folder, Globe, Key, Database } from 'lucide-react';

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
    allowDatabase?: boolean;
    database?: boolean;
    collections?: string[];
}

interface PermissionModalProps {
    open: boolean;
    appId: string;
    appName: string;
    folders?: FolderRequest[];
    requestedPermissions?: RequestedPermissions;
    requestedCollections?: string[];
    allowDatabase?: boolean;
    onRespond: (appId: string, granted: boolean, permissions: any) => void;
}

export default function PermissionModal({ 
    open, 
    appId, 
    appName, 
    folders = [], 
    requestedPermissions, 
    requestedCollections = [], 
    allowDatabase = false,
    onRespond 
}: PermissionModalProps) {
    if (!open) return null;

    const allCollections = requestedCollections.length > 0 ? requestedCollections : (requestedPermissions?.collections || []);
    const hasDatabase = Boolean(
        allowDatabase || 
        requestedPermissions?.allowDatabase || 
        requestedPermissions?.database || 
        allCollections.length > 0
    );

    const handleGrant = () => {
        const perms = {
            folders: folders.map(f => f.path),
            allowRun: Boolean(requestedPermissions?.allowRun),
            allowEnv: requestedPermissions?.allowEnv || [],
            allowNet: Boolean(requestedPermissions?.allowNet),
            allowDatabase: hasDatabase,
            collections: allCollections
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
        <Dialog 
            open={open} 
            maxWidth="sm" 
            fullWidth 
            slotProps={{ 
                paper: { 
                    sx: { 
                        backgroundColor: 'rgba(15, 23, 42, 0.88)', 
                        backdropFilter: 'blur(24px)', 
                        border: '1px solid rgba(255, 255, 255, 0.1)', 
                        borderRadius: '20px', 
                        color: '#fff', 
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(239, 68, 68, 0.15)',
                        p: 1
                    } 
                } 
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <Box sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <ShieldAlert size={20} color="#ef4444" />
                </Box>
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        Permission Request
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                        {appName} ({appId})
                    </Typography>
                </Box>
            </DialogTitle>
            <DialogContent sx={{ pt: 3, pb: 2 }}>
                <Typography variant="body2" sx={{ mb: 2.5, color: 'rgba(255, 255, 255, 0.8)' }}>
                    The application <strong>{appName}</strong> is requesting elevated host permissions:
                </Typography>

                <Box sx={{ 
                    background: 'rgba(2, 6, 23, 0.6)', 
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    p: 2.5, 
                    borderRadius: '14px', 
                    mb: 3, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 2.5 
                }}>
                    {hasRun && (
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                            <Terminal size={20} color="#f59e0b" style={{ marginTop: 2 }} />
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#f59e0b' }}>
                                    Host Command Execution (--allow-run)
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.25 }}>
                                    Allows the application to run system shell commands on the host machine.
                                    {requestedPermissions?.allowRunCommands && requestedPermissions.allowRunCommands.length > 0 && (
                                        <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                                            Commands: <Box component="code" sx={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', px: 0.75, py: 0.25, borderRadius: '4px', fontFamily: 'monospace', color: '#f59e0b' }}>{requestedPermissions.allowRunCommands.join(', ')}</Box>
                                        </Box>
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
                                    <Box key={i} sx={{ mt: 0.75, p: 1, borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#e2e8f0', fontSize: '0.85rem' }}>
                                                {f.path}
                                            </Typography>
                                            <Chip label={f.mode === 'write' ? 'Read/Write' : 'Read-Only'} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#7dd3fc' }} />
                                        </Box>
                                        {f.reason && <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.25 }}>Reason: {f.reason}</Typography>}
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
                                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.25 }}>
                                    Requested: <Box component="code" sx={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', px: 0.75, py: 0.25, borderRadius: '4px', fontFamily: 'monospace', color: '#c084fc' }}>{requestedPermissions?.allowEnv?.join(', ')}</Box>
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
                                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.25 }}>
                                    Allows external network requests from the Deno backend sandbox.
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {hasDatabase && (
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                            <Database size={20} color="#6366f1" style={{ marginTop: 2 }} />
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#6366f1' }}>
                                    Dedicated MongoDB Database (--allow-database)
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: allCollections.length > 0 ? 0.5 : 0 }}>
                                    Allows the application to manage an isolated database with custom collections.
                                </Typography>
                                {allCollections.length > 0 && (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                        {allCollections.map((col, i) => (
                                            <Chip 
                                                key={i} 
                                                label={col} 
                                                size="small" 
                                                variant="outlined" 
                                                sx={{ height: 20, fontSize: '0.7rem', borderColor: 'rgba(99, 102, 241, 0.4)', color: '#a5b4fc' }} 
                                            />
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        </Box>
                    )}
                </Box>

                <Alert severity="error" icon={<AlertTriangle />} sx={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', color: '#fca5a5' }}>
                    <strong>Security Notice:</strong> Granting elevated permissions allows this app to interact with host resources. Only approve requests from trusted publishers.
                </Alert>
            </DialogContent>
            <DialogActions sx={{ p: 2.5, pt: 1, borderTop: '1px solid rgba(255,255,255,0.08)', gap: 1.5 }}>
                <Button 
                    onClick={handleDeny} 
                    variant="outlined" 
                    color="inherit" 
                    sx={{ borderColor: 'rgba(255,255,255,0.2)', borderRadius: '20px', px: 3, textTransform: 'none' }}
                >
                    Deny Request
                </Button>
                <Button 
                    onClick={handleGrant} 
                    variant="contained" 
                    sx={{ 
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', 
                        color: '#fff',
                        borderRadius: '20px', 
                        px: 3, 
                        textTransform: 'none',
                        fontWeight: 600,
                        boxShadow: '0 4px 15px rgba(239, 68, 68, 0.35)'
                    }}
                >
                    Allow Access
                </Button>
            </DialogActions>
        </Dialog>
    );
}
