import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Stack,
  Button,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';

import {
  Server,
  Play,
  Square,
  RotateCw,
  ArrowRight,
  Plus,
  HardDrive,
  Globe,
  Activity,
} from 'lucide-react';
import { NodeInfo, NodeServerItem } from '../types';

interface ServerListViewProps {
  activeNode: NodeInfo;
  servers: NodeServerItem[];
  actionLoading: boolean;
  onSelectServer: (serverId: string) => void;
  onPowerAction: (serverId: string, action: 'start' | 'stop' | 'restart' | 'kill') => void;
  onOpenCreateModal: () => void;
  onOpenNodeMetrics: () => void;
}

export const ServerListView: React.FC<ServerListViewProps> = ({
  activeNode,
  servers,
  actionLoading,
  onSelectServer,
  onPowerAction,
  onOpenCreateModal,
  onOpenNodeMetrics,
}) => {
  if (servers.length === 0) {
    return (
      <Box sx={{ mt: 6, display: 'flex', justifyContent: 'center' }}>
        <Card
          sx={{
            maxWidth: 520,
            width: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(8px)',
            border: '2px dashed rgba(255, 255, 255, 0.15)',
            borderRadius: 3,
            p: 4,
            textAlign: 'center',
          }}
        >
          <CardContent sx={{ p: 0 }}>
            <Box
              sx={{
                display: 'inline-flex',
                p: 2,
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                mb: 2,
              }}
            >
              <Plus size={36} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc', mb: 1 }}>
              No Minecraft Server Instances
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3 }}>
              No Minecraft server instances have been created yet on node &ldquo;{activeNode.name}&rdquo;. Create your first server to get started.
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="outlined"
                startIcon={<Activity size={16} />}
                onClick={onOpenNodeMetrics}
                sx={{
                  color: '#38bdf8',
                  borderColor: 'rgba(56, 189, 248, 0.3)',
                  '&:hover': {
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  },
                }}
              >
                Node Utilization
              </Button>
              <Button
                variant="contained"
                startIcon={<Plus size={16} />}
                onClick={onOpenCreateModal}
                sx={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  px: 3,
                  py: 1,
                  borderRadius: 2,
                  fontWeight: 600,
                  '&:hover': { backgroundColor: '#059669' },
                }}
              >
                Create New Instance
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      {/* Section Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        mb={3}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc' }}>
            Server Instances
          </Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            Managed Minecraft servers running on this Node
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<Activity size={16} />}
            onClick={onOpenNodeMetrics}
            sx={{
              color: '#38bdf8',
              borderColor: 'rgba(56, 189, 248, 0.3)',
              borderRadius: 2,
              fontWeight: 600,
              '&:hover': {
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
              },
            }}
          >
            Node Utilization
          </Button>

          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={onOpenCreateModal}
            sx={{
              backgroundColor: '#10b981',
              color: '#ffffff',
              px: 3,
              py: 1,
              borderRadius: 2,
              fontWeight: 600,
              '&:hover': { backgroundColor: '#059669' },
            }}
          >
            New Server Instance
          </Button>
        </Stack>
      </Stack>

      {/* Grid of Server Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
            xl: 'repeat(4, 1fr)',
          },

          gap: 3,
          width: '100%',
        }}
      >
        {servers.map((server) => {
          const isOnline = server.status === 'online';

          return (
            <Card
              key={server.id}
              sx={{
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                border: isOnline
                  ? '1px solid rgba(16, 185, 129, 0.4)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 3,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  borderColor: isOnline ? '#10b981' : 'rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                },
              }}
            >
              <CardContent sx={{ p: 3, flexGrow: 1 }}>
                {/* Card Top: Name & Status */}
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 42,
                        height: 42,
                        borderRadius: 2,
                        backgroundColor: isOnline
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'rgba(255, 255, 255, 0.05)',
                        color: isOnline ? '#34d399' : '#94a3b8',
                        border: isOnline
                          ? '1px solid rgba(16, 185, 129, 0.3)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <Server size={22} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f8fafc', lineHeight: 1.2 }}>
                        {server.name || server.id}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
                        ID: {server.id}
                      </Typography>
                    </Box>
                  </Stack>

                  <Chip
                    size="small"
                    label={isOnline ? 'Online' : 'Offline'}
                    sx={{
                      height: 22,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: isOnline
                        ? 'rgba(74, 222, 128, 0.15)'
                        : 'rgba(148, 163, 184, 0.15)',
                      color: isOnline ? '#4ade80' : '#94a3b8',
                      border: isOnline
                        ? '1px solid rgba(74, 222, 128, 0.3)'
                        : '1px solid rgba(148, 163, 184, 0.2)',
                    }}
                  />
                </Stack>

                {/* Endpoint & Storage Info */}
                <Stack spacing={1} mb={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Globe size={14} color="#38bdf8" />
                    <Typography variant="caption" sx={{ color: '#cbd5e1', fontFamily: 'monospace' }}>
                      {activeNode.host}:25565
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <HardDrive size={14} color="#94a3b8" />
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#64748b',
                        fontFamily: 'monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {server.path}
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>

              {/* Card Actions: Quick Power & Open Dashboard */}
              <CardActions
                sx={{
                  p: 2,
                  pt: 0,
                  justifyContent: 'space-between',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                {/* Quick Power Controls */}
                <Stack direction="row" spacing={0.5}>
                  {!isOnline ? (
                    <Tooltip title="Start Server">
                      <IconButton
                        size="small"
                        disabled={actionLoading}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPowerAction(server.id, 'start');
                        }}
                        sx={{
                          color: '#4ade80',
                          backgroundColor: 'rgba(74, 222, 128, 0.1)',
                          '&:hover': { backgroundColor: 'rgba(74, 222, 128, 0.2)' },
                        }}
                      >
                        <Play size={15} />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Stop Server">
                      <IconButton
                        size="small"
                        disabled={actionLoading}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPowerAction(server.id, 'stop');
                        }}
                        sx={{
                          color: '#f87171',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
                        }}
                      >
                        <Square size={15} />
                      </IconButton>
                    </Tooltip>
                  )}

                  <Tooltip title="Restart Server">
                    <IconButton
                      size="small"
                      disabled={actionLoading}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPowerAction(server.id, 'restart');
                      }}
                      sx={{
                        color: '#fbbf24',
                        backgroundColor: 'rgba(251, 191, 36, 0.1)',
                        '&:hover': { backgroundColor: 'rgba(251, 191, 36, 0.2)' },
                      }}
                    >
                      <RotateCw size={15} />
                    </IconButton>
                  </Tooltip>
                </Stack>

                {/* Manage Server Button */}
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<ArrowRight size={14} />}
                  onClick={() => onSelectServer(server.id)}
                  sx={{
                    color: '#f8fafc',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    '&:hover': {
                      borderColor: '#10b981',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      color: '#34d399',
                    },
                  }}
                >
                  Manage
                </Button>
              </CardActions>
            </Card>
          );
        })}
      </Box>

    </Box>
  );
};
