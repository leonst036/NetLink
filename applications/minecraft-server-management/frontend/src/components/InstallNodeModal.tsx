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
  CircularProgress,
  Alert,
} from '@mui/material';
import { Server, Terminal } from 'lucide-react';
import { installNode } from '../api';
import { NodeInfo } from '../types';

interface InstallNodeModalProps {
  open: boolean;
  onClose: () => void;
  onNodeInstalled: (node: NodeInfo) => void;
}

export const InstallNodeModal: React.FC<InstallNodeModalProps> = ({
  open,
  onClose,
  onNodeInstalled,
}) => {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [daemonPort, setDaemonPort] = useState('9080');

  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!host.trim() || !username.trim()) return;

    setLoading(true);
    setError(null);
    setOutput(null);

    try {
      const res = await installNode({
        host: host.trim(),
        port: parseInt(port) || 22,
        username: username.trim(),
        password: password || undefined,
        nodeName: nodeName.trim() || host.trim(),
        daemonPort: parseInt(daemonPort) || 9080,
      });

      setOutput(res.output || 'Installation completed.');

      if (res.success && res.nodeId) {
        onNodeInstalled({
          id: res.nodeId,
          name: nodeName.trim() || host.trim(),
          host: host.trim(),
          daemonPort: parseInt(daemonPort) || 9080,
          installedAt: Date.now(),
        });
      } else {
        setError(res.error || 'Failed to install daemon on remote server.');
      }
    } catch (err: any) {
      setError(err.message || 'SSH connection error');
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
            <Server size={20} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Connect & Install Wings Node
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
              Deploys the daemon over SSH to a remote server
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <Box component="form" onSubmit={handleInstall}>
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
                label="Server Host / IP"
                placeholder="192.168.1.50"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                disabled={loading}
                sx={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="SSH Port"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                disabled={loading}
                sx={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                size="small"
                label="SSH Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                sx={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="password"
                label="SSH Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                sx={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
              />
            </Grid>

            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                size="small"
                label="Node Friendly Name (optional)"
                placeholder="Debian Dedicated Node"
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                disabled={loading}
                sx={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Daemon Port"
                value={daemonPort}
                onChange={(e) => setDaemonPort(e.target.value)}
                disabled={loading}
                sx={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
              />
            </Grid>
          </Grid>

          {output && (
            <Box sx={{ mt: 2.5 }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                <Terminal size={14} color="#94a3b8" />
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  Installer Output
                </Typography>
              </Stack>
              <Box
                sx={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  p: 1.5,
                  borderRadius: 2,
                  backgroundColor: '#030712',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  whiteSpace: 'pre-wrap',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                {output}
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Button onClick={onClose} disabled={loading} sx={{ color: '#94a3b8' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !host.trim() || !username.trim()}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Server size={16} />}
            sx={{
              backgroundColor: '#10b981',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': { backgroundColor: '#059669' },
            }}
          >
            {loading ? 'Installing Wings...' : 'Install Node'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};
