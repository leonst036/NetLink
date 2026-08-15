import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  Switch,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  ShieldCheck,
  UserPlus,
  Search,
  Trash2,
  Lock,
  Unlock,
} from 'lucide-react';
import { WhitelistPlayerItem } from '../../types';
import { PlayerAvatar } from './PlayerAvatar';

interface WhitelistSectionProps {
  whitelist: WhitelistPlayerItem[];
  whitelistEnabled: boolean;
  onToggleWhitelist: (enabled: boolean) => void;
  onAddPlayer: () => void;
  onRemovePlayer: (username: string) => void;
}

export const WhitelistSection: React.FC<WhitelistSectionProps> = ({
  whitelist,
  whitelistEnabled,
  onToggleWhitelist,
  onAddPlayer,
  onRemovePlayer,
}) => {
  const [search, setSearch] = useState('');

  const filtered = whitelist.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.uuid.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Stack spacing={3}>
      {/* Whitelist Status Control Card */}
      <Card
        sx={{
          backgroundColor: whitelistEnabled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(15, 23, 42, 0.65)',
          border: '1px solid',
          borderColor: whitelistEnabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)',
          borderRadius: 3,
        }}
      >
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={2}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  backgroundColor: whitelistEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: whitelistEnabled ? '#10b981' : '#94a3b8',
                }}
              >
                {whitelistEnabled ? <Lock size={24} /> : <Unlock size={24} />}
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                  Whitelist Protection: {whitelistEnabled ? 'Enforced' : 'Disabled'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  {whitelistEnabled
                    ? 'Only whitelisted players listed below are allowed to connect to this Minecraft server.'
                    : 'Any player can join this server without prior whitelist approval.'}
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                {whitelistEnabled ? 'Active' : 'Off'}
              </Typography>
              <Switch
                checked={whitelistEnabled}
                onChange={(e) => onToggleWhitelist(e.target.checked)}
                color="primary"
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Whitelist Header and Search Filter */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
      >
        <TextField
          size="small"
          placeholder="Search whitelisted players..."
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
          startIcon={<UserPlus size={16} />}
          onClick={onAddPlayer}
          sx={{
            backgroundColor: '#10b981',
            color: '#ffffff',
            fontWeight: 600,
            borderRadius: 2,
            '&:hover': { backgroundColor: '#059669' },
          }}
        >
          Add Player to Whitelist
        </Button>
      </Stack>

      {/* Whitelist Table */}
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
          <ShieldCheck size={36} color="#94a3b8" style={{ marginBottom: 12 }} />
          <Typography variant="subtitle1" sx={{ color: '#f8fafc', fontWeight: 600, mb: 0.5 }}>
            {search ? 'No matching players found' : 'Whitelist is Empty'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            {search
              ? 'Try adjusting your search criteria.'
              : 'Add player usernames to the whitelist to restrict access when whitelist mode is enabled.'}
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
                <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>UUID</TableCell>
                <TableCell align="right" sx={{ color: '#94a3b8', fontWeight: 700 }}>Actions</TableCell>
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
                  <TableCell>
                    <Typography variant="body2" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
                      {player.uuid}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Remove from Whitelist">
                      <IconButton
                        size="small"
                        onClick={() => onRemovePlayer(player.name)}
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
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
};
