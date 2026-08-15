import React from 'react';
import {
  Typography,
  Stack,
  IconButton,
  Tooltip,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
} from '@mui/material';
import {
  Archive,
  RotateCcw,
  Trash2,
  Lock,
  Unlock,
} from 'lucide-react';
import { BackupItem } from '../../types';

interface BackupListTableProps {
  backups: BackupItem[];
  actionLoading: boolean;
  onToggleLock: (backup: BackupItem) => void;
  onRequestRestore: (backup: BackupItem) => void;
  onRequestDelete: (backup: BackupItem) => void;
}

export const BackupListTable: React.FC<BackupListTableProps> = ({
  backups,
  actionLoading,
  onToggleLock,
  onRequestRestore,
  onRequestDelete,
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <TableContainer
      sx={{
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 3,
      }}
    >
      <Table>
        <TableHead>
          <TableRow sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <TableCell sx={{ color: '#94a3b8', fontWeight: 600, py: 2 }}>Backup Name & Archive</TableCell>
            <TableCell sx={{ color: '#94a3b8', fontWeight: 600, py: 2 }}>Size</TableCell>
            <TableCell sx={{ color: '#94a3b8', fontWeight: 600, py: 2 }}>Created At</TableCell>
            <TableCell sx={{ color: '#94a3b8', fontWeight: 600, py: 2 }}>Status</TableCell>
            <TableCell align="right" sx={{ color: '#94a3b8', fontWeight: 600, py: 2 }}>
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {backups.map((backup) => (
            <TableRow
              key={backup.id}
              hover
              sx={{
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <TableCell sx={{ py: 2 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Archive size={18} color="#10b981" />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#f8fafc' }}>
                      {backup.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
                      {backup.fileName}
                    </Typography>
                  </Box>
                </Stack>
              </TableCell>

              <TableCell sx={{ color: '#cbd5e1', fontWeight: 500 }}>
                {formatBytes(backup.sizeBytes)}
              </TableCell>

              <TableCell sx={{ color: '#94a3b8' }}>
                {formatDate(backup.createdAt)}
              </TableCell>

              <TableCell>
                {backup.isLocked ? (
                  <Chip
                    size="small"
                    icon={<Lock size={12} />}
                    label="Locked"
                    sx={{
                      height: 22,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: 'rgba(251, 191, 36, 0.15)',
                      color: '#fbbf24',
                      border: '1px solid rgba(251, 191, 36, 0.3)',
                    }}
                  />
                ) : (
                  <Chip
                    size="small"
                    label="Unlocked"
                    sx={{
                      height: 22,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      backgroundColor: 'rgba(148, 163, 184, 0.1)',
                      color: '#94a3b8',
                    }}
                  />
                )}
              </TableCell>

              <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  {/* Lock / Unlock */}
                  <Tooltip title={backup.isLocked ? 'Unlock Backup' : 'Lock Backup (Prevent Deletion)'}>
                    <IconButton
                      size="small"
                      disabled={actionLoading}
                      onClick={() => onToggleLock(backup)}
                      sx={{
                        color: backup.isLocked ? '#fbbf24' : '#94a3b8',
                        '&:hover': { color: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.08)' },
                      }}
                    >
                      {backup.isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                    </IconButton>
                  </Tooltip>

                  {/* Restore */}
                  <Tooltip title="Restore Server From This Backup">
                    <IconButton
                      size="small"
                      disabled={actionLoading}
                      onClick={() => onRequestRestore(backup)}
                      sx={{
                        color: '#38bdf8',
                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        '&:hover': { backgroundColor: 'rgba(56, 189, 248, 0.2)' },
                      }}
                    >
                      <RotateCcw size={16} />
                    </IconButton>
                  </Tooltip>

                  {/* Delete */}
                  <Tooltip title={backup.isLocked ? 'Cannot delete locked backup' : 'Delete Backup'}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={actionLoading || backup.isLocked}
                        onClick={() => onRequestDelete(backup)}
                        sx={{
                          color: '#f87171',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
                          '&.Mui-disabled': { opacity: 0.3 },
                        }}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
