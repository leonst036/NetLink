import React, { useState } from 'react';
import {
  Box,
  Typography,
  Stack,
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
  Users,
  Search,
  Shield,
  ShieldAlert,
  UserPlus,
  UserMinus,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import { KnownPlayerItem } from '../../types';
import { PlayerAvatar } from './PlayerAvatar';

interface KnownPlayersDirectoryProps {
  players: KnownPlayerItem[];
  onToggleWhitelist: (username: string, currentlyWhitelisted: boolean) => void;
  onToggleOp: (username: string, currentlyOp: boolean) => void;
  onToggleBan: (username: string, currentlyBanned: boolean) => void;
}

export const KnownPlayersDirectory: React.FC<KnownPlayersDirectoryProps> = ({
  players,
  onToggleWhitelist,
  onToggleOp,
  onToggleBan,
}) => {
  const [search, setSearch] = useState('');

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.uuid.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Stack spacing={3}>
      {/* Header and Search */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f8fafc' }}>
            All Known Players ({players.length})
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            Discovered from server cache and world profile data. You can manage roles even when players are offline.
          </Typography>
        </Box>

        <TextField
          size="small"
          placeholder="Search all players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={16} color="#94a3b8" />
              </InputAdornment>
            ),
          }}
          sx={{ width: { xs: '100%', sm: 280 } }}
        />
      </Stack>

      {/* Table of Known Players */}
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
          <Users size={36} color="#94a3b8" style={{ marginBottom: 12 }} />
          <Typography variant="subtitle1" sx={{ color: '#f8fafc', fontWeight: 600, mb: 0.5 }}>
            {search ? 'No matching players found' : 'No Player History Available'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            {search ? 'Try searching by another username or UUID.' : 'Players who connect to this Minecraft server will automatically be cached here.'}
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
                <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Player</TableCell>
                <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Roles & Flags</TableCell>
                <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>UUID</TableCell>
                <TableCell align="right" sx={{ color: '#94a3b8', fontWeight: 700 }}>Quick Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((player) => (
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
                      <Typography variant="body1" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                        {player.name}
                      </Typography>
                    </Stack>
                  </TableCell>

                  {/* Status: Online / Offline */}
                  <TableCell>
                    <Chip
                      size="small"
                      label={player.isOnline ? 'Online' : 'Offline'}
                      sx={{
                        height: 20,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        backgroundColor: player.isOnline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        color: player.isOnline ? '#10b981' : '#94a3b8',
                      }}
                    />
                  </TableCell>

                  {/* Roles & Flags */}
                  <TableCell>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap">
                      {player.isOp && (
                        <Chip
                          size="small"
                          label="OP"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            backgroundColor: 'rgba(168, 85, 247, 0.2)',
                            color: '#c084fc',
                          }}
                        />
                      )}
                      {player.isWhitelisted && (
                        <Chip
                          size="small"
                          label="Whitelisted"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: '#34d399',
                          }}
                        />
                      )}
                      {player.isBanned && (
                        <Chip
                          size="small"
                          label="Banned"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                          }}
                        />
                      )}
                      {!player.isOp && !player.isWhitelisted && !player.isBanned && (
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          Standard Player
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>

                  {/* UUID */}
                  <TableCell>
                    <Typography variant="body2" sx={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {player.uuid}
                    </Typography>
                  </TableCell>

                  {/* Quick Action Shortcuts */}
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      {/* Whitelist Toggle */}
                      <Tooltip title={player.isWhitelisted ? 'Remove from Whitelist' : 'Add to Whitelist'}>
                        <IconButton
                          size="small"
                          onClick={() => onToggleWhitelist(player.name, player.isWhitelisted)}
                          sx={{
                            color: player.isWhitelisted ? '#10b981' : '#94a3b8',
                            backgroundColor: player.isWhitelisted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            '&:hover': { backgroundColor: 'rgba(16, 185, 129, 0.25)' },
                          }}
                        >
                          {player.isWhitelisted ? <UserMinus size={15} /> : <UserPlus size={15} />}
                        </IconButton>
                      </Tooltip>

                      {/* OP Toggle */}
                      <Tooltip title={player.isOp ? 'Revoke OP Privileges' : 'Grant OP Privileges'}>
                        <IconButton
                          size="small"
                          onClick={() => onToggleOp(player.name, player.isOp)}
                          sx={{
                            color: player.isOp ? '#c084fc' : '#94a3b8',
                            backgroundColor: player.isOp ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            '&:hover': { backgroundColor: 'rgba(168, 85, 247, 0.25)' },
                          }}
                        >
                          {player.isOp ? <ShieldAlert size={15} /> : <Shield size={15} />}
                        </IconButton>
                      </Tooltip>

                      {/* Ban / Unban Toggle */}
                      <Tooltip title={player.isBanned ? 'Unban (Pardon) Player' : 'Ban Player'}>
                        <IconButton
                          size="small"
                          onClick={() => onToggleBan(player.name, player.isBanned)}
                          sx={{
                            color: player.isBanned ? '#ef4444' : '#94a3b8',
                            backgroundColor: player.isBanned ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.25)' },
                          }}
                        >
                          {player.isBanned ? <CheckCircle2 size={15} /> : <Ban size={15} />}
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
};
