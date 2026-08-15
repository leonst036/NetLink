import React, { useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  InputAdornment,
  Tooltip,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  Ban,
  UserX,
  Globe,
  Search,
  Plus,
} from 'lucide-react';
import { BannedPlayerItem, BannedIpItem } from '../../types';
import { PlayerAvatar } from './PlayerAvatar';

interface BansSectionProps {
  bannedPlayers: BannedPlayerItem[];
  bannedIps: BannedIpItem[];
  onAddBan: (isIp: boolean) => void;
  onUnbanPlayer: (username: string) => void;
  onUnbanIp: (ip: string) => void;
}

export const BansSection: React.FC<BansSectionProps> = ({
  bannedPlayers,
  bannedIps,
  onAddBan,
  onUnbanPlayer,
  onUnbanIp,
}) => {
  const [subTab, setSubTab] = useState<'players' | 'ips'>('players');
  const [search, setSearch] = useState('');

  const filteredPlayers = bannedPlayers.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.reason && p.reason.toLowerCase().includes(search.toLowerCase())) ||
    p.uuid.toLowerCase().includes(search.toLowerCase())
  );

  const filteredIps = bannedIps.filter((i) =>
    i.ip.includes(search) ||
    (i.reason && i.reason.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Stack spacing={3}>
      {/* Sub-tabs & Action Toolbar */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
      >
        <Tabs
          value={subTab}
          onChange={(_, val) => setSubTab(val)}
          sx={{
            minHeight: 40,
            '& .MuiTabs-indicator': { backgroundColor: '#ef4444', height: 2 },
            '& .MuiTab-root': {
              minHeight: 40,
              color: '#94a3b8',
              fontWeight: 600,
              fontSize: '0.85rem',
              '&.Mui-selected': { color: '#ef4444' },
            },
          }}
        >
          <Tab
            value="players"
            icon={<UserX size={15} />}
            iconPosition="start"
            label={`Banned Players (${bannedPlayers.length})`}
          />
          <Tab
            value="ips"
            icon={<Globe size={15} />}
            iconPosition="start"
            label={`Banned IPs (${bannedIps.length})`}
          />
        </Tabs>

        <Stack direction="row" spacing={1.5} alignItems="center" width={{ xs: '100%', sm: 'auto' }}>
          <TextField
            size="small"
            placeholder={subTab === 'players' ? 'Search banned players...' : 'Search banned IPs...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} color="#94a3b8" />
                </InputAdornment>
              ),
            }}
            sx={{ width: { xs: '100%', sm: 240 } }}
          />

          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => onAddBan(subTab === 'ips')}
            sx={{
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontWeight: 600,
              borderRadius: 2,
              whiteSpace: 'nowrap',
              '&:hover': { backgroundColor: '#dc2626' },
            }}
          >
            {subTab === 'players' ? 'Ban Player' : 'Ban IP'}
          </Button>
        </Stack>
      </Stack>

      {/* Content for Banned Players */}
      {subTab === 'players' && (
        filteredPlayers.length === 0 ? (
          <Box
            sx={{
              p: 5,
              textAlign: 'center',
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              borderRadius: 3,
              border: '1px dashed rgba(255, 255, 255, 0.08)',
            }}
          >
            <Ban size={36} color="#94a3b8" style={{ marginBottom: 12 }} />
            <Typography variant="subtitle1" sx={{ color: '#f8fafc', fontWeight: 600, mb: 0.5 }}>
              {search ? 'No matching banned players found' : 'No Players Banned'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>
              {search ? 'Try adjusting your search criteria.' : 'There are currently no banned players on this server.'}
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
                  <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Ban Reason</TableCell>
                  <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Banned On</TableCell>
                  <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Source</TableCell>
                  <TableCell align="right" sx={{ color: '#94a3b8', fontWeight: 700 }}>Pardon (Unban)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPlayers.map((player) => (
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
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                            {player.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
                            {player.uuid}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#f87171' }}>
                        {player.reason || 'Banned by operator'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        {player.created}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        {player.source}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Pardon / Unban Player">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => onUnbanPlayer(player.name)}
                          sx={{
                            color: '#34d399',
                            borderColor: 'rgba(16, 185, 129, 0.3)',
                            fontSize: '0.75rem',
                            '&:hover': { borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)' },
                          }}
                        >
                          Pardon
                        </Button>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )
      )}

      {/* Content for Banned IPs */}
      {subTab === 'ips' && (
        filteredIps.length === 0 ? (
          <Box
            sx={{
              p: 5,
              textAlign: 'center',
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              borderRadius: 3,
              border: '1px dashed rgba(255, 255, 255, 0.08)',
            }}
          >
            <Globe size={36} color="#94a3b8" style={{ marginBottom: 12 }} />
            <Typography variant="subtitle1" sx={{ color: '#f8fafc', fontWeight: 600, mb: 0.5 }}>
              {search ? 'No matching banned IPs found' : 'No IPs Banned'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>
              {search ? 'Try adjusting your search criteria.' : 'There are currently no banned IP addresses on this server.'}
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
                  <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>IP Address</TableCell>
                  <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Ban Reason</TableCell>
                  <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Banned On</TableCell>
                  <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Source</TableCell>
                  <TableCell align="right" sx={{ color: '#94a3b8', fontWeight: 700 }}>Pardon (Unban)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredIps.map((bannedIp) => (
                  <TableRow
                    key={bannedIp.ip}
                    sx={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      '&:last-child': { borderBottom: 'none' },
                      '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.02)' },
                    }}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Globe size={18} color="#ef4444" />
                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                          {bannedIp.ip}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#f87171' }}>
                        {bannedIp.reason || 'Banned by operator'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        {bannedIp.created}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        {bannedIp.source}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Pardon / Unban IP Address">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => onUnbanIp(bannedIp.ip)}
                          sx={{
                            color: '#34d399',
                            borderColor: 'rgba(16, 185, 129, 0.3)',
                            fontSize: '0.75rem',
                            '&:hover': { borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)' },
                          }}
                        >
                          Pardon IP
                        </Button>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )
      )}
    </Stack>
  );
};
