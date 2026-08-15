import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
} from '@mui/material';
import { Trash2 } from 'lucide-react';
import { BackupItem } from '../../types';

interface DeleteBackupModalProps {
  open: boolean;
  backup: BackupItem | null;
  deleting: boolean;
  onClose: () => void;
  onConfirmDelete: () => Promise<void>;
}

export const DeleteBackupModal: React.FC<DeleteBackupModalProps> = ({
  open,
  backup,
  deleting,
  onClose,
  onConfirmDelete,
}) => {
  return (
    <Dialog
      open={open}
      onClose={() => !deleting && onClose()}
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
          <Trash2 size={22} color="#f87171" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Delete Backup Archive?
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <Typography variant="body2" sx={{ color: '#94a3b8' }}>
          Are you sure you want to permanently delete <strong>{backup?.name}</strong> ({backup?.fileName})? This action cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={deleting}
          sx={{ color: '#94a3b8', borderColor: 'rgba(255, 255, 255, 0.2)' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onConfirmDelete}
          disabled={deleting}
          sx={{
            backgroundColor: '#ef4444',
            color: '#ffffff',
            fontWeight: 600,
            '&:hover': { backgroundColor: '#dc2626' },
          }}
        >
          {deleting ? 'Deleting...' : 'Delete Backup'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
