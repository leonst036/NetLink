import React from 'react';
import {
  Typography,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Box,
} from '@mui/material';
import { FileCode, Save } from 'lucide-react';

interface FileEditorModalProps {
  open: boolean;
  fileName: string;
  filePath: string;
  content: string;
  loading: boolean;
  saving: boolean;
  onChangeContent: (val: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export const FileEditorModal: React.FC<FileEditorModalProps> = ({
  open,
  fileName,
  filePath,
  content,
  loading,
  saving,
  onChangeContent,
  onSave,
  onClose,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 3,
          minHeight: 520,
        },
      }}
    >
      <DialogTitle sx={{ p: 2.5, pb: 1.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <FileCode size={20} color="#38bdf8" />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {fileName}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8', fontFamily: 'monospace' }}>
              {filePath}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress size={28} sx={{ color: '#10b981' }} />
          </Box>
        ) : (
          <TextField
            fullWidth
            multiline
            minRows={16}
            maxRows={24}
            value={content}
            onChange={(e) => onChangeContent(e.target.value)}
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#030712',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                lineHeight: 1.6,
                color: '#e2e8f0',
                p: 2,
              },
            }}
          />
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2.5, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Button onClick={onClose} disabled={saving} sx={{ color: '#94a3b8' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={saving || loading}
          onClick={onSave}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save size={16} />}
          sx={{
            backgroundColor: '#10b981',
            color: '#ffffff',
            '&:hover': { backgroundColor: '#059669' },
          }}
        >
          {saving ? 'Saving...' : 'Save File'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
