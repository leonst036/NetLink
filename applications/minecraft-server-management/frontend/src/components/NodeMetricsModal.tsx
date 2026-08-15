import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  LinearProgress,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Activity,
  Cpu,
  HardDrive,
  Clock,
  Server,
  CheckCircle2,
  WifiOff,
  RefreshCw,
} from 'lucide-react';

import { NodeInfo, NodeSystemStats } from '../types';
import { getNodeSystemStats } from '../api';

interface NodeMetricsModalProps {
  open: boolean;
  node: NodeInfo | null;
  onClose: () => void;
}

export const NodeMetricsModal: React.FC<NodeMetricsModalProps> = ({
  open,
  node,
  onClose,
}) => {
  const [stats, setStats] = useState<NodeSystemStats | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!node) return;
    try {
      const data = await getNodeSystemStats(node);
      if (data) {
        setStats(data);
        setIsOnline(true);
        setLastHeartbeat(new Date());
      } else {
        setIsOnline(false);
      }
    } catch {
      setIsOnline(false);
    }
  }, [node]);

  useEffect(() => {
    if (open && node) {
      setLoading(true);
      fetchMetrics().finally(() => setLoading(false));
      const interval = setInterval(fetchMetrics, 3000);
      return () => clearInterval(interval);
    }
  }, [open, node, fetchMetrics]);

  const formatGb = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 3,
          color: '#f8fafc',
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle sx={{ p: 3, pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 38,
                height: 38,
                borderRadius: 2,
                backgroundColor: isOnline ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isOnline ? '#38bdf8' : '#f87171',
              }}
            >
              <Activity size={20} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc', lineHeight: 1.2 }}>
                Node Utilization & Hardware Metrics
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                {node?.name} ({node?.host}:{node?.daemonPort})
              </Typography>
            </Box>
          </Stack>

          {/* Heartbeat Status Chip: Live Telemetry vs Offline */}
          {isOnline ? (
            <Chip
              size="small"
              icon={<CheckCircle2 size={13} color="#34d399" />}
              label="Live Telemetry"
              sx={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                fontWeight: 600,
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            />
          ) : (
            <Chip
              size="small"
              icon={<WifiOff size={13} color="#f87171" />}
              label="Offline"
              sx={{
                backgroundColor: 'rgba(239, 68, 68, 0.18)',
                color: '#f87171',
                fontWeight: 700,
                border: '1px solid rgba(239, 68, 68, 0.4)',
              }}
            />
          )}
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {/* Offline Banner Bar */}
        {!isOnline && (
          <Alert
            severity="error"
            icon={<WifiOff size={18} />}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={fetchMetrics}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={12} color="inherit" /> : <RefreshCw size={14} />}
                sx={{ fontWeight: 700, textTransform: 'none' }}
              >
                Retry Heartbeat
              </Button>
            }
            sx={{
              mb: 3,
              backgroundColor: 'rgba(239, 68, 68, 0.16)',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 2,
              '& .MuiAlert-icon': { color: '#ef4444' },
            }}
          >
            <strong>Node Daemon Offline:</strong> Heartbeat connection to {node?.host}:{node?.daemonPort} failed or timed out. Real-time telemetry is paused.
          </Alert>
        )}

        {loading && !stats ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CircularProgress size={32} sx={{ color: '#38bdf8' }} />
            <Typography variant="body2" sx={{ color: '#94a3b8', mt: 2 }}>
              Sampling node hardware metrics...
            </Typography>
          </Box>
        ) : stats ? (
          <Stack spacing={3} sx={{ opacity: isOnline ? 1 : 0.65, transition: 'opacity 0.3s' }}>
            {/* Primary Metrics Grid */}
            <Grid container spacing={2.5}>
              {/* 1. Host CPU Card */}
              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 2.5,
                    height: '100%',
                  }}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Cpu size={18} color="#38bdf8" />
                        <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                          Host CPU Load
                        </Typography>
                      </Stack>
                      <Chip
                        size="small"
                        label={`${stats.cpuPercent}%`}
                        sx={{
                          height: 20,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor:
                            stats.cpuPercent > 80 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                          color: stats.cpuPercent > 80 ? '#f87171' : '#38bdf8',
                        }}
                      />
                    </Stack>

                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc', mb: 1 }}>
                      {stats.cpuPercent}%
                    </Typography>

                    <LinearProgress
                      variant="determinate"
                      value={Math.min(stats.cpuPercent, 100)}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor:
                            stats.cpuPercent > 80 ? '#ef4444' : stats.cpuPercent > 50 ? '#f59e0b' : '#38bdf8',
                        },
                        mb: 1.5,
                      }}
                    />

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Cores: <strong style={{ color: '#cbd5e1' }}>{stats.cpuCores}</strong>
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Load: {stats.loadAvg.map((n) => n.toFixed(2)).join(', ')}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* 2. Host RAM Card */}
              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 2.5,
                    height: '100%',
                  }}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Activity size={18} color="#34d399" />
                        <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                          Physical RAM
                        </Typography>
                      </Stack>
                      <Chip
                        size="small"
                        label={`${stats.memoryPercent}%`}
                        sx={{
                          height: 20,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor:
                            stats.memoryPercent > 85 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                          color: stats.memoryPercent > 85 ? '#f87171' : '#34d399',
                        }}
                      />
                    </Stack>

                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc', mb: 1 }}>
                      {formatGb(stats.memoryUsedMb)} / {formatGb(stats.memoryTotalMb)}
                    </Typography>

                    <LinearProgress
                      variant="determinate"
                      value={Math.min(stats.memoryPercent, 100)}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor:
                            stats.memoryPercent > 85 ? '#ef4444' : stats.memoryPercent > 65 ? '#f59e0b' : '#10b981',
                        },
                        mb: 1.5,
                      }}
                    />

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Free: <strong style={{ color: '#34d399' }}>{formatGb(stats.memoryFreeMb)}</strong>
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Allocated: {formatGb(stats.totalAllocatedRamMb)}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* 3. Host Storage Card */}
              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 2.5,
                    height: '100%',
                  }}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <HardDrive size={18} color="#c084fc" />
                        <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                          Host Storage
                        </Typography>
                      </Stack>
                      <Chip
                        size="small"
                        label={`${stats.diskPercent}%`}
                        sx={{
                          height: 20,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor:
                            stats.diskPercent > 90 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(192, 132, 252, 0.15)',
                          color: stats.diskPercent > 90 ? '#f87171' : '#c084fc',
                        }}
                      />
                    </Stack>

                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc', mb: 1 }}>
                      {formatGb(stats.diskUsedMb)} / {formatGb(stats.diskTotalMb)}
                    </Typography>

                    <LinearProgress
                      variant="determinate"
                      value={Math.min(stats.diskPercent, 100)}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor:
                            stats.diskPercent > 90 ? '#ef4444' : stats.diskPercent > 75 ? '#f59e0b' : '#c084fc',
                        },
                        mb: 1.5,
                      }}
                    />

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Free: <strong style={{ color: '#cbd5e1' }}>{formatGb(stats.diskFreeMb)}</strong>
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Used: {formatGb(stats.diskUsedMb)}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Daemon & Node Summary Cards */}
            <Grid container spacing={2.5}>
              <Grid item xs={12} sm={6}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Server size={20} color="#34d399" />
                    <Box>
                      <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                        Active Minecraft Servers
                      </Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                        {stats.activeServersCount} running on node
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Clock size={20} color="#fbbf24" />
                    <Box>
                      <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                        Daemon Uptime
                      </Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                        {formatUptime(stats.daemonUptimeSeconds)}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </Stack>
        ) : (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <WifiOff size={40} color="#ef4444" style={{ marginBottom: 12 }} />
            <Typography variant="h6" sx={{ color: '#f87171', fontWeight: 700 }}>
              Wings Node Daemon Offline
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8', mt: 1, maxWidth: 460, mx: 'auto' }}>
              Could not communicate with the Wings daemon at {node?.host}:{node?.daemonPort}. Please verify that the daemon process is running on the host machine.
            </Typography>
            <Button
              variant="contained"
              onClick={fetchMetrics}
              startIcon={<RefreshCw size={15} />}
              sx={{
                mt: 3,
                backgroundColor: '#ef4444',
                color: '#ffffff',
                '&:hover': { backgroundColor: '#dc2626' },
              }}
            >
              Retry Connection
            </Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        {lastHeartbeat && (
          <Typography variant="caption" sx={{ color: '#64748b', mr: 'auto' }}>
            Last heartbeat: {lastHeartbeat.toLocaleTimeString()}
          </Typography>
        )}
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            color: '#f8fafc',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            px: 3,
            '&:hover': {
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
            },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
