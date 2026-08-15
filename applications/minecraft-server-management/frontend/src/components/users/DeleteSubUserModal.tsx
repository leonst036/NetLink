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
import { Trash2, AlertTriangle } from 'lucide-react';
import { ServerSubUser } from '../../types';

interface DeleteSubUserModalProps {
  open: boolean;
  user: ServerSubUser | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading: boolean;
}

export const DeleteSubUserModal: React.FC<DeleteSubUserModalProps> = ({
  open,
  user,
  onClose,
  onConfirm,
  loading,
}) => {
  if (!user) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <AlertTriangle size={22} color="#ef4444" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Revoke Collaborator Access
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2}>
          <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
            Are you sure you want to remove <strong>{user.username}</strong> from this Minecraft instance?
          </Typography>

          <Alert
            severity="warning"
            sx={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            They will immediately lose all granted permissions to manage this server instance.
          </Alert>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} sx={{ color: '#94a3b8' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={loading}
          onClick={onConfirm}
          startIcon={<Trash2 size={16} />}
          sx={{
            backgroundColor: '#ef4444',
            fontWeight: 700,
            '&:hover': { backgroundColor: '#dc2626' },
          }}
        >
          {loading ? 'Revoking Access...' : 'Revoke Access'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
