import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Select,
  MenuItem,
  FormControl,
  keyframes,
  Chip,
} from '@mui/material';
import { Server, Plus, RefreshCw, Activity, WifiOff } from 'lucide-react';

import { NodeInfo } from '../types';

const spinAnimation = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

interface HeaderProps {
  nodes: NodeInfo[];
  activeNode: NodeInfo | null;
  refreshing?: boolean;
  isNodeOnline?: boolean;
  nodeLatencyMs?: number;
  onSelectNode: (nodeId: string) => void;
  onRefresh: () => void;
  onOpenInstallModal: () => void;
  onOpenNodeMetrics?: () => void;
  onGoToServerList?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  nodes,
  activeNode,
  refreshing = false,
  isNodeOnline = true,
  nodeLatencyMs,
  onSelectNode,
  onRefresh,
  onOpenInstallModal,
  onOpenNodeMetrics,
  onGoToServerList,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', md: 'center' },
        gap: 2,
        pb: 3,
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* App Branding - Clickable to navigate to server selection */}
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        onClick={onGoToServerList}
        role={onGoToServerList ? 'button' : undefined}
        tabIndex={onGoToServerList ? 0 : undefined}
        onKeyDown={(e) => {
          if (onGoToServerList && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onGoToServerList();
          }
        }}
        sx={{
          cursor: onGoToServerList ? 'pointer' : 'default',
          userSelect: 'none',
          borderRadius: 2,
          p: 0.5,
          transition: 'opacity 0.2s, transform 0.2s',
          '&:hover': onGoToServerList
            ? {
                opacity: 0.9,
                transform: 'translateY(-1px)',
              }
            : undefined,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 2,
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            transition: 'background-color 0.2s, border-color 0.2s, box-shadow 0.2s',
            '&:hover': onGoToServerList
              ? {
                  backgroundColor: 'rgba(16, 185, 129, 0.25)',
                  borderColor: 'rgba(16, 185, 129, 0.6)',
                  boxShadow: '0 0 12px rgba(16, 185, 129, 0.25)',
                }
              : undefined,
          }}
        >
          <Server size={24} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc', lineHeight: 1.2 }}>
            Minecraft Wings Manager
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            Remote Daemon Node Management
          </Typography>
        </Box>
      </Stack>

      {/* Node Controls */}
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
        {nodes.length > 0 && (
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select
                value={activeNode?.id || ''}
                onChange={(e) => onSelectNode(e.target.value)}
              >
                {nodes.map((node) => (
                  <MenuItem key={node.id} value={node.id}>
                    {node.name} ({node.host}:{node.daemonPort})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Heartbeat Status Indicator */}
            {activeNode && (
              <Chip
                size="small"
                icon={isNodeOnline ? undefined : <WifiOff size={11} />}
                label={
                  isNodeOnline
                    ? nodeLatencyMs !== undefined
                      ? `${nodeLatencyMs}ms`
                      : 'Online'
                    : 'Offline'
                }
                sx={{
                  height: 24,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  backgroundColor: isNodeOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.2)',
                  color: isNodeOnline ? '#34d399' : '#f87171',
                  border: isNodeOnline ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.4)',
                }}
              />
            )}
          </Stack>
        )}

        {activeNode && onOpenNodeMetrics && (
          <Button
            variant="outlined"
            size="small"
            onClick={onOpenNodeMetrics}
            startIcon={
              isNodeOnline ? (
                <Activity size={14} color="#38bdf8" />
              ) : (
                <WifiOff size={14} color="#f87171" />
              )
            }
            sx={{
              color: isNodeOnline ? '#38bdf8' : '#f87171',
              borderColor: isNodeOnline ? 'rgba(56, 189, 248, 0.3)' : 'rgba(239, 68, 68, 0.4)',
              backgroundColor: isNodeOnline ? 'transparent' : 'rgba(239, 68, 68, 0.08)',
              '&:hover': {
                borderColor: isNodeOnline ? '#38bdf8' : '#ef4444',
                backgroundColor: isNodeOnline ? 'rgba(56, 189, 248, 0.1)' : 'rgba(239, 68, 68, 0.15)',
              },
            }}
          >
            Node Utilization
          </Button>
        )}

        <Button
          variant="outlined"
          size="small"
          onClick={onRefresh}
          startIcon={
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                animation: refreshing ? `${spinAnimation} 0.8s linear infinite` : 'none',
                transition: 'transform 0.2s ease',
              }}
            >
              <RefreshCw size={14} />
            </Box>
          }
          sx={{
            color: '#94a3b8',
            borderColor: 'rgba(255, 255, 255, 0.15)',
            '&:hover': {
              borderColor: 'rgba(255, 255, 255, 0.3)',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
            },
          }}
        >
          Refresh
        </Button>

        <Button
          variant="contained"
          size="small"
          startIcon={<Plus size={14} />}
          onClick={onOpenInstallModal}
          sx={{
            backgroundColor: '#10b981',
            color: '#ffffff',
            fontWeight: 600,
            '&:hover': { backgroundColor: '#059669' },
          }}
        >
          Connect Node (SSH)
        </Button>
      </Stack>
    </Box>
  );
};
