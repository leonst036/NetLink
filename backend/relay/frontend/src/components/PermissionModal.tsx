import { Box, Typography, Button, Alert, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

interface FolderRequest {
    path: string;
    reason: string;
    mode?: string;
}

interface PermissionModalProps {
    open: boolean;
    appId: string;
    appName: string;
    folders: FolderRequest[];
    onRespond: (appId: string, granted: boolean, folders: FolderRequest[]) => void;
}

export default function PermissionModal({ open, appId, appName, folders, onRespond }: PermissionModalProps) {
    if (!open) return null;

    return (
        <Dialog open={open} maxWidth="sm" fullWidth PaperProps={{ style: { backgroundColor: '#1e293b', color: '#fff' } }}>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <ShieldAlert size={24} color="#ef4444" />
                Permission Request
            </DialogTitle>
            <DialogContent sx={{ pt: 3 }}>
                <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
                    The application <strong>{appName}</strong> is requesting access to external folders on your host system.
                </Typography>
                
                <Box sx={{ background: 'rgba(0,0,0,0.3)', p: 2, borderRadius: 1, mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: '#94a3b8' }}>Requested Folders:</Typography>
                    {folders.map((f, i) => (
                        <Box key={i} sx={{ mb: 1, '&:last-child': { mb: 0 } }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#38bdf8' }}>
                                {f.path} <span style={{ color: '#64748b' }}>({f.mode === 'write' ? 'Read / Write' : 'Read-Only'})</span>
                            </Typography>
                            {f.reason && <Typography variant="caption" sx={{ color: '#94a3b8' }}>Reason: {f.reason}</Typography>}
                        </Box>
                    ))}
                </Box>

                <Alert severity="error" icon={<AlertTriangle />} sx={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }}>
                    <strong>Security Warning:</strong> Allowing an application to access external folders can expose your sensitive system files, personal data, and configuration. This could lead to data theft, modification of critical system files, or system instability. Only grant this permission if you fully trust the application.
                </Alert>
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <Button 
                    onClick={() => onRespond(appId, false, folders)} 
                    variant="outlined" 
                    color="inherit" 
                    sx={{ borderColor: 'rgba(255,255,255,0.2)' }}
                >
                    Deny Request
                </Button>
                <Button 
                    onClick={() => onRespond(appId, true, folders)} 
                    variant="contained" 
                    color="error"
                >
                    Allow Access
                </Button>
            </DialogActions>
        </Dialog>
    );
}
