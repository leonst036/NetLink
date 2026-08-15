import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  Chip,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Users,
  UserCheck,
  Shield,
  Ban,
  Radio,
  RefreshCw,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  NodeInfo,
  NodeServerItem,
  PlayersOverviewResponse,
} from '../types';
import {
  getServerPlayers,
  executePlayerAction,
  addWhitelistPlayer,
  removeWhitelistPlayer,
  toggleServerWhitelist,
  addOpPlayer,
  removeOpPlayer,
  banPlayerOrIp,
  unbanPlayerOrIp,
  sendServerBroadcast,
} from '../api';
import { OnlinePlayersList } from './players/OnlinePlayersList';
import { WhitelistSection } from './players/WhitelistSection';
import { OpsSection } from './players/OpsSection';
import { BansSection } from './players/BansSection';
import { KnownPlayersDirectory } from './players/KnownPlayersDirectory';
import {
  KickModal,
  BanModal,
  AddOpModal,
  AddWhitelistModal,
  TeleportModal,
  WhisperModal,
  GiveItemModal,
  GamemodeModal,
  BroadcastModal,
} from './players/PlayerModals';

interface PlayersTabProps {
  activeNode: NodeInfo | null;
  activeServer: NodeServerItem;
}

export const PlayersTab: React.FC<PlayersTabProps> = ({
  activeNode,
  activeServer,
}) => {
  const [data, setData] = useState<PlayersOverviewResponse>({
    onlinePlayers: [],
    whitelist: [],
    ops: [],
    bannedPlayers: [],
    bannedIps: [],
    knownPlayers: [],
    whitelistEnabled: false,
    maxPlayers: 20,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subTab, setSubTab] = useState<'online' | 'whitelist' | 'ops' | 'bans' | 'known'>('online');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [kickModal, setKickModal] = useState<{ open: boolean; player: string }>({ open: false, player: '' });
  const [banModal, setBanModal] = useState<{ open: boolean; target: string; isIp: boolean }>({ open: false, target: '', isIp: false });
  const [addOpModal, setAddOpModal] = useState<{ open: boolean; username: string }>({ open: false, username: '' });
  const [whitelistModalOpen, setWhitelistModalOpen] = useState(false);
  const [teleportModal, setTeleportModal] = useState<{ open: boolean; player: string }>({ open: false, player: '' });
  const [whisperModal, setWhisperModal] = useState<{ open: boolean; player: string }>({ open: false, player: '' });
  const [giveModal, setGiveModal] = useState<{ open: boolean; player: string }>({ open: false, player: '' });
  const [gamemodeModal, setGamemodeModal] = useState<{ open: boolean; player: string; currentMode?: string }>({ open: false, player: '' });
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);

  const isServerOnline = activeServer.status === 'online';

  const fetchPlayers = useCallback(async (isInitial = false) => {
    if (!activeNode || !activeServer) return;
    try {
      if (isInitial) setLoading(true);
      const res = await getServerPlayers(activeNode, activeServer.id);
      setData(res);
    } catch {
      // Quiet fallback
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [activeNode, activeServer]);

  useEffect(() => {
    fetchPlayers(true);
    const interval = setInterval(() => {
      fetchPlayers(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchPlayers]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPlayers(false);
      setFeedback({ type: 'success', message: 'Player list synchronized with server.' });
    } finally {
      setRefreshing(false);
    }
  };

  // --- Actions ---

  // 1. Kick
  const handleKickConfirm = async (reason: string) => {
    if (!activeNode) return;
    const player = kickModal.player;
    setKickModal({ open: false, player: '' });
    try {
      const res = await executePlayerAction(activeNode, activeServer.id, 'kick', player, { reason });
      if (res.success) {
        setFeedback({ type: 'success', message: `Player ${player} was kicked from the server.` });
        fetchPlayers(false);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to kick player.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error executing kick.' });
    }
  };

  // 2. Ban
  const handleBanConfirm = async (target: string, reason: string, isIp: boolean) => {
    if (!activeNode) return;
    setBanModal({ open: false, target: '', isIp: false });
    try {
      const res = await banPlayerOrIp(activeNode, activeServer.id, target, reason, isIp);
      if (res.success) {
        setFeedback({ type: 'success', message: `${isIp ? 'IP' : 'Player'} "${target}" has been banned.` });
        fetchPlayers(false);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to ban target.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error executing ban.' });
    }
  };

  // 3. Unban Player / IP
  const handleUnbanPlayer = async (username: string) => {
    if (!activeNode) return;
    try {
      const res = await unbanPlayerOrIp(activeNode, activeServer.id, username, false);
      if (res.success) {
        setFeedback({ type: 'success', message: `Pardoned player "${username}".` });
        fetchPlayers(false);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to unban player.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleUnbanIp = async (ip: string) => {
    if (!activeNode) return;
    try {
      const res = await unbanPlayerOrIp(activeNode, activeServer.id, ip, true);
      if (res.success) {
        setFeedback({ type: 'success', message: `Pardoned IP "${ip}".` });
        fetchPlayers(false);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to unban IP.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // 4. OP Management
  const handleAddOpConfirm = async (username: string, level: number, bypassLimit: boolean) => {
    if (!activeNode) return;
    setAddOpModal({ open: false, username: '' });
    try {
      const res = await addOpPlayer(activeNode, activeServer.id, username, level, bypassLimit);
      if (res.success) {
        setFeedback({ type: 'success', message: `Granted Level ${level} OP privileges to "${username}".` });
        fetchPlayers(false);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to add operator.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleRemoveOp = async (username: string) => {
    if (!activeNode) return;
    try {
      const res = await removeOpPlayer(activeNode, activeServer.id, username);
      if (res.success) {
        setFeedback({ type: 'success', message: `Revoked operator privileges from "${username}".` });
        fetchPlayers(false);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to remove operator.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // 5. Whitelist Management
  const handleAddWhitelistConfirm = async (username: string) => {
    if (!activeNode) return;
    setWhitelistModalOpen(false);
    try {
      const res = await addWhitelistPlayer(activeNode, activeServer.id, username);
      if (res.success) {
        setFeedback({ type: 'success', message: `Added "${username}" to the whitelist.` });
        fetchPlayers(false);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to add to whitelist.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleRemoveWhitelist = async (username: string) => {
    if (!activeNode) return;
    try {
      const res = await removeWhitelistPlayer(activeNode, activeServer.id, username);
      if (res.success) {
        setFeedback({ type: 'success', message: `Removed "${username}" from the whitelist.` });
        fetchPlayers(false);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to remove from whitelist.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleToggleWhitelist = async (enabled: boolean) => {
    if (!activeNode) return;
    try {
      const res = await toggleServerWhitelist(activeNode, activeServer.id, enabled);
      if (res.success) {
        setData((prev) => ({ ...prev, whitelistEnabled: enabled }));
        setFeedback({
          type: 'success',
          message: `Whitelist protection is now ${enabled ? 'enforced' : 'disabled'}.`,
        });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to toggle whitelist.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // 6. In-game live actions
  const handleGamemodeConfirm = async (gamemode: string) => {
    if (!activeNode) return;
    const player = gamemodeModal.player;
    setGamemodeModal({ open: false, player: '' });
    try {
      const res = await executePlayerAction(activeNode, activeServer.id, 'gamemode', player, { gamemode });
      if (res.success) {
        setFeedback({ type: 'success', message: `Changed gamemode of ${player} to ${gamemode}.` });
        fetchPlayers(false);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to change gamemode.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleTeleportConfirm = async (params: { target?: string; x?: number; y?: number; z?: number }) => {
    if (!activeNode) return;
    const player = teleportModal.player;
    setTeleportModal({ open: false, player: '' });
    try {
      const res = await executePlayerAction(activeNode, activeServer.id, 'tp', player, params);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || `Teleported ${player}.` });
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to teleport player.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleWhisperConfirm = async (message: string) => {
    if (!activeNode) return;
    const player = whisperModal.player;
    setWhisperModal({ open: false, player: '' });
    try {
      const res = await executePlayerAction(activeNode, activeServer.id, 'msg', player, { message });
      if (res.success) {
        setFeedback({ type: 'success', message: `Whispered to ${player}.` });
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to send whisper.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleHeal = async (player: string) => {
    if (!activeNode) return;
    try {
      const res = await executePlayerAction(activeNode, activeServer.id, 'heal', player);
      if (res.success) {
        setFeedback({ type: 'success', message: `Healed & fed ${player}.` });
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to heal player.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleKill = async (player: string) => {
    if (!activeNode) return;
    try {
      const res = await executePlayerAction(activeNode, activeServer.id, 'kill', player);
      if (res.success) {
        setFeedback({ type: 'success', message: `Slayed player ${player}.` });
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to slay player.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleGiveItem = async (item: string, amount: number) => {
    if (!activeNode) return;
    const player = giveModal.player;
    setGiveModal({ open: false, player: '' });
    try {
      const res = await executePlayerAction(activeNode, activeServer.id, 'give', player, { item, amount });
      if (res.success) {
        setFeedback({ type: 'success', message: `Gave ${amount}x ${item} to ${player}.` });
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to give item.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleGiveXp = async (amount: number) => {
    if (!activeNode) return;
    const player = giveModal.player;
    setGiveModal({ open: false, player: '' });
    try {
      const res = await executePlayerAction(activeNode, activeServer.id, 'xp', player, { amount });
      if (res.success) {
        setFeedback({ type: 'success', message: `Added ${amount} XP levels to ${player}.` });
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to add XP.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleClearInventory = async (player: string) => {
    if (!activeNode) return;
    try {
      const res = await executePlayerAction(activeNode, activeServer.id, 'clear', player);
      if (res.success) {
        setFeedback({ type: 'success', message: `Cleared inventory of ${player}.` });
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to clear inventory.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleBroadcastConfirm = async (message: string) => {
    if (!activeNode) return;
    setBroadcastModalOpen(false);
    try {
      const res = await sendServerBroadcast(activeNode, activeServer.id, message);
      if (res.success) {
        setFeedback({ type: 'success', message: 'Broadcast announcement sent to all players.' });
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to broadcast message.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  return (
    <Stack spacing={3} sx={{ width: '100%' }}>
      {/* Top Overview Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
          },
          gap: 2.5,
          width: '100%',
        }}
      >
        {/* 1. Online Players Counter */}
        <Card
          sx={{
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 3,
          }}
        >
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <UserCheck size={18} color="#10b981" />
                <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                  Online Players
                </Typography>
              </Stack>
              <Chip
                size="small"
                label={isServerOnline ? 'Live' : 'Offline'}
                sx={{
                  height: 20,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: isServerOnline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: isServerOnline ? '#10b981' : '#94a3b8',
                }}
              />
            </Stack>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc' }}>
              {isServerOnline ? data.onlinePlayers.length : 0}{' '}
              <Typography component="span" variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                / {data.maxPlayers} max
              </Typography>
            </Typography>
          </CardContent>
        </Card>

        {/* 2. Whitelist Status */}
        <Card
          sx={{
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 3,
          }}
        >
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                {data.whitelistEnabled ? <Lock size={18} color="#38bdf8" /> : <Unlock size={18} color="#94a3b8" />}
                <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                  Whitelist
                </Typography>
              </Stack>
              <Chip
                size="small"
                label={data.whitelistEnabled ? 'Enforced' : 'Off'}
                sx={{
                  height: 20,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: data.whitelistEnabled ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: data.whitelistEnabled ? '#38bdf8' : '#94a3b8',
                }}
              />
            </Stack>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc' }}>
              {data.whitelist.length}{' '}
              <Typography component="span" variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                players listed
              </Typography>
            </Typography>
          </CardContent>
        </Card>

        {/* 3. Operators (OPs) */}
        <Card
          sx={{
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 3,
          }}
        >
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Shield size={18} color="#a855f7" />
                <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                  Operators
                </Typography>
              </Stack>
              <Chip
                size="small"
                label="Admins"
                sx={{
                  height: 20,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(168, 85, 247, 0.2)',
                  color: '#c084fc',
                }}
              />
            </Stack>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc' }}>
              {data.ops.length}{' '}
              <Typography component="span" variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                with OP roles
              </Typography>
            </Typography>
          </CardContent>
        </Card>

        {/* 4. Bans Counter */}
        <Card
          sx={{
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 3,
          }}
        >
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Ban size={18} color="#ef4444" />
                <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                  Bans
                </Typography>
              </Stack>
              <Chip
                size="small"
                label={`${data.bannedIps.length} IPs`}
                sx={{
                  height: 20,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#f87171',
                }}
              />
            </Stack>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc' }}>
              {data.bannedPlayers.length}{' '}
              <Typography component="span" variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                players banned
              </Typography>
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Broadcast Quick Action Bar */}
      <Card
        sx={{
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 3,
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ p: 1, borderRadius: '50%', backgroundColor: 'rgba(236, 72, 153, 0.15)', color: '#ec4899' }}>
                <Radio size={20} />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                  Server Broadcast & In-Game Communication
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  Send instantaneous announcements to all active players on the server.
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="center">
              <Tooltip title="Synchronize Player Data">
                <IconButton
                  size="small"
                  disabled={refreshing}
                  onClick={handleManualRefresh}
                  sx={{ color: '#94a3b8', '&:hover': { color: '#10b981' } }}
                >
                  <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
                </IconButton>
              </Tooltip>

              <Button
                variant="contained"
                disabled={!isServerOnline}
                startIcon={<Radio size={16} />}
                onClick={() => setBroadcastModalOpen(true)}
                sx={{
                  backgroundColor: '#ec4899',
                  color: '#ffffff',
                  fontWeight: 600,
                  borderRadius: 2,
                  '&:hover': { backgroundColor: '#db2777' },
                }}
              >
                Broadcast Announcement
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Sub-Navigation Tabs */}
      <Box sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Tabs
          value={subTab}
          onChange={(_, val) => setSubTab(val)}
          sx={{
            minHeight: 44,
            '& .MuiTabs-indicator': { backgroundColor: '#10b981', height: 3 },
            '& .MuiTab-root': {
              minHeight: 44,
              color: '#94a3b8',
              fontWeight: 600,
              fontSize: '0.9rem',
              '&.Mui-selected': { color: '#10b981' },
            },
          }}
        >
          <Tab
            value="online"
            icon={<UserCheck size={17} />}
            iconPosition="start"
            label={`Online Players (${isServerOnline ? data.onlinePlayers.length : 0})`}
          />
          <Tab
            value="whitelist"
            icon={<Lock size={17} />}
            iconPosition="start"
            label={`Whitelist (${data.whitelist.length})`}
          />
          <Tab
            value="ops"
            icon={<Shield size={17} />}
            iconPosition="start"
            label={`Operators (${data.ops.length})`}
          />
          <Tab
            value="bans"
            icon={<Ban size={17} />}
            iconPosition="start"
            label={`Bans (${data.bannedPlayers.length + data.bannedIps.length})`}
          />
          <Tab
            value="known"
            icon={<Users size={17} />}
            iconPosition="start"
            label={`All Players Directory (${data.knownPlayers.length})`}
          />
        </Tabs>
      </Box>

      {/* Feedback Banner */}
      {feedback && (
        <Alert
          severity={feedback.type}
          onClose={() => setFeedback(null)}
          sx={{
            backgroundColor: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: '#f8fafc',
            border: '1px solid',
            borderColor: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
          }}
        >
          {feedback.message}
        </Alert>
      )}

      {/* Main Tab Panels */}
      {loading ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <CircularProgress size={32} sx={{ color: '#10b981' }} />
        </Box>
      ) : (
        <>
          {subTab === 'online' && (
            <OnlinePlayersList
              players={data.onlinePlayers}
              isServerOnline={isServerOnline}
              onKick={(player) => setKickModal({ open: true, player })}
              onBan={(player) => setBanModal({ open: true, target: player, isIp: false })}
              onToggleOp={(player, isOp) => (isOp ? handleRemoveOp(player) : setAddOpModal({ open: true, username: player }))}
              onGamemode={(player, currentMode) => setGamemodeModal({ open: true, player, currentMode })}
              onTeleport={(player) => setTeleportModal({ open: true, player })}
              onWhisper={(player) => setWhisperModal({ open: true, player })}
              onHeal={handleHeal}
              onKill={handleKill}
              onGive={(player) => setGiveModal({ open: true, player })}
              onClearInventory={handleClearInventory}
            />
          )}

          {subTab === 'whitelist' && (
            <WhitelistSection
              whitelist={data.whitelist}
              whitelistEnabled={data.whitelistEnabled}
              onToggleWhitelist={handleToggleWhitelist}
              onAddPlayer={() => setWhitelistModalOpen(true)}
              onRemovePlayer={handleRemoveWhitelist}
            />
          )}

          {subTab === 'ops' && (
            <OpsSection
              ops={data.ops}
              onAddOp={() => setAddOpModal({ open: true, username: '' })}
              onRemoveOp={handleRemoveOp}
            />
          )}

          {subTab === 'bans' && (
            <BansSection
              bannedPlayers={data.bannedPlayers}
              bannedIps={data.bannedIps}
              onAddBan={(isIp) => setBanModal({ open: true, target: '', isIp })}
              onUnbanPlayer={handleUnbanPlayer}
              onUnbanIp={handleUnbanIp}
            />
          )}

          {subTab === 'known' && (
            <KnownPlayersDirectory
              players={data.knownPlayers}
              onToggleWhitelist={(name, isWl) => (isWl ? handleRemoveWhitelist(name) : handleAddWhitelistConfirm(name))}
              onToggleOp={(name, isOp) => (isOp ? handleRemoveOp(name) : setAddOpModal({ open: true, username: name }))}
              onToggleBan={(name, isBanned) => (isBanned ? handleUnbanPlayer(name) : setBanModal({ open: true, target: name, isIp: false }))}
            />
          )}
        </>
      )}

      {/* Action Modals */}
      <KickModal
        open={kickModal.open}
        playerName={kickModal.player}
        onClose={() => setKickModal({ open: false, player: '' })}
        onConfirm={handleKickConfirm}
      />

      <BanModal
        open={banModal.open}
        initialTarget={banModal.target}
        isIpMode={banModal.isIp}
        onClose={() => setBanModal({ open: false, target: '', isIp: false })}
        onConfirm={handleBanConfirm}
      />

      <AddOpModal
        open={addOpModal.open}
        initialUsername={addOpModal.username}
        onClose={() => setAddOpModal({ open: false, username: '' })}
        onConfirm={handleAddOpConfirm}
      />

      <AddWhitelistModal
        open={whitelistModalOpen}
        onClose={() => setWhitelistModalOpen(false)}
        onConfirm={handleAddWhitelistConfirm}
      />

      <TeleportModal
        open={teleportModal.open}
        playerName={teleportModal.player}
        onlinePlayers={data.onlinePlayers}
        onClose={() => setTeleportModal({ open: false, player: '' })}
        onConfirm={handleTeleportConfirm}
      />

      <WhisperModal
        open={whisperModal.open}
        playerName={whisperModal.player}
        onClose={() => setWhisperModal({ open: false, player: '' })}
        onConfirm={handleWhisperConfirm}
      />

      <GiveItemModal
        open={giveModal.open}
        playerName={giveModal.player}
        onClose={() => setGiveModal({ open: false, player: '' })}
        onConfirmItem={handleGiveItem}
        onConfirmXp={handleGiveXp}
      />

      <GamemodeModal
        open={gamemodeModal.open}
        playerName={gamemodeModal.player}
        currentGamemode={gamemodeModal.currentMode}
        onClose={() => setGamemodeModal({ open: false, player: '' })}
        onConfirm={handleGamemodeConfirm}
      />

      <BroadcastModal
        open={broadcastModalOpen}
        onClose={() => setBroadcastModalOpen(false)}
        onConfirm={handleBroadcastConfirm}
      />
    </Stack>
  );
};
