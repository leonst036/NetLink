import React, { useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  Shield,
  Search,
  Trash2,
  Crown,
  Plus,
} from 'lucide-react';
import { OpPlayerItem } from '../../types';
import { PlayerAvatar } from './PlayerAvatar';

interface OpsSectionProps {
  ops: OpPlayerItem[];
  onAddOp: () => void;
  onRemoveOp: (username: string) => void;
}

export const OpsSection: React.FC<OpsSectionProps> = ({
  ops,
  onAddOp,
  onRemoveOp,
}) => {
  const [search, setSearch] = useState('');

  const filtered = ops.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.uuid.toLowerCase().includes(search.toLowerCase())
  );

  const getLevelBadge = (level: number) => {
    switch (level) {
      case 4:
        return { label: 'Level 4 (Admin)', color: '#c084fc', bg: 'rgba(168, 85, 247, 0.2)' };
      case 3:
        return { label: 'Level 3 (Mod)', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.2)' };
      case 2:
        return { label: 'Level 2 (Game Master)', color: '#34d399', bg: 'rgba(16, 185, 129, 0.2)' };
      case 1:
      default:
        return { label: 'Level 1 (Spawn)', color: '#94a3b8', bg: 'rgba(255, 255, 255, 0.1)' };
    }
  };

  return (
    <Stack spacing={3}>
      {/* Header and Search Filter */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
      >
        <TextField
          size="small"
          placeholder="Search operators..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={16} color="#94a3b8" />
              </InputAdornment>
            ),
          }}
          sx={{ width: { xs: '100%', sm: 300 } }}
        />

        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={onAddOp}
          sx={{
            backgroundColor: '#a855f7',
            color: '#ffffff',
            fontWeight: 600,
            borderRadius: 2,
            '&:hover': { backgroundColor: '#9333ea' },
          }}
        >
          Add Operator (OP)
        </Button>
      </Stack>

      {/* Operators Table */}
      {filtered.length === 0 ? (
        <Box
          sx={{
            p: 5,
            textAlign: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            borderRadius: 3,
            border: '1px dashed rgba(255, 255, 255, 0.08)',
          }}
        >
          <Shield size={36} color="#94a3b8" style={{ marginBottom: 12 }} />
          <Typography variant="subtitle1" sx={{ color: '#f8fafc', fontWeight: 600, mb: 0.5 }}>
            {search ? 'No matching operators found' : 'No Operators Assigned'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            {search
              ? 'Try adjusting your search criteria.'
              : 'Add player usernames as operators to grant them server administration privileges.'}
          </Typography>
        </Box>
      ) : (
        <TableContainer
          component={Paper}
          sx={{
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 3,
          }}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Operator</TableCell>
                <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Permission Level</TableCell>
                <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Bypass Limit</TableCell>
                <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>UUID</TableCell>
                <TableCell align="right" sx={{ color: '#94a3b8', fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((player) => {
                const badge = getLevelBadge(player.level);
                return (
                  <TableRow
                    key={player.name}
                    sx={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      '&:last-child': { borderBottom: 'none' },
                      '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.02)' },
                    }}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <PlayerAvatar name={player.name} size={36} borderRadius={1.5} />
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Crown size={15} color="#c084fc" />
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                            {player.name}
                          </Typography>
                        </Stack>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={badge.label}
                        sx={{
                          height: 22,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: badge.bg,
                          color: badge.color,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={player.bypassesPlayerLimit ? 'Yes' : 'No'}
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          backgroundColor: player.bypassesPlayerLimit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: player.bypassesPlayerLimit ? '#34d399' : '#94a3b8',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
                        {player.uuid}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Revoke Operator Privileges">
                        <IconButton
                          size="small"
                          onClick={() => onRemoveOp(player.name)}
                          sx={{
                            color: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
                          }}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
};
