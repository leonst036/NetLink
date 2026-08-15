import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
} from '@mui/material';

interface CreateBackupModalProps {
  open: boolean;
  serverName: string;
  creating: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export const CreateBackupModal: React.FC<CreateBackupModalProps> = ({
  open,
  serverName,
  creating,
  onClose,
  onCreate,
}) => {
  const [nameInput, setNameInput] = useState('');

  const handleConfirm = async () => {
    await onCreate(nameInput);
    setNameInput('');
  };

  return (
    <Dialog
      open={open}
      onClose={() => !creating && onClose()}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 3,
          color: '#f8fafc',
        },
      }}
    >
      <DialogTitle sx={{ p: 3, pb: 1 }}>Create Server Backup</DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3 }}>
          Generate a compressed archive of instance <strong>{serverName}</strong>.
        </Typography>
        <TextField
          fullWidth
          label="Backup Name (Optional)"
          placeholder="e.g. Before 1.20.4 update"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          disabled={creating}
          autoFocus
        />
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={creating}
          sx={{ color: '#94a3b8', borderColor: 'rgba(255, 255, 255, 0.2)' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={creating}
          sx={{
            backgroundColor: '#10b981',
            color: '#ffffff',
            fontWeight: 600,
            '&:hover': { backgroundColor: '#059669' },
          }}
        >
          {creating ? 'Compressing Archive...' : 'Create Backup'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
