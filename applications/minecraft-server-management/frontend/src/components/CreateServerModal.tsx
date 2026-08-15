import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  Stack,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Gamepad2, Plus } from 'lucide-react';
import { createNodeServer } from '../api';
import { NodeInfo } from '../types';

interface CreateServerModalProps {
  open: boolean;
  node: NodeInfo;
  onClose: () => void;
  onServerCreated: () => void;
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  open,
  node,
  onClose,
  onServerCreated,
}) => {
  const [name, setName] = useState('');
  const [port, setPort] = useState('25565');
  const [motd, setMotd] = useState('A Minecraft Server');
  const [maxPlayers, setMaxPlayers] = useState('20');
  const [gamemode, setGamemode] = useState('survival');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await createNodeServer(node, {
        id: name.trim().toLowerCase().replace(/\s+/g, '-'),
        name: name.trim(),
        port: parseInt(port) || 25565,
        motd: motd.trim(),
        maxPlayers: parseInt(maxPlayers) || 20,
        gamemode,
      });

      if (res.success) {
        onServerCreated();
        onClose();
      } else {
        setError(res.error || 'Failed to create server.');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with Wings daemon');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle sx={{ p: 3, pb: 1.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
            }}
          >
            <Gamepad2 size={20} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Create Minecraft Instance
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
              Provisions instance on Wings node &ldquo;{node.name}&rdquo; ({node.host}:{node.daemonPort})
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ p: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2.5, backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5' }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <TextField
                required
                fullWidth
                size="small"
                label="Instance Name"
                placeholder="survival-smp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                sx={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Port"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                disabled={loading}
                sx={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="MOTD"
                value={motd}
                onChange={(e) => setMotd(e.target.value)}
                disabled={loading}
                sx={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: '#94a3b8' }}>Gamemode</InputLabel>
                <Select
                  value={gamemode}
                  label="Gamemode"
                  onChange={(e) => setGamemode(e.target.value)}
                  disabled={loading}
                  sx={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', color: '#f8fafc' }}
                >
                  <MenuItem value="survival">Survival</MenuItem>
                  <MenuItem value="creative">Creative</MenuItem>
                  <MenuItem value="adventure">Adventure</MenuItem>
                  <MenuItem value="spectator">Spectator</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Max Players"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                disabled={loading}
                sx={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Button onClick={onClose} disabled={loading} sx={{ color: '#94a3b8' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !name.trim()}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Plus size={16} />}
            sx={{
              backgroundColor: '#10b981',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': { backgroundColor: '#059669' },
            }}
          >
            {loading ? 'Creating...' : 'Create Server'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};
