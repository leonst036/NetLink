import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Stack,
  Button,
  TextField,
  InputAdornment,
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
} from '@mui/material';
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { NodeInfo, NodeServerItem, ServerSubUser } from '../types';
import {
  getServerSubUsers,
  addServerSubUser,
  updateServerSubUser,
  deleteServerSubUser,
} from '../api';
import { SubUserListTable } from './users/SubUserListTable';
import { AddSubUserModal } from './users/AddSubUserModal';
import { EditSubUserModal } from './users/EditSubUserModal';
import { DeleteSubUserModal } from './users/DeleteSubUserModal';

interface UsersTabProps {
  activeNode: NodeInfo | null;
  activeServer: NodeServerItem;
}

export const UsersTab: React.FC<UsersTabProps> = ({ activeServer }) => {
  const [users, setUsers] = useState<ServerSubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ServerSubUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<ServerSubUser | null>(null);

  const fetchUsers = useCallback(async (showSpinner = false) => {
    if (!activeServer) return;
    try {
      if (showSpinner) setLoading(true);
      const list = await getServerSubUsers(activeServer.id);
      setUsers(list);
    } catch {
      // Quiet fallback
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [activeServer.id]);

  useEffect(() => {
    fetchUsers(true);
  }, [fetchUsers]);

  const handleAddUser = async (data: { username: string; email?: string; permissions: string[] }) => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await addServerSubUser(activeServer.id, data);
      if (res.success && res.user) {
        setUsers((prev) => [res.user!, ...prev]);
        setAddModalOpen(false);
        setFeedback({ type: 'success', message: `Sub-user "${data.username}" successfully added!` });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to add sub-user.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error inviting sub-user.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateUser = async (data: { permissions: string[]; email?: string }) => {
    if (!editingUser) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await updateServerSubUser(activeServer.id, editingUser.id, data);
      if (res.success && res.user) {
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? res.user! : u)));
        setEditingUser(null);
        setFeedback({ type: 'success', message: `Permissions updated for "${editingUser.username}"!` });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to update permissions.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error updating permissions.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await deleteServerSubUser(activeServer.id, deletingUser.id);
      if (res.success) {
        setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
        setDeletingUser(null);
        setFeedback({ type: 'success', message: `Access revoked for "${deletingUser.username}".` });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to delete sub-user.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error revoking access.' });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Stack spacing={3}>
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
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={2}
          >
            <Box>
              <Stack direction="row" spacing={1.5} alignItems="center" mb={0.5}>
                <Users size={24} color="#38bdf8" />
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                  Sub-Users & Collaborators
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                Grant team members and moderators granular access to server console, files, backups, and controls.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1.5} alignItems="center" width={{ xs: '100%', md: 'auto' }}>
              <TextField
                size="small"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={16} color="#64748b" />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: { xs: '100%', sm: 220 } }}
              />

              <Button
                variant="outlined"
                onClick={() => fetchUsers(false)}
                startIcon={<RefreshCw size={16} />}
                sx={{
                  color: '#94a3b8',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  '&:hover': { borderColor: 'rgba(255, 255, 255, 0.3)', backgroundColor: 'rgba(255, 255, 255, 0.04)' },
                }}
              >
                Refresh
              </Button>

              <Button
                variant="contained"
                onClick={() => setAddModalOpen(true)}
                startIcon={<UserPlus size={16} />}
                sx={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  fontWeight: 700,
                  px: 2.5,
                  '&:hover': { backgroundColor: '#059669' },
                }}
              >
                Add Sub-User
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Collaborators List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={36} sx={{ color: '#10b981' }} />
        </Box>
      ) : users.length === 0 ? (
        <Card
          sx={{
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 3,
            textAlign: 'center',
            py: 8,
            px: 3,
          }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              p: 2,
              borderRadius: '50%',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              color: '#38bdf8',
              mb: 2,
            }}
          >
            <ShieldCheck size={40} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc', mb: 1 }}>
            No Sub-Users Assigned
          </Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8', maxWidth: 450, mx: 'auto', mb: 3 }}>
            You have not added any sub-users to this Minecraft server instance yet. Invite teammates or server staff with fine-grained access rules.
          </Typography>
          <Button
            variant="contained"
            onClick={() => setAddModalOpen(true)}
            startIcon={<UserPlus size={16} />}
            sx={{
              backgroundColor: '#10b981',
              color: '#ffffff',
              fontWeight: 700,
              px: 3,
              '&:hover': { backgroundColor: '#059669' },
            }}
          >
            Invite First Sub-User
          </Button>
        </Card>
      ) : (
        <SubUserListTable
          users={filteredUsers}
          onEdit={(u) => setEditingUser(u)}
          onDelete={(u) => setDeletingUser(u)}
        />
      )}

      {/* Modals */}
      <AddSubUserModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={handleAddUser}
        loading={actionLoading}
      />

      <EditSubUserModal
        open={Boolean(editingUser)}
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSubmit={handleUpdateUser}
        loading={actionLoading}
      />

      <DeleteSubUserModal
        open={Boolean(deletingUser)}
        user={deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDeleteUser}
        loading={actionLoading}
      />
    </Stack>
  );
};
