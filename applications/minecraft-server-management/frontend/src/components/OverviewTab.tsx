import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  Cpu,
  Activity,
  HardDrive,
  Clock,
  Server,
} from 'lucide-react';
import { NodeInfo, NodeServerItem, ServerStats } from '../types';
import { getNodeServerStats } from '../api';

interface OverviewTabProps {
  activeNode: NodeInfo | null;
  activeServer: NodeServerItem;
}

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return 'Offline';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ activeNode, activeServer }) => {
  const [stats, setStats] = useState<ServerStats | null>(null);

  // Poll server resource metrics
  const fetchStats = useCallback(async () => {
    if (!activeNode || !activeServer) return;
    try {
      const data = await getNodeServerStats(activeNode, activeServer.id);
      if (data) {
        setStats(data);
      }
    } catch {}
  }, [activeNode, activeServer.id]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Calculations
  const isOnline = stats?.status === 'online';
  const memoryUsed = stats?.memoryMb || 0;
  const memoryLimit = stats?.memoryLimitMb || 1024;
  const memPercent = Math.min(Math.round((memoryUsed / memoryLimit) * 100), 100);
  const cpuPercent = stats?.cpuPercent || 0;
  const diskMb = stats?.diskMb || 0;

  return (
    <Stack spacing={3}>
      {/* Live Resource Telemetry Grid */}
      <Grid container spacing={2.5}>
        {/* 1. CPU Usage */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 3,
              height: '100%',
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Cpu size={18} color="#38bdf8" />
                  <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                    CPU Load
                  </Typography>
                </Stack>
                <Chip
                  size="small"
                  label={isOnline ? `${cpuPercent}%` : '0%'}
                  sx={{
                    height: 20,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: cpuPercent > 80 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                    color: cpuPercent > 80 ? '#f87171' : '#38bdf8',
                  }}
                />
              </Stack>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc', mb: 1 }}>
                {isOnline ? `${cpuPercent}%` : '0.0%'}{' '}
                {stats?.cpuLimitPercent ? (
                  <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                    / {stats.cpuLimitPercent}%
                  </span>
                ) : null}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={
                  isOnline
                    ? Math.min(
                        stats?.cpuLimitPercent && stats.cpuLimitPercent > 0
                          ? (cpuPercent / stats.cpuLimitPercent) * 100
                          : Math.min(cpuPercent, 100),
                        100
                      )
                    : 0
                }
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: cpuPercent > 80 ? '#ef4444' : cpuPercent > 50 ? '#f59e0b' : '#38bdf8',
                  },
                }}
              />

            </CardContent>
          </Card>
        </Grid>

        {/* 2. Memory (RAM) Usage */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 3,
              height: '100%',
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Activity size={18} color="#10b981" />
                  <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                    Memory (RAM)
                  </Typography>
                </Stack>
                <Chip
                  size="small"
                  label={`${memPercent}%`}
                  sx={{
                    height: 20,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                  }}
                />
              </Stack>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc', mb: 1 }}>
                {isOnline ? `${memoryUsed} MB` : '0 MB'}{' '}
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                  / {memoryLimit} MB
                </span>
              </Typography>
              <LinearProgress
                variant="determinate"
                value={isOnline ? memPercent : 0}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: memPercent > 85 ? '#ef4444' : '#10b981',
                  },
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* 3. Disk Footprint */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 3,
              height: '100%',
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <HardDrive size={18} color="#fbbf24" />
                  <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                    Disk Storage
                  </Typography>
                </Stack>
              </Stack>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc', mb: 1 }}>
                {diskMb} MB
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                Server files directory size
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* 4. Process Uptime */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 3,
              height: '100%',
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Clock size={18} color="#c084fc" />
                  <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                    Uptime
                  </Typography>
                </Stack>
                <Chip
                  size="small"
                  label={isOnline ? 'Active' : 'Stopped'}
                  sx={{
                    height: 20,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: isOnline ? 'rgba(74, 222, 128, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                    color: isOnline ? '#4ade80' : '#94a3b8',
                  }}
                />
              </Stack>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc', mb: 1 }}>
                {formatUptime(stats?.uptimeSeconds || 0)}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                {isOnline ? 'Process running' : 'Process offline'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Instance Information Card */}
      <Card
        sx={{
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 3,
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={2.5}>
            <Server size={20} color="#38bdf8" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f8fafc' }}>
              Instance Information
            </Typography>
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                Instance ID
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#f8fafc' }}>
                {activeServer.id}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                Active Node
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#f8fafc' }}>
                {activeNode?.name} ({activeNode?.host}:{activeNode?.daemonPort})
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                Node Storage Path
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  color: '#34d399',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  p: 1.5,
                  borderRadius: 2,
                  mt: 0.5,
                }}
              >
                {activeServer.path}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Stack>
  );
};
