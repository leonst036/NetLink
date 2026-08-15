import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Box,
  Chip,
  RadioGroup,
  Radio,
} from '@mui/material';
import {
  UserMinus,
  Ban,
  Shield,
  UserPlus,
  Send,
  Sparkles,
  Compass,
  Radio as BroadcastIcon,
  Gamepad2,
} from 'lucide-react';
import { PlayerAvatar } from './PlayerAvatar';
import { OnlinePlayerItem } from '../../types';

// 1. Kick Modal
export const KickModal: React.FC<{
  open: boolean;
  playerName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}> = ({ open, playerName, onClose, onConfirm }) => {
  const [reason, setReason] = useState('Kicked by server operator');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { backgroundColor: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#f8fafc' }}>
        <UserMinus size={20} color="#f59e0b" />
        Kick Player
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <PlayerAvatar name={playerName} size={42} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                {playerName}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                Disconnects player from active server session.
              </Typography>
            </Box>
          </Stack>
          <TextField
            label="Kick Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            size="small"
            autoFocus
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Button onClick={onClose} sx={{ color: '#94a3b8' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => onConfirm(reason)}
          sx={{ backgroundColor: '#f59e0b', color: '#000', fontWeight: 700, '&:hover': { backgroundColor: '#d97706' } }}
        >
          Kick Player
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// 2. Ban Modal
export const BanModal: React.FC<{
  open: boolean;
  initialTarget?: string;
  isIpMode?: boolean;
  onClose: () => void;
  onConfirm: (target: string, reason: string, isIp: boolean) => void;
}> = ({ open, initialTarget = '', isIpMode = false, onClose, onConfirm }) => {
  const [target, setTarget] = useState(initialTarget);
  const [reason, setReason] = useState('Banned by server operator');
  const [isIp, setIsIp] = useState(isIpMode);

  React.useEffect(() => {
    setTarget(initialTarget);
    setIsIp(isIpMode);
  }, [initialTarget, isIpMode, open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { backgroundColor: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#f8fafc' }}>
        <Ban size={20} color="#ef4444" />
        {isIp ? 'Ban IP Address' : 'Ban Player'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {!isIp && target && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <PlayerAvatar name={target} size={42} />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                  {target}
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  Permanently prevents player from joining.
                </Typography>
              </Box>
            </Stack>
          )}
          <TextField
            label={isIp ? 'IP Address' : 'Username'}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            fullWidth
            size="small"
            placeholder={isIp ? 'e.g. 192.168.1.100' : 'e.g. PlayerName'}
          />
          <TextField
            label="Ban Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            size="small"
          />
          <FormControlLabel
            control={<Checkbox checked={isIp} onChange={(e) => setIsIp(e.target.checked)} sx={{ color: '#10b981', '&.Mui-checked': { color: '#10b981' } }} />}
            label={<Typography variant="body2" sx={{ color: '#94a3b8' }}>Ban IP Address instead of Username</Typography>}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Button onClick={onClose} sx={{ color: '#94a3b8' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!target.trim()}
          onClick={() => onConfirm(target.trim(), reason, isIp)}
          sx={{ backgroundColor: '#ef4444', color: '#fff', fontWeight: 700, '&:hover': { backgroundColor: '#dc2626' } }}
        >
          Confirm Ban
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// 3. Add OP Modal
export const AddOpModal: React.FC<{
  open: boolean;
  initialUsername?: string;
  onClose: () => void;
  onConfirm: (username: string, level: number, bypassLimit: boolean) => void;
}> = ({ open, initialUsername = '', onClose, onConfirm }) => {
  const [username, setUsername] = useState(initialUsername);
  const [level, setLevel] = useState<number>(4);
  const [bypassLimit, setBypassLimit] = useState(false);

  React.useEffect(() => {
    setUsername(initialUsername);
  }, [initialUsername, open]);

  const levelDescriptions: Record<number, string> = {
    1: 'Level 1: Bypass spawn area protection.',
    2: 'Level 2: Use cheat commands & command blocks (/clear, /difficulty, /effect, /gamemode, /gamerule, /give, /tp).',
    3: 'Level 3: Manage players (/ban, /deop, /kick, /op).',
    4: 'Level 4: Full Administrator (/stop, /save, /reload, all console permissions).',
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { backgroundColor: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#f8fafc' }}>
        <Shield size={20} color="#a855f7" />
        Grant Operator Privileges (OP)
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label="Minecraft Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            fullWidth
            size="small"
            placeholder="e.g. Notch"
          />

          <FormControl fullWidth size="small">
            <InputLabel id="op-level-label">OP Permission Level</InputLabel>
            <Select
              labelId="op-level-label"
              value={level}
              label="OP Permission Level"
              onChange={(e) => setLevel(Number(e.target.value))}
            >
              <MenuItem value={4}>Level 4 - Full Administrator (Recommended)</MenuItem>
              <MenuItem value={3}>Level 3 - Moderator (Ban, Kick, Op)</MenuItem>
              <MenuItem value={2}>Level 2 - Game Master (Cheats, Teleport, Give)</MenuItem>
              <MenuItem value={1}>Level 1 - Spawn Bypass Only</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ p: 2, backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 2, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <Typography variant="caption" sx={{ color: '#c084fc', fontWeight: 600, display: 'block', mb: 0.5 }}>
              Permission Details:
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
              {levelDescriptions[level]}
            </Typography>
          </Box>

          <FormControlLabel
            control={<Checkbox checked={bypassLimit} onChange={(e) => setBypassLimit(e.target.checked)} sx={{ color: '#a855f7', '&.Mui-checked': { color: '#a855f7' } }} />}
            label={<Typography variant="body2" sx={{ color: '#94a3b8' }}>Bypass server player slot limit</Typography>}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Button onClick={onClose} sx={{ color: '#94a3b8' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!username.trim()}
          onClick={() => onConfirm(username.trim(), level, bypassLimit)}
          sx={{ backgroundColor: '#a855f7', color: '#fff', fontWeight: 700, '&:hover': { backgroundColor: '#9333ea' } }}
        >
          Add Operator
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// 4. Add Whitelist Modal
export const AddWhitelistModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: (username: string) => void;
}> = ({ open, onClose, onConfirm }) => {
  const [username, setUsername] = useState('');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { backgroundColor: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#f8fafc' }}>
        <UserPlus size={20} color="#10b981" />
        Add to Whitelist
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            Allows the player to join the server when whitelist mode is active.
          </Typography>
          <TextField
            label="Minecraft Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            fullWidth
            size="small"
            placeholder="e.g. Steve"
            autoFocus
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Button onClick={onClose} sx={{ color: '#94a3b8' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!username.trim()}
          onClick={() => {
            onConfirm(username.trim());
            setUsername('');
          }}
          sx={{ backgroundColor: '#10b981', color: '#fff', fontWeight: 700, '&:hover': { backgroundColor: '#059669' } }}
        >
          Add Player
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// 5. Teleport Modal
export const TeleportModal: React.FC<{
  open: boolean;
  playerName: string;
  onlinePlayers: OnlinePlayerItem[];
  onClose: () => void;
  onConfirm: (params: { target?: string; x?: number; y?: number; z?: number }) => void;
}> = ({ open, playerName, onlinePlayers, onClose, onConfirm }) => {
  const [mode, setMode] = useState<'player' | 'coords'>('player');
  const [targetPlayer, setTargetPlayer] = useState('');
  const [coords, setCoords] = useState({ x: 0, y: 64, z: 0 });

  const otherPlayers = onlinePlayers.filter((p) => p.name.toLowerCase() !== playerName.toLowerCase());

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { backgroundColor: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#f8fafc' }}>
        <Compass size={20} color="#38bdf8" />
        Teleport {playerName}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <RadioGroup row value={mode} onChange={(e) => setMode(e.target.value as any)}>
            <FormControlLabel value="player" control={<Radio size="small" sx={{ color: '#38bdf8', '&.Mui-checked': { color: '#38bdf8' } }} />} label="To Player" />
            <FormControlLabel value="coords" control={<Radio size="small" sx={{ color: '#38bdf8', '&.Mui-checked': { color: '#38bdf8' } }} />} label="To Coordinates (X, Y, Z)" />
          </RadioGroup>

          {mode === 'player' ? (
            <FormControl fullWidth size="small">
              <InputLabel id="target-player-select">Select Target Player</InputLabel>
              <Select
                labelId="target-player-select"
                value={targetPlayer}
                label="Select Target Player"
                onChange={(e) => setTargetPlayer(e.target.value)}
              >
                {otherPlayers.map((p) => (
                  <MenuItem key={p.name} value={p.name}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
              {otherPlayers.length === 0 && (
                <Typography variant="caption" sx={{ color: '#f87171', mt: 1 }}>
                  No other online players found. Use coordinates instead.
                </Typography>
              )}
            </FormControl>
          ) : (
            <Stack direction="row" spacing={1.5}>
              <TextField label="X" type="number" size="small" value={coords.x} onChange={(e) => setCoords({ ...coords, x: Number(e.target.value) })} />
              <TextField label="Y" type="number" size="small" value={coords.y} onChange={(e) => setCoords({ ...coords, y: Number(e.target.value) })} />
              <TextField label="Z" type="number" size="small" value={coords.z} onChange={(e) => setCoords({ ...coords, z: Number(e.target.value) })} />
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Button onClick={onClose} sx={{ color: '#94a3b8' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={mode === 'player' && !targetPlayer}
          onClick={() => {
            if (mode === 'player') onConfirm({ target: targetPlayer });
            else onConfirm({ x: coords.x, y: coords.y, z: coords.z });
          }}
          sx={{ backgroundColor: '#38bdf8', color: '#000', fontWeight: 700, '&:hover': { backgroundColor: '#0284c7' } }}
        >
          Teleport
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// 6. Whisper (Message) Modal
export const WhisperModal: React.FC<{
  open: boolean;
  playerName: string;
  onClose: () => void;
  onConfirm: (message: string) => void;
}> = ({ open, playerName, onClose, onConfirm }) => {
  const [message, setMessage] = useState('');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { backgroundColor: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#f8fafc' }}>
        <Send size={20} color="#10b981" />
        Message {playerName}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            Sends a private whisper message (/tell) to {playerName}.
          </Typography>
          <TextField
            label="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            fullWidth
            size="small"
            multiline
            rows={2}
            autoFocus
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Button onClick={onClose} sx={{ color: '#94a3b8' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!message.trim()}
          onClick={() => {
            onConfirm(message.trim());
            setMessage('');
          }}
          sx={{ backgroundColor: '#10b981', color: '#fff', fontWeight: 700, '&:hover': { backgroundColor: '#059669' } }}
        >
          Send Message
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// 7. Give Item / XP Modal
export const GiveItemModal: React.FC<{
  open: boolean;
  playerName: string;
  onClose: () => void;
  onConfirmItem: (item: string, amount: number) => void;
  onConfirmXp: (amount: number) => void;
}> = ({ open, playerName, onClose, onConfirmItem, onConfirmXp }) => {
  const [tab, setTab] = useState<'item' | 'xp'>('item');
  const [item, setItem] = useState('diamond');
  const [amount, setAmount] = useState<number>(64);
  const [xpLevels, setXpLevels] = useState<number>(10);

  const popularItems = [
    'diamond',
    'netherite_ingot',
    'golden_apple',
    'elytra',
    'totem_of_undying',
    'cooked_beef',
    'iron_block',
    'emerald',
    'ender_pearl',
    'experience_bottle',
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { backgroundColor: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#f8fafc' }}>
        <Sparkles size={20} color="#f59e0b" />
        Give Items or XP to {playerName}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <RadioGroup row value={tab} onChange={(e) => setTab(e.target.value as any)}>
            <FormControlLabel value="item" control={<Radio size="small" sx={{ color: '#f59e0b', '&.Mui-checked': { color: '#f59e0b' } }} />} label="Give Item" />
            <FormControlLabel value="xp" control={<Radio size="small" sx={{ color: '#f59e0b', '&.Mui-checked': { color: '#f59e0b' } }} />} label="Grant XP Levels" />
          </RadioGroup>

          {tab === 'item' ? (
            <>
              <TextField
                label="Item Identifier"
                value={item}
                onChange={(e) => setItem(e.target.value)}
                fullWidth
                size="small"
                placeholder="e.g. diamond or netherite_sword"
              />
              <Box>
                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>
                  Quick select popular items:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {popularItems.map((pItem) => (
                    <Chip
                      key={pItem}
                      label={pItem}
                      size="small"
                      clickable
                      onClick={() => setItem(pItem)}
                      sx={{
                        backgroundColor: item === pItem ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        color: item === pItem ? '#f59e0b' : '#94a3b8',
                        border: '1px solid',
                        borderColor: item === pItem ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)',
                      }}
                    />
                  ))}
                </Box>
              </Box>
              <TextField
                label="Amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
                fullWidth
                size="small"
              />
            </>
          ) : (
            <TextField
              label="XP Levels to Add"
              type="number"
              value={xpLevels}
              onChange={(e) => setXpLevels(Number(e.target.value))}
              fullWidth
              size="small"
              helperText="Adds experience levels directly to the player."
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Button onClick={onClose} sx={{ color: '#94a3b8' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            if (tab === 'item') onConfirmItem(item.trim(), amount);
            else onConfirmXp(xpLevels);
          }}
          sx={{ backgroundColor: '#f59e0b', color: '#000', fontWeight: 700, '&:hover': { backgroundColor: '#d97706' } }}
        >
          {tab === 'item' ? 'Give Item' : 'Add XP'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// 8. Gamemode Modal
export const GamemodeModal: React.FC<{
  open: boolean;
  playerName: string;
  currentGamemode?: string;
  onClose: () => void;
  onConfirm: (gamemode: string) => void;
}> = ({ open, playerName, currentGamemode = 'survival', onClose, onConfirm }) => {
  const [gamemode, setGamemode] = useState(currentGamemode);

  React.useEffect(() => {
    setGamemode(currentGamemode);
  }, [currentGamemode, open]);

  const modes = [
    { key: 'survival', label: 'Survival', desc: 'Standard survival mode with health, hunger, and damage.' },
    { key: 'creative', label: 'Creative', desc: 'Unlimited resources, flight, and invulnerability.' },
    { key: 'adventure', label: 'Adventure', desc: 'Custom map mode where block breaking is restricted.' },
    { key: 'spectator', label: 'Spectator', desc: 'Invisible, noclipping through blocks, observe only.' },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { backgroundColor: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#f8fafc' }}>
        <Gamepad2 size={20} color="#10b981" />
        Set Gamemode for {playerName}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {modes.map((m) => (
            <Box
              key={m.key}
              onClick={() => setGamemode(m.key)}
              sx={{
                p: 2,
                borderRadius: 2,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: gamemode === m.key ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
                backgroundColor: gamemode === m.key ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 0, 0, 0.2)',
                transition: 'all 0.15s ease',
                '&:hover': {
                  borderColor: 'rgba(16, 185, 129, 0.5)',
                },
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: gamemode === m.key ? '#34d399' : '#f8fafc' }}>
                {m.label}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                {m.desc}
              </Typography>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Button onClick={onClose} sx={{ color: '#94a3b8' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => onConfirm(gamemode)}
          sx={{ backgroundColor: '#10b981', color: '#fff', fontWeight: 700, '&:hover': { backgroundColor: '#059669' } }}
        >
          Apply Gamemode
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// 9. Broadcast Modal
export const BroadcastModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: (message: string) => void;
}> = ({ open, onClose, onConfirm }) => {
  const [message, setMessage] = useState('');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { backgroundColor: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#f8fafc' }}>
        <BroadcastIcon size={20} color="#ec4899" />
        Broadcast Server Announcement
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            Broadcasts a message to all online players in chat (/say).
          </Typography>
          <TextField
            label="Announcement Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="e.g. Server will restart for maintenance in 10 minutes!"
            autoFocus
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Button onClick={onClose} sx={{ color: '#94a3b8' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!message.trim()}
          onClick={() => {
            onConfirm(message.trim());
            setMessage('');
          }}
          sx={{ backgroundColor: '#ec4899', color: '#fff', fontWeight: 700, '&:hover': { backgroundColor: '#db2777' } }}
        >
          Broadcast to All
        </Button>
      </DialogActions>
    </Dialog>
  );
};
