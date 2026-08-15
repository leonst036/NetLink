import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Stack,
  Box,
  Checkbox,
  Chip,
  Divider,
  Alert,
} from '@mui/material';
import { Key, Sparkles } from 'lucide-react';
import { ServerSubUser, SUBUSER_PERMISSIONS_SCHEMA } from '../../types';

interface EditSubUserModalProps {
  open: boolean;
  user: ServerSubUser | null;
  onClose: () => void;
  onSubmit: (data: { permissions: string[]; email?: string }) => Promise<void>;
  loading: boolean;
}

export const EditSubUserModal: React.FC<EditSubUserModalProps> = ({
  open,
  user,
  onClose,
  onSubmit,
  loading,
}) => {
  const [email, setEmail] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setSelectedPermissions(user.permissions || []);
    }
  }, [user]);

  const allPermissionKeys = SUBUSER_PERMISSIONS_SCHEMA.flatMap((g) => g.permissions.map((p) => p.key));

  const applyPreset = (preset: 'admin' | 'moderator' | 'console' | 'viewer') => {
    switch (preset) {
      case 'admin':
        setSelectedPermissions([...allPermissionKeys]);
        break;
      case 'moderator':
        setSelectedPermissions([
          'control.start',
          'control.stop',
          'control.restart',
          'control.console',
          'file.read',
          'backup.view',
          'backup.create',
        ]);
        break;
      case 'console':
        setSelectedPermissions(['control.console', 'control.start', 'control.restart']);
        break;
      case 'viewer':
        setSelectedPermissions(['file.read', 'backup.view']);
        break;
    }
  };

  const togglePermission = (key: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const toggleGroup = (keys: string[]) => {
    const allSelected = keys.every((k) => selectedPermissions.includes(k));
    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((p) => !keys.includes(p)));
    } else {
      setSelectedPermissions((prev) => Array.from(new Set([...prev, ...keys])));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    await onSubmit({
      email: email.trim() || undefined,
      permissions: selectedPermissions,
    });
  };

  if (!user) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 3,
        },
      }}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Key size={22} color="#38bdf8" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Edit Permissions: {user.username}
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            Modify granted server permissions for this collaborator.
          </Typography>
        </DialogTitle>

        <DialogContent dividers sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <Stack spacing={3}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)} sx={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5' }}>
                {error}
              </Alert>
            )}

            <TextField
              label="Email Address"
              placeholder="user@minecraft.net"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              size="small"
            />

            {/* Quick Presets Bar */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <Sparkles size={16} color="#fbbf24" />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                  Quick Permission Presets:
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  label="Full Administrator"
                  clickable
                  onClick={() => applyPreset('admin')}
                  sx={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600 }}
                />
                <Chip
                  label="Moderator (Control & Files)"
                  clickable
                  onClick={() => applyPreset('moderator')}
                  sx={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 600 }}
                />
                <Chip
                  label="Console Only"
                  clickable
                  onClick={() => applyPreset('console')}
                  sx={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', fontWeight: 600 }}
                />
                <Chip
                  label="Read-Only Viewer"
                  clickable
                  onClick={() => applyPreset('viewer')}
                  sx={{ backgroundColor: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.3)', fontWeight: 600 }}
                />
              </Stack>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            {/* Permissions */}
            <Stack spacing={2.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                Assigned Permissions ({selectedPermissions.length} selected)
              </Typography>

              {SUBUSER_PERMISSIONS_SCHEMA.map((group) => {
                const groupKeys = group.permissions.map((p) => p.key);
                const allSelected = groupKeys.every((k) => selectedPermissions.includes(k));

                return (
                  <Box
                    key={group.id}
                    sx={{
                      p: 2,
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 2,
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                          {group.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                          {group.description}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        onClick={() => toggleGroup(groupKeys)}
                        sx={{ fontSize: '0.75rem', color: allSelected ? '#f87171' : '#38bdf8' }}
                      >
                        {allSelected ? 'Deselect Group' : 'Select All'}
                      </Button>
                    </Stack>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                        gap: 1.5,
                        mt: 1.5,
                      }}
                    >
                      {group.permissions.map((p) => {
                        const isChecked = selectedPermissions.includes(p.key);
                        return (
                          <Box
                            key={p.key}
                            onClick={() => togglePermission(p.key)}
                            sx={{
                              p: 1.5,
                              backgroundColor: isChecked ? 'rgba(56, 189, 248, 0.08)' : 'rgba(0, 0, 0, 0.2)',
                              border: isChecked ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255, 255, 255, 0.04)',
                              borderRadius: 1.5,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 1,
                              '&:hover': {
                                backgroundColor: isChecked ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                              },
                            }}
                          >
                            <Checkbox
                              checked={isChecked}
                              size="small"
                              sx={{ p: 0, mt: 0.2, color: '#64748b', '&.Mui-checked': { color: '#38bdf8' } }}
                            />
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: isChecked ? '#f8fafc' : '#cbd5e1' }}>
                                {p.label}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>
                                {p.description}
                              </Typography>
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2.5, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <Button onClick={onClose} sx={{ color: '#94a3b8' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={<Key size={16} />}
            sx={{
              backgroundColor: '#38bdf8',
              color: '#0f172a',
              fontWeight: 700,
              px: 3,
              '&:hover': { backgroundColor: '#0284c7', color: '#ffffff' },
            }}
          >
            {loading ? 'Updating Permissions...' : 'Save Permissions'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
