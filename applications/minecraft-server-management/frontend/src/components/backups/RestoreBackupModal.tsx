import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  Alert,
} from '@mui/material';
import { AlertTriangle } from 'lucide-react';
import { BackupItem } from '../../types';

interface RestoreBackupModalProps {
  open: boolean;
  backup: BackupItem | null;
  restoring: boolean;
  onClose: () => void;
  onConfirmRestore: () => Promise<void>;
}

export const RestoreBackupModal: React.FC<RestoreBackupModalProps> = ({
  open,
  backup,
  restoring,
  onClose,
  onConfirmRestore,
}) => {
  return (
    <Dialog
      open={open}
      onClose={() => !restoring && onClose()}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#0f172a',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 3,
          color: '#f8fafc',
        },
      }}
    >
      <DialogTitle sx={{ p: 3, pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <AlertTriangle size={22} color="#fbbf24" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Restore Server Backup?
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
          Restoring from <strong>{backup?.name}</strong> will overwrite current server files with the contents of this archive.
        </Typography>
        <Alert severity="warning" sx={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
          Ensure your server is stopped before restoring.
        </Alert>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={restoring}
          sx={{ color: '#94a3b8', borderColor: 'rgba(255, 255, 255, 0.2)' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onConfirmRestore}
          disabled={restoring}
          sx={{
            backgroundColor: '#38bdf8',
            color: '#0f172a',
            fontWeight: 700,
            '&:hover': { backgroundColor: '#0284c7', color: '#ffffff' },
          }}
        >
          {restoring ? 'Extracting Archive...' : 'Confirm Restore'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
