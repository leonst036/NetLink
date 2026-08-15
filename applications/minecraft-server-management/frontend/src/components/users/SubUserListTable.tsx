import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Box,
  Stack,
  Avatar,
} from '@mui/material';
import {
  Shield,
  Key,
  Trash2,
  Calendar,
  Layers,
  Terminal,
  FolderTree,
  Archive,
  Sliders,
} from 'lucide-react';
import { ServerSubUser, SUBUSER_PERMISSIONS_SCHEMA } from '../../types';

interface SubUserListTableProps {
  users: ServerSubUser[];
  onEdit: (user: ServerSubUser) => void;
  onDelete: (user: ServerSubUser) => void;
}

export const SubUserListTable: React.FC<SubUserListTableProps> = ({
  users,
  onEdit,
  onDelete,
}) => {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Helper to categorize granted permissions
  const getPermissionSummary = (permissions: string[]) => {
    const totalAll = SUBUSER_PERMISSIONS_SCHEMA.reduce((acc, g) => acc + g.permissions.length, 0);
    if (permissions.length >= totalAll) {
      return [{ label: 'Full Administrator', color: '#10b981', icon: <Shield size={12} /> }];
    }

    const summaries: { label: string; color: string; icon: React.ReactNode }[] = [];
    const controlCount = permissions.filter((p) => p.startsWith('control.')).length;
    const fileCount = permissions.filter((p) => p.startsWith('file.')).length;
    const backupCount = permissions.filter((p) => p.startsWith('backup.')).length;
    const settingsCount = permissions.filter((p) => p.startsWith('settings.')).length;

    if (controlCount > 0) {
      summaries.push({
        label: `Control (${controlCount})`,
        color: '#38bdf8',
        icon: <Terminal size={12} />,
      });
    }
    if (fileCount > 0) {
      summaries.push({
        label: `Files (${fileCount})`,
        color: '#a855f7',
        icon: <FolderTree size={12} />,
      });
    }
    if (backupCount > 0) {
      summaries.push({
        label: `Backups (${backupCount})`,
        color: '#f59e0b',
        icon: <Archive size={12} />,
      });
    }
    if (settingsCount > 0) {
      summaries.push({
        label: `Settings (${settingsCount})`,
        color: '#ec4899',
        icon: <Sliders size={12} />,
      });
    }

    if (summaries.length === 0) {
      summaries.push({ label: 'No Permissions', color: '#94a3b8', icon: <Layers size={12} /> });
    }

    return summaries;
  };

  const getAvatarColor = (name: string) => {
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <TableContainer
      component={Paper}
      sx={{
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <Table>
        <TableHead sx={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
          <TableRow>
            <TableCell sx={{ color: '#94a3b8', fontWeight: 600, py: 1.8 }}>User</TableCell>
            <TableCell sx={{ color: '#94a3b8', fontWeight: 600, py: 1.8 }}>Permission Groups</TableCell>
            <TableCell sx={{ color: '#94a3b8', fontWeight: 600, py: 1.8 }}>Added Date</TableCell>
            <TableCell align="right" sx={{ color: '#94a3b8', fontWeight: 600, py: 1.8 }}>
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((u) => {
            const permissionSummaries = getPermissionSummary(u.permissions);
            const avatarLetter = (u.username[0] || 'U').toUpperCase();
            const avatarBg = getAvatarColor(u.username);

            return (
              <TableRow
                key={u.id}
                sx={{
                  '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.03)' },
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                {/* User Info */}
                <TableCell>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      sx={{
                        bgcolor: avatarBg,
                        width: 36,
                        height: 36,
                        fontSize: '0.95rem',
                        fontWeight: 700,
                      }}
                    >
                      {avatarLetter}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                        {u.username}
                      </Typography>
                      {u.email ? (
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                          {u.email}
                        </Typography>
                      ) : (
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          Local collaborator
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </TableCell>

                {/* Permissions Breakdown */}
                <TableCell>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {permissionSummaries.map((p, idx) => (
                      <Chip
                        key={idx}
                        size="small"
                        icon={p.icon as React.ReactElement}
                        label={p.label}
                        sx={{
                          height: 24,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: `${p.color}22`,
                          color: p.color,
                          border: `1px solid ${p.color}44`,
                        }}
                      />
                    ))}
                  </Stack>
                </TableCell>

                {/* Added Date */}
                <TableCell sx={{ color: '#cbd5e1', fontSize: '0.85rem' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Calendar size={14} color="#64748b" />
                    <span>{formatDate(u.createdAt)}</span>
                  </Stack>
                </TableCell>

                {/* Actions */}
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Tooltip title="Edit Permissions">
                      <IconButton
                        size="small"
                        onClick={() => onEdit(u)}
                        sx={{
                          color: '#38bdf8',
                          '&:hover': { backgroundColor: 'rgba(56, 189, 248, 0.15)' },
                        }}
                      >
                        <Key size={16} />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Revoke Sub-User Access">
                      <IconButton
                        size="small"
                        onClick={() => onDelete(u)}
                        sx={{
                          color: '#f87171',
                          '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
                        }}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
