import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  TextField,
  Chip,
  Box,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Globe,
  Radio,
  Power,
  Copy,
  Check,
  RefreshCw,
  Users,
  Activity,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { NodeInfo, NodeServerItem, TunnelInfo } from '../types';
import { getServerTunnels, openServerTunnel, closeServerTunnel } from '../api';

interface PortForwardCardProps {
  activeNode: NodeInfo | null;
  activeServer: NodeServerItem;
}

export const PortForwardCard: React.FC<PortForwardCardProps> = ({
  activeNode,
  activeServer,
}) => {
  const [tunnel, setTunnel] = useState<TunnelInfo | null>(null);
  const [, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [publicPortInput, setPublicPortInput] = useState<string>('25565');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchTunnel = useCallback(async (isInitial = false) => {
    if (!activeServer) return;
    try {
      if (isInitial) setLoading(true);
      const list = await getServerTunnels(activeServer.id);
      const active = list.find((t) => t.serverId === activeServer.id && t.status === 'active') || null;
      setTunnel(active);
      if (active) {
        setPublicPortInput(active.publicPort.toString());
      }
    } catch {
      // Quiet fallback
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [activeServer.id]);

  useEffect(() => {
    fetchTunnel(true);
    const interval = setInterval(() => fetchTunnel(false), 4000);
    return () => clearInterval(interval);
  }, [fetchTunnel]);

  const handleOpenTunnel = async () => {
    if (!activeNode || !activeServer) return;
    const portNum = parseInt(publicPortInput, 10);
    if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
      setFeedback({ type: 'error', message: 'Please enter a valid port between 1024 and 65535 (e.g. 25565).' });
      return;
    }

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await openServerTunnel({
        publicPort: portNum,
        targetHost: activeNode.host,
        targetPort: 25565,
        serverId: activeServer.id,
        name: activeServer.name,
      });

      if (res.success && res.tunnel) {
        setTunnel(res.tunnel);
        setFeedback({
          type: 'success',
          message: `TCP Tunnel opened on public port ${portNum}. Friends can now join from the internet!`,
        });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to open port forwarding tunnel.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error opening tunnel.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseTunnel = async () => {
    if (!tunnel) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await closeServerTunnel(tunnel.publicPort);
      if (res.success) {
        setTunnel(null);
        setFeedback({ type: 'success', message: `Public tunnel on port ${tunnel.publicPort} closed.` });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to close tunnel.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error closing tunnel.' });
    } finally {
      setActionLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const publicHost = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
  const publicAddress = tunnel ? `${publicHost}:${tunnel.publicPort}` : `${publicHost}:${publicPortInput || '25565'}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(publicAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isTunnelActive = tunnel && tunnel.status === 'active';

  return (
    <Card
      sx={{
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        border: isTunnelActive ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {feedback && (
          <Alert
            severity={feedback.type}
            onClose={() => setFeedback(null)}
            sx={{
              mb: 3,
              backgroundColor: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: feedback.type === 'success' ? '#34d399' : '#fca5a5',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {feedback.message}
          </Alert>
        )}

        {/* Top Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={2}
          mb={3}
        >
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={0.5}>
              <Globe size={22} color={isTunnelActive ? '#10b981' : '#94a3b8'} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                Relay Port Forwarding & Public Access
              </Typography>
              <Chip
                size="small"
                icon={isTunnelActive ? <Radio size={12} className="animate-pulse" /> : <Power size={12} />}
                label={isTunnelActive ? 'Tunnel Online' : 'Tunnel Inactive'}
                sx={{
                  height: 24,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: isTunnelActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                  color: isTunnelActive ? '#34d399' : '#94a3b8',
                  border: isTunnelActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                }}
              />
            </Stack>
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>
              Forward incoming Minecraft traffic from the NetLink Relay directly to your node server.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => fetchTunnel(false)}
              startIcon={<RefreshCw size={14} />}
              sx={{
                color: '#94a3b8',
                borderColor: 'rgba(255, 255, 255, 0.15)',
                '&:hover': { borderColor: 'rgba(255, 255, 255, 0.3)', backgroundColor: 'rgba(255, 255, 255, 0.04)' },
              }}
            >
              Refresh
            </Button>
          </Stack>
        </Stack>

        {/* Public Address Display Box */}
        <Box
          sx={{
            p: 2.5,
            mb: 3,
            backgroundColor: '#030712',
            borderRadius: 2,
            border: isTunnelActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={2}
          >
            <Box>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Public Server Address (Join IP)
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: isTunnelActive ? '#34d399' : '#cbd5e1',
                  }}
                >
                  {publicAddress}
                </Typography>
                <Tooltip title={copied ? 'Copied!' : 'Copy IP:Port'}>
                  <IconButton size="small" onClick={handleCopy} sx={{ color: copied ? '#10b981' : '#94a3b8' }}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                Relay Port {tunnel ? tunnel.publicPort : publicPortInput}
              </Typography>
              <ArrowRight size={16} color="#64748b" />
              <Typography variant="body2" sx={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                Node ({activeNode?.host}:25565)
              </Typography>
            </Stack>
          </Stack>
        </Box>

        {/* Live Metrics Row (When Active) */}
        {isTunnelActive && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 2,
              mb: 3,
            }}
          >
            <Box sx={{ p: 2, backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 2, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                <Users size={16} color="#38bdf8" />
                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                  Active Connections
                </Typography>
              </Stack>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                {tunnel.activeConnections} {tunnel.activeConnections === 1 ? 'Player' : 'Players'}
              </Typography>
            </Box>

            <Box sx={{ p: 2, backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 2, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                <Activity size={16} color="#10b981" />
                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                  Traffic Received (Rx)
                </Typography>
              </Stack>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                {formatBytes(tunnel.bytesRx)}
              </Typography>
            </Box>

            <Box sx={{ p: 2, backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 2, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                <ShieldCheck size={16} color="#fbbf24" />
                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                  Traffic Transmitted (Tx)
                </Typography>
              </Stack>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                {formatBytes(tunnel.bytesTx)}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Configuration & Action Controls */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            label="Public Relay Port"
            placeholder="25565"
            size="small"
            value={publicPortInput}
            onChange={(e) => setPublicPortInput(e.target.value)}
            disabled={isTunnelActive || actionLoading}
            sx={{ width: { xs: '100%', sm: 220 } }}
            helperText="Default Minecraft TCP port is 25565"
          />

          <Box sx={{ flexGrow: 1 }} />

          {isTunnelActive ? (
            <Button
              variant="contained"
              color="error"
              onClick={handleCloseTunnel}
              disabled={actionLoading}
              startIcon={<Power size={16} />}
              sx={{
                px: 3,
                py: 1,
                borderRadius: 2,
                fontWeight: 700,
                backgroundColor: '#ef4444',
                '&:hover': { backgroundColor: '#dc2626' },
              }}
            >
              {actionLoading ? 'Closing Tunnel...' : 'Close Public Tunnel'}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleOpenTunnel}
              disabled={actionLoading}
              startIcon={<Globe size={16} />}
              sx={{
                px: 3,
                py: 1,
                borderRadius: 2,
                fontWeight: 700,
                backgroundColor: '#10b981',
                color: '#ffffff',
                '&:hover': { backgroundColor: '#059669' },
              }}
            >
              {actionLoading ? 'Opening Tunnel...' : 'Open Public Tunnel'}
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
