import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  UserCheck,
  Shield,
  ShieldAlert,
  UserMinus,
  Ban,
  Gamepad2,
  Compass,
  Send,
  Heart,
  Skull,
  Sparkles,
  Trash2,
  Radio,
} from 'lucide-react';
import { OnlinePlayerItem } from '../../types';
import { PlayerAvatar } from './PlayerAvatar';

interface OnlinePlayersListProps {
  players: OnlinePlayerItem[];
  isServerOnline: boolean;
  onKick: (playerName: string) => void;
  onBan: (playerName: string) => void;
  onToggleOp: (playerName: string, currentOp: boolean) => void;
  onGamemode: (playerName: string, currentMode?: string) => void;
  onTeleport: (playerName: string) => void;
  onWhisper: (playerName: string) => void;
  onHeal: (playerName: string) => void;
  onKill: (playerName: string) => void;
  onGive: (playerName: string) => void;
  onClearInventory: (playerName: string) => void;
}

export const OnlinePlayersList: React.FC<OnlinePlayersListProps> = ({
  players,
  isServerOnline,
  onKick,
  onBan,
  onToggleOp,
  onGamemode,
  onTeleport,
  onWhisper,
  onHeal,
  onKill,
  onGive,
  onClearInventory,
}) => {
  if (!isServerOnline) {
    return (
      <Box
        sx={{
          p: 6,
          textAlign: 'center',
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          borderRadius: 3,
          border: '1px dashed rgba(255, 255, 255, 0.1)',
        }}
      >
        <Radio size={40} color="#94a3b8" style={{ marginBottom: 12 }} />
        <Typography variant="h6" sx={{ color: '#f8fafc', fontWeight: 700, mb: 1 }}>
          Server is Currently Offline
        </Typography>
        <Typography variant="body2" sx={{ color: '#94a3b8', maxWidth: 450, mx: 'auto' }}>
          Start the Minecraft server from the instance control bar above to see live connected players and perform real-time in-game actions.
        </Typography>
      </Box>
    );
  }

  if (players.length === 0) {
    return (
      <Box
        sx={{
          p: 6,
          textAlign: 'center',
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          borderRadius: 3,
          border: '1px dashed rgba(255, 255, 255, 0.1)',
        }}
      >
        <UserCheck size={40} color="#10b981" style={{ marginBottom: 12 }} />
        <Typography variant="h6" sx={{ color: '#f8fafc', fontWeight: 700, mb: 1 }}>
          No Players Connected
        </Typography>
        <Typography variant="body2" sx={{ color: '#94a3b8', maxWidth: 450, mx: 'auto' }}>
          No players are currently playing on this Minecraft server. When players connect, they will appear here in real time.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {players.map((player) => (
        <Card
          key={player.name}
          sx={{
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 3,
            transition: 'border-color 0.2s',
            '&:hover': {
              borderColor: 'rgba(16, 185, 129, 0.4)',
            },
          }}
        >
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', md: 'center' }}
              spacing={2}
            >
              {/* Player Identity */}
              <Stack direction="row" spacing={2} alignItems="center">
                <PlayerAvatar name={player.name} size={48} borderRadius={2} />
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                      {player.name}
                    </Typography>
                    {player.isOp && (
                      <Chip
                        size="small"
                        icon={<Shield size={13} />}
                        label="OP"
                        sx={{
                          height: 22,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: 'rgba(168, 85, 247, 0.2)',
                          color: '#c084fc',
                          border: '1px solid rgba(168, 85, 247, 0.3)',
                        }}
                      />
                    )}
                    {player.isWhitelisted && (
                      <Chip
                        size="small"
                        icon={<UserCheck size={13} />}
                        label="Whitelisted"
                        sx={{
                          height: 22,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                        }}
                      />
                    )}
                    <Chip
                      size="small"
                      label="Online"
                      sx={{
                        height: 20,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        color: '#10b981',
                      }}
                    />
                  </Stack>
                  <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
                    {player.uuid}
                  </Typography>
                </Box>
              </Stack>

              {/* Action Toolbar */}
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                {/* Gamemode */}
                <Tooltip title="Change Gamemode">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Gamepad2 size={15} />}
                    onClick={() => onGamemode(player.name, player.gamemode)}
                    sx={{
                      color: '#94a3b8',
                      borderColor: 'rgba(255, 255, 255, 0.12)',
                      fontSize: '0.8rem',
                      '&:hover': { borderColor: '#10b981', color: '#10b981' },
                    }}
                  >
                    Mode
                  </Button>
                </Tooltip>

                {/* Teleport */}
                <Tooltip title="Teleport Player">
                  <IconButton
                    size="small"
                    onClick={() => onTeleport(player.name)}
                    sx={{ color: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.1)', '&:hover': { backgroundColor: 'rgba(56, 189, 248, 0.2)' } }}
                  >
                    <Compass size={17} />
                  </IconButton>
                </Tooltip>

                {/* Message / Whisper */}
                <Tooltip title="Send Private Message">
                  <IconButton
                    size="small"
                    onClick={() => onWhisper(player.name)}
                    sx={{ color: '#34d399', backgroundColor: 'rgba(16, 185, 129, 0.1)', '&:hover': { backgroundColor: 'rgba(16, 185, 129, 0.2)' } }}
                  >
                    <Send size={17} />
                  </IconButton>
                </Tooltip>

                {/* Heal & Feed */}
                <Tooltip title="Heal & Feed Player">
                  <IconButton
                    size="small"
                    onClick={() => onHeal(player.name)}
                    sx={{ color: '#f43f5e', backgroundColor: 'rgba(244, 63, 94, 0.1)', '&:hover': { backgroundColor: 'rgba(244, 63, 94, 0.2)' } }}
                  >
                    <Heart size={17} />
                  </IconButton>
                </Tooltip>

                {/* Give Item / XP */}
                <Tooltip title="Give Items or XP">
                  <IconButton
                    size="small"
                    onClick={() => onGive(player.name)}
                    sx={{ color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', '&:hover': { backgroundColor: 'rgba(245, 158, 11, 0.2)' } }}
                  >
                    <Sparkles size={17} />
                  </IconButton>
                </Tooltip>

                {/* Clear Inventory */}
                <Tooltip title="Clear Inventory">
                  <IconButton
                    size="small"
                    onClick={() => onClearInventory(player.name)}
                    sx={{ color: '#94a3b8', backgroundColor: 'rgba(255, 255, 255, 0.05)', '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' } }}
                  >
                    <Trash2 size={17} />
                  </IconButton>
                </Tooltip>

                {/* Kill / Slay */}
                <Tooltip title="Slay / Kill Player">
                  <IconButton
                    size="small"
                    onClick={() => onKill(player.name)}
                    sx={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.2)' } }}
                  >
                    <Skull size={17} />
                  </IconButton>
                </Tooltip>

                {/* OP / De-OP */}
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
                    {player.isOp ? <ShieldAlert size={17} /> : <Shield size={17} />}
                  </IconButton>
                </Tooltip>

                {/* Kick */}
                <Tooltip title="Kick Player">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<UserMinus size={15} />}
                    onClick={() => onKick(player.name)}
                    sx={{
                      color: '#f59e0b',
                      borderColor: 'rgba(245, 158, 11, 0.3)',
                      fontSize: '0.8rem',
                      '&:hover': { borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)' },
                    }}
                  >
                    Kick
                  </Button>
                </Tooltip>

                {/* Ban */}
                <Tooltip title="Ban Player">
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Ban size={15} />}
                    onClick={() => onBan(player.name)}
                    sx={{
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      '&:hover': { backgroundColor: '#dc2626' },
                    }}
                  >
                    Ban
                  </Button>
                </Tooltip>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};
