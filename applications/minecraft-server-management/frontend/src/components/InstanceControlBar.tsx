import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Chip,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import { Play, Square, RotateCw, Plus, LayoutGrid } from 'lucide-react';
import { NodeInfo, NodeServerItem } from '../types';

interface InstanceControlBarProps {
  activeNode: NodeInfo | null;
  servers: NodeServerItem[];
  activeServer: NodeServerItem | null;
  actionLoading: boolean;
  onSelectServer: (serverId: string) => void;
  onPowerAction: (action: 'start' | 'stop' | 'restart' | 'kill') => void;
  onOpenCreateModal: () => void;
  onBackToList: () => void;
}

export const InstanceControlBar: React.FC<InstanceControlBarProps> = ({
  activeNode,
  servers,
  activeServer,
  actionLoading,
  onSelectServer,
  onPowerAction,
  onOpenCreateModal,
  onBackToList,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 2,
        mb: 3,
        p: 2,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        borderRadius: 2,
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        {/* All Servers Hub Button */}
        <Button
          variant="outlined"
          size="small"
          startIcon={<LayoutGrid size={15} />}
          onClick={onBackToList}
          sx={{
            color: '#38bdf8',
            borderColor: 'rgba(56, 189, 248, 0.3)',
            '&:hover': {
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
            },
          }}
        >
          All Servers
        </Button>

        <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
          Instance:
        </Typography>

        {servers.length > 0 ? (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <Select
              value={activeServer?.id || ''}
              onChange={(e) => onSelectServer(e.target.value)}
            >
              {servers.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name || s.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <Typography variant="body2" sx={{ color: '#64748b', fontStyle: 'italic' }}>
            No servers on this node
          </Typography>
        )}

        {activeServer && (
          <Chip
            size="small"
            label={activeServer.status === 'online' ? 'Online' : 'Offline'}
            sx={{
              backgroundColor:
                activeServer.status === 'online'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(148, 163, 184, 0.15)',
              color: activeServer.status === 'online' ? '#34d399' : '#94a3b8',
              fontWeight: 600,
            }}
          />
        )}
      </Stack>

      <Stack direction="row" spacing={1.5}>
        {activeNode && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<Plus size={15} />}
            onClick={onOpenCreateModal}
            sx={{
              color: '#34d399',
              borderColor: 'rgba(16, 185, 129, 0.3)',
            }}
          >
            New Instance
          </Button>
        )}

        {activeServer && (
          <>
            <Button
              variant="contained"
              size="small"
              startIcon={<Play size={15} />}
              disabled={actionLoading || activeServer.status === 'online'}
              onClick={() => onPowerAction('start')}
              sx={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                '&:hover': { backgroundColor: '#059669' },
                '&.Mui-disabled': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              Start
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<Square size={15} />}
              disabled={actionLoading || activeServer.status === 'offline'}
              onClick={() => onPowerAction('stop')}
              sx={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                '&:hover': { backgroundColor: '#dc2626' },
                '&.Mui-disabled': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              Stop
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RotateCw size={15} />}
              disabled={actionLoading}
              onClick={() => onPowerAction('restart')}
              sx={{
                color: '#fbbf24',
                borderColor: 'rgba(251, 191, 36, 0.3)',
                '&:hover': {
                  borderColor: '#fbbf24',
                  backgroundColor: 'rgba(251, 191, 36, 0.1)',
                },
              }}
            >
              Restart
            </Button>
          </>
        )}
      </Stack>
    </Box>
  );
};
