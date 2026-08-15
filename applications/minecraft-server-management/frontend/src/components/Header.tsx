import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import { Server, Plus, RefreshCw } from 'lucide-react';
import { NodeInfo } from '../types';

interface HeaderProps {
  nodes: NodeInfo[];
  activeNode: NodeInfo | null;
  onSelectNode: (nodeId: string) => void;
  onRefresh: () => void;
  onOpenInstallModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  nodes,
  activeNode,
  onSelectNode,
  onRefresh,
  onOpenInstallModal,
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
      {/* App Branding */}
      <Stack direction="row" spacing={2} alignItems="center">
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

        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshCw size={14} />}
          onClick={onRefresh}
          sx={{
            color: '#94a3b8',
            borderColor: 'rgba(255, 255, 255, 0.15)',
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
