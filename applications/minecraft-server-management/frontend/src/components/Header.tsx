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
} from '@mui/material';
import { Server, Plus, RefreshCw, Activity } from 'lucide-react';

import { NodeInfo } from '../types';

const spinAnimation = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

interface HeaderProps {
  nodes: NodeInfo[];
  activeNode: NodeInfo | null;
  refreshing?: boolean;
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
        )}

        {activeNode && onOpenNodeMetrics && (
          <Button
            variant="outlined"
            size="small"
            onClick={onOpenNodeMetrics}
            startIcon={<Activity size={14} color="#38bdf8" />}
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
          variant="outlined"
          size="small"
          startIcon={<Plus size={15} />}
          onClick={onOpenInstallModal}
          sx={{
            color: '#34d399',
            borderColor: 'rgba(16, 185, 129, 0.3)',
            '&:hover': {
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
            },
          }}
        >
          Connect Node (SSH)
        </Button>
      </Stack>
    </Box>
  );
};

