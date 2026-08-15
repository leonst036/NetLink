import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Archive,
  Plus,
  RotateCcw,
  Trash2,
  Lock,
  Unlock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { NodeInfo, NodeServerItem, BackupItem } from '../types';
import {
  getNodeServerBackups,
  createNodeServerBackup,
  restoreNodeServerBackup,
  toggleLockNodeServerBackup,
  deleteNodeServerBackup,
} from '../api';

interface BackupsTabProps {
  activeNode: NodeInfo | null;
  activeServer: NodeServerItem;
}

export const BackupsTab: React.FC<BackupsTabProps> = ({ activeNode, activeServer }) => {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [backupNameInput, setBackupNameInput] = useState('');
  const [creatingBackup, setCreatingBackup] = useState(false);

  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<BackupItem | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedBackupForDelete, setSelectedBackupForDelete] = useState<BackupItem | null>(null);

  const fetchBackups = useCallback(async (isInitial = false) => {
    if (!activeNode || !activeServer) return;
    try {
      if (isInitial) setLoading(true);
      const list = await getNodeServerBackups(activeNode, activeServer.id);
      setBackups(list);
    } catch {
      // Quiet fallback
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [activeNode, activeServer.id]);

  useEffect(() => {
    fetchBackups(true);
  }, [fetchBackups]);

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

  // Handle Create Backup
  const handleCreateBackup = async () => {
    if (!activeNode || !activeServer) return;
    setCreatingBackup(true);
    setFeedback(null);
    try {
      const res = await createNodeServerBackup(activeNode, activeServer.id, backupNameInput);
      if (res.success && res.backup) {
        setFeedback({ type: 'success', message: `Backup "${res.backup.name}" created successfully!` });
        setCreateModalOpen(false);
        setBackupNameInput('');
        fetchBackups(false);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to create backup.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error creating backup.' });
    } finally {
      setCreatingBackup(false);
    }
  };

  // Handle Lock Toggle
  const handleToggleLock = async (backup: BackupItem) => {
    if (!activeNode || !activeServer) return;
    setActionLoading(true);
    try {
      const res = await toggleLockNodeServerBackup(activeNode, activeServer.id, backup.id);
      if (res.success && res.backup) {
        setBackups((prev) => prev.map((b) => (b.id === backup.id ? res.backup! : b)));
        setFeedback({
          type: 'success',
          message: `Backup ${res.backup.isLocked ? 'locked' : 'unlocked'}.`,
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error updating lock.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Restore
  const handleRestoreBackup = async () => {
    if (!activeNode || !activeServer || !selectedBackupForRestore) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await restoreNodeServerBackup(activeNode, activeServer.id, selectedBackupForRestore.id);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Server instance restored from "${selectedBackupForRestore.name}".`,
        });
        setRestoreModalOpen(false);
        setSelectedBackupForRestore(null);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to restore backup.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error restoring backup.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete
  const handleDeleteBackup = async () => {
    if (!activeNode || !activeServer || !selectedBackupForDelete) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await deleteNodeServerBackup(activeNode, activeServer.id, selectedBackupForDelete.id);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Backup "${selectedBackupForDelete.name}" deleted.`,
        });
        setDeleteModalOpen(false);
        setSelectedBackupForDelete(null);
        fetchBackups(false);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to delete backup.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error deleting backup.' });
    } finally {
      setActionLoading(false);
    }
  };

  const totalBackupBytes = backups.reduce((acc, b) => acc + b.sizeBytes, 0);

  return (
    <Stack spacing={3} sx={{ width: '100%' }}>
      {feedback && (
        <Alert
          severity={feedback.type}
          onClose={() => setFeedback(null)}
          sx={{
            backgroundColor: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: feedback.type === 'success' ? '#34d399' : '#fca5a5',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {feedback.message}
        </Alert>
      )}

      {/* Top Header Card */}
      <Card
        sx={{
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 3,
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={2}
          >
            <Box>
              <Stack direction="row" spacing={1.5} alignItems="center" mb={0.5}>
                <Archive size={22} color="#10b981" />
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                  Server Backups
                </Typography>
                <Chip
                  size="small"
                  label={`${backups.length} ${backups.length === 1 ? 'Snapshot' : 'Snapshots'}`}
                  sx={{
                    height: 22,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                />
              </Stack>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                Total backup storage: <strong style={{ color: '#cbd5e1' }}>{formatBytes(totalBackupBytes)}</strong>
              </Typography>
            </Box>

            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => fetchBackups(false)}
                startIcon={<RefreshCw size={14} />}
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
                startIcon={<Plus size={16} />}
                onClick={() => setCreateModalOpen(true)}
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
                Create Backup
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Backups List */}
      {loading ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <CircularProgress size={32} sx={{ color: '#10b981' }} />
        </Box>
      ) : backups.length === 0 ? (
        /* Empty State */
        <Card
          sx={{
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            border: '2px dashed rgba(255, 255, 255, 0.12)',
            borderRadius: 3,
            p: 6,
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              p: 2.5,
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              mb: 2,
            }}
          >
            <Archive size={36} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc', mb: 1 }}>
            No Backups Created Yet
          </Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8', maxWidth: 460, mx: 'auto', mb: 3 }}>
            Create snapshots of your server worlds, configs, and plugins to easily restore your server anytime.
          </Typography>
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => setCreateModalOpen(true)}
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
            Create First Backup
          </Button>
        </Card>
      ) : (
        /* Backups Table */
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
                          onClick={() => handleToggleLock(backup)}
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
                          onClick={() => {
                            setSelectedBackupForRestore(backup);
                            setRestoreModalOpen(true);
                          }}
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
                            onClick={() => {
                              setSelectedBackupForDelete(backup);
                              setDeleteModalOpen(true);
                            }}
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
      )}

      {/* 1. Create Backup Modal */}
      <Dialog
        open={createModalOpen}
        onClose={() => !creatingBackup && setCreateModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 3,
            color: '#f8fafc',
          },
        }}
      >
        <DialogTitle sx={{ p: 3, pb: 1 }}>Create Server Backup</DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3 }}>
            Generate a compressed archive of instance <strong>{activeServer.name}</strong>.
          </Typography>
          <TextField
            fullWidth
            label="Backup Name (Optional)"
            placeholder="e.g. Before 1.20.4 update"
            value={backupNameInput}
            onChange={(e) => setBackupNameInput(e.target.value)}
            disabled={creatingBackup}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Button
            variant="outlined"
            onClick={() => setCreateModalOpen(false)}
            disabled={creatingBackup}
            sx={{ color: '#94a3b8', borderColor: 'rgba(255, 255, 255, 0.2)' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateBackup}
            disabled={creatingBackup}
            sx={{
              backgroundColor: '#10b981',
              color: '#ffffff',
              fontWeight: 600,
              '&:hover': { backgroundColor: '#059669' },
            }}
          >
            {creatingBackup ? 'Compressing Archive...' : 'Create Backup'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 2. Restore Backup Confirmation Modal */}
      <Dialog
        open={restoreModalOpen}
        onClose={() => !actionLoading && setRestoreModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#0f172a',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 3,
            color: '#f8fafc',
          },
        }}
      >
        <DialogTitle sx={{ p: 3, pb: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <AlertTriangle size={22} color="#fbbf24" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Restore Server Backup?
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
            Restoring from <strong>{selectedBackupForRestore?.name}</strong> will overwrite current server files with the contents of this archive.
          </Typography>
          <Alert severity="warning" sx={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
            Ensure your server is stopped before restoring.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Button
            variant="outlined"
            onClick={() => setRestoreModalOpen(false)}
            disabled={actionLoading}
            sx={{ color: '#94a3b8', borderColor: 'rgba(255, 255, 255, 0.2)' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRestoreBackup}
            disabled={actionLoading}
            sx={{
              backgroundColor: '#38bdf8',
              color: '#0f172a',
              fontWeight: 700,
              '&:hover': { backgroundColor: '#0284c7', color: '#ffffff' },
            }}
          >
            {actionLoading ? 'Extracting Archive...' : 'Confirm Restore'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 3. Delete Backup Confirmation Modal */}
      <Dialog
        open={deleteModalOpen}
        onClose={() => !actionLoading && setDeleteModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#0f172a',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 3,
            color: '#f8fafc',
          },
        }}
      >
        <DialogTitle sx={{ p: 3, pb: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Trash2 size={22} color="#f87171" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Delete Backup Archive?
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            Are you sure you want to permanently delete <strong>{selectedBackupForDelete?.name}</strong> ({selectedBackupForDelete?.fileName})? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Button
            variant="outlined"
            onClick={() => setDeleteModalOpen(false)}
            disabled={actionLoading}
            sx={{ color: '#94a3b8', borderColor: 'rgba(255, 255, 255, 0.2)' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDeleteBackup}
            disabled={actionLoading}
            sx={{
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontWeight: 600,
              '&:hover': { backgroundColor: '#dc2626' },
            }}
          >
            {actionLoading ? 'Deleting...' : 'Delete Backup'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
