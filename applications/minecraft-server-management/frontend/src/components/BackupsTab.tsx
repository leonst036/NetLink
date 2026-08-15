import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Archive, Plus, RefreshCw } from 'lucide-react';
import { NodeInfo, NodeServerItem, BackupItem } from '../types';
import {
  getNodeServerBackups,
  createNodeServerBackup,
  restoreNodeServerBackup,
  toggleLockNodeServerBackup,
  deleteNodeServerBackup,
} from '../api';
import { BackupListTable } from './backups/BackupListTable';
import { CreateBackupModal } from './backups/CreateBackupModal';
import { RestoreBackupModal } from './backups/RestoreBackupModal';
import { DeleteBackupModal } from './backups/DeleteBackupModal';

interface BackupsTabProps {
  activeNode: NodeInfo | null;
  activeServer: NodeServerItem;
}

export const BackupsTab: React.FC<BackupsTabProps> = ({ activeNode, activeServer }) => {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
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

  // 1. Create Backup Action
  const handleCreateBackup = async (name: string) => {
    if (!activeNode || !activeServer) return;
    setCreatingBackup(true);
    setFeedback(null);
    try {
      const res = await createNodeServerBackup(activeNode, activeServer.id, name);
      if (res.success && res.backup) {
        setFeedback({ type: 'success', message: `Backup "${res.backup.name}" created successfully!` });
        setCreateModalOpen(false);
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

  // 2. Lock / Unlock Action
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

  // 3. Restore Action
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

  // 4. Delete Action
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
        /* Modular Backups Table */
        <BackupListTable
          backups={backups}
          actionLoading={actionLoading}
          onToggleLock={handleToggleLock}
          onRequestRestore={(backup) => {
            setSelectedBackupForRestore(backup);
            setRestoreModalOpen(true);
          }}
          onRequestDelete={(backup) => {
            setSelectedBackupForDelete(backup);
            setDeleteModalOpen(true);
          }}
        />
      )}

      {/* Sub-module Modals */}
      <CreateBackupModal
        open={createModalOpen}
        serverName={activeServer.name || activeServer.id}
        creating={creatingBackup}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateBackup}
      />

      <RestoreBackupModal
        open={restoreModalOpen}
        backup={selectedBackupForRestore}
        restoring={actionLoading}
        onClose={() => setRestoreModalOpen(false)}
        onConfirmRestore={handleRestoreBackup}
      />

      <DeleteBackupModal
        open={deleteModalOpen}
        backup={selectedBackupForDelete}
        deleting={actionLoading}
        onClose={() => setDeleteModalOpen(false)}
        onConfirmDelete={handleDeleteBackup}
      />
    </Stack>
  );
};
