import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  Chip,
  Tabs,
  Tab,
  TextField,
  Grid,
  Select,
  MenuItem,
  FormControl,
  Snackbar,
  Alert,
  CircularProgress,
  ThemeProvider,
  createTheme,
  CssBaseline,
} from '@mui/material';
import { WindowLayout } from '@netlink/ui';
import {
  Server,
  Play,
  Square,
  RotateCw,
  LayoutDashboard,
  Terminal,
  Plus,
  Send,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { NodeInfo, NodeServerItem } from './types';
import {
  getNodes,
  getNodeServers,
  powerNodeServer,
  sendNodeServerCommand,
  getNodeServerLogs,
} from './api';
import { InstallNodeModal } from './components/InstallNodeModal';
import { CreateServerModal } from './components/CreateServerModal';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
    },
    background: {
      default: '#020617',
      paper: '#0f172a',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputLabel-root': {
            color: '#94a3b8',
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: '#34d399',
          },
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            color: '#f8fafc',
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.18)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(16, 185, 129, 0.6)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#10b981',
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          color: '#f8fafc',
          '& fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.18)',
          },
          '&:hover fieldset': {
            borderColor: 'rgba(16, 185, 129, 0.6)',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#10b981',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

export default function App() {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [servers, setServers] = useState<NodeServerItem[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);

  const [currentTab, setCurrentTab] = useState<'overview' | 'console'>('overview');
  const [commandInput, setCommandInput] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [createServerModalOpen, setCreateServerModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Load registered nodes on mount
  const loadNodes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getNodes();
      setNodes(data);
      if (data.length > 0) {
        setActiveNodeId((current) => current || data[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  // Active items
  const activeNode = nodes.find((n) => n.id === activeNodeId) || nodes[0] || null;

  // Load servers when activeNode changes
  const loadServers = useCallback(async () => {
    if (!activeNode) {
      setServers([]);
      setActiveServerId(null);
      return;
    }
    try {
      const serverList = await getNodeServers(activeNode);
      setServers(serverList);
      if (serverList.length > 0) {
        setActiveServerId((curr) => (curr && serverList.some((s) => s.id === curr) ? curr : serverList[0].id));
      } else {
        setActiveServerId(null);
      }
    } catch {
      setServers([]);
    }
  }, [activeNode]);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const activeServer = servers.find((s) => s.id === activeServerId) || null;

  // Poll server logs
  const fetchLogs = useCallback(async () => {
    if (!activeNode || !activeServerId) return;
    try {
      const latestLogs = await getNodeServerLogs(activeNode, activeServerId);
      setLogs(latestLogs);
    } catch {
      // Ignore poll error
    }
  }, [activeNode, activeServerId]);

  useEffect(() => {
    if (activeServer) {
      fetchLogs();
      const interval = setInterval(fetchLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [activeServer, fetchLogs]);

  // Power actions
  const handlePower = async (action: 'start' | 'stop' | 'restart' | 'kill') => {
    if (!activeNode || !activeServerId) return;
    setActionLoading(true);
    try {
      const res = await powerNodeServer(activeNode, activeServerId, action);
      if (res.success) {
        setToast({ message: `Action "${action}" dispatched to server.`, type: 'success' });
        setTimeout(loadServers, 1500);
      } else {
        setToast({ message: res.error || 'Power action failed.', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Network error', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Send command
  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNode || !activeServerId || !commandInput.trim()) return;

    const cmd = commandInput.trim();
    setCommandInput('');
    try {
      await sendNodeServerCommand(activeNode, activeServerId, cmd);
      fetchLogs();
    } catch (err: any) {
      setToast({ message: `Failed to send command: ${err.message}`, type: 'error' });
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <WindowLayout>
        <Box
          sx={{
            minHeight: '100%',
            width: '100%',
            p: { xs: 2, sm: 3, md: 4 },
            color: '#f8fafc',
            boxSizing: 'border-box',
          }}
        >
          <Container maxWidth="lg" disableGutters>
            {/* Header */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', md: 'center' },
                gap: 2,
                pb: 3,
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#10b981',
                  }}
                >
                  <Server size={24} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc', lineHeight: 1.2 }}>
                    Minecraft Wings Manager
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                    Remote Daemon Node Management
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                {/* Node Selector */}
                {nodes.length > 0 && (
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <Select
                      value={activeNode?.id || ''}
                      onChange={(e) => setActiveNodeId(e.target.value)}
                    >
                      {nodes.map((node) => (
                        <MenuItem key={node.id} value={node.id}>
                          {node.name} ({node.host}:{node.daemonPort})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshCw size={14} />}
                  onClick={() => {
                    loadNodes();
                    loadServers();
                  }}
                  sx={{
                    color: '#94a3b8',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                  }}
                >
                  Refresh
                </Button>

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Plus size={15} />}
                  onClick={() => setInstallModalOpen(true)}
                  sx={{
                    color: '#34d399',
                    borderColor: 'rgba(16, 185, 129, 0.3)',
                    '&:hover': {
                      borderColor: '#10b981',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    },
                  }}
                >
                  Connect Node (SSH)
                </Button>
              </Stack>
            </Box>

            {loading ? (
              <Box sx={{ py: 10, textAlign: 'center' }}>
                <CircularProgress size={32} sx={{ color: '#10b981' }} />
              </Box>
            ) : nodes.length === 0 ? (
              /* Empty State: No Nodes */
              <Box sx={{ mt: 6, display: 'flex', justifyContent: 'center' }}>
                <Card
                  sx={{
                    maxWidth: 520,
                    width: '100%',
                    backgroundColor: 'rgba(15, 23, 42, 0.7)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 3,
                    p: 4,
                    textAlign: 'center',
                  }}
                >
                  <CardContent sx={{ p: 0 }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        p: 2,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        mb: 2,
                      }}
                    >
                      <Server size={36} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc', mb: 1 }}>
                      No Wings Nodes Connected
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3 }}>
                      Connect to a Linux server over SSH to automatically install the Wings daemon and manage Minecraft servers.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Plus size={16} />}
                      onClick={() => setInstallModalOpen(true)}
                      sx={{
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        px: 3,
                        borderRadius: 2,
                        '&:hover': { backgroundColor: '#059669' },
                      }}
                    >
                      Connect Server via SSH
                    </Button>
                  </CardContent>
                </Card>
              </Box>
            ) : (
              /* Nodes Exist */
              <Box sx={{ mt: 3 }}>
                {/* Server Instance Header Bar */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2,
                    mb: 3,
                    p: 2,
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    borderRadius: 2,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                      Instance:
                    </Typography>
                    {servers.length > 0 ? (
                      <FormControl size="small" sx={{ minWidth: 180 }}>
                        <Select
                          value={activeServerId || ''}
                          onChange={(e) => setActiveServerId(e.target.value)}
                        >
                          {servers.map((s) => (
                            <MenuItem key={s.id} value={s.id}>
                              {s.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <Typography variant="body2" sx={{ color: '#64748b', fontStyle: 'italic' }}>
                        No servers on this node
                      </Typography>
                    )}

                    {activeServer && (
                      <Chip
                        size="small"
                        label={activeServer.status === 'online' ? 'Online' : 'Offline'}
                        sx={{
                          backgroundColor:
                            activeServer.status === 'online'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(148, 163, 184, 0.15)',
                          color: activeServer.status === 'online' ? '#34d399' : '#94a3b8',
                          fontWeight: 600,
                        }}
                      />
                    )}
                  </Stack>

                  <Stack direction="row" spacing={1.5}>
                    {activeNode && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Plus size={15} />}
                        onClick={() => setCreateServerModalOpen(true)}
                        sx={{
                          color: '#34d399',
                          borderColor: 'rgba(16, 185, 129, 0.3)',
                        }}
                      >
                        New Instance
                      </Button>
                    )}

                    {activeServer && (
                      <>
                        <Button
                          variant="contained"
                          size="small"
                          disabled={actionLoading || activeServer.status === 'online'}
                          startIcon={<Play size={15} />}
                          onClick={() => handlePower('start')}
                          sx={{
                            backgroundColor: '#10b981',
                            '&:hover': { backgroundColor: '#059669' },
                          }}
                        >
                          Start
                        </Button>

                        <Button
                          variant="contained"
                          size="small"
                          disabled={actionLoading || activeServer.status === 'offline'}
                          startIcon={<Square size={15} />}
                          onClick={() => handlePower('stop')}
                          sx={{
                            backgroundColor: '#ef4444',
                            '&:hover': { backgroundColor: '#dc2626' },
                          }}
                        >
                          Stop
                        </Button>

                        <Button
                          variant="outlined"
                          size="small"
                          disabled={actionLoading}
                          startIcon={<RotateCw size={15} />}
                          onClick={() => handlePower('restart')}
                          sx={{
                            color: '#fbbf24',
                            borderColor: 'rgba(251, 191, 36, 0.3)',
                          }}
                        >
                          Restart
                        </Button>
                      </>
                    )}
                  </Stack>
                </Box>

                {/* Navigation Tabs */}
                {activeServer ? (
                  <>
                    <Box sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', mb: 3 }}>
                      <Tabs
                        value={currentTab}
                        onChange={(_, val) => setCurrentTab(val)}
                        sx={{
                          '& .MuiTabs-indicator': { backgroundColor: '#10b981', height: 3 },
                          '& .MuiTab-root': {
                            color: '#94a3b8',
                            fontWeight: 600,
                            '&.Mui-selected': { color: '#10b981' },
                          },
                        }}
                      >
                        <Tab value="overview" icon={<LayoutDashboard size={18} />} iconPosition="start" label="Overview" />
                        <Tab value="console" icon={<Terminal size={18} />} iconPosition="start" label="Console" />
                      </Tabs>
                    </Box>

                    {/* Overview Tab */}
                    {currentTab === 'overview' && (
                      <Card
                        sx={{
                          backgroundColor: 'rgba(15, 23, 42, 0.7)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: 3,
                        }}
                      >
                        <CardContent sx={{ p: 3 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#f8fafc', mb: 2 }}>
                            Server Instance Information
                          </Typography>

                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                Instance ID
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {activeServer.id}
                              </Typography>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                Active Node
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {activeNode?.name} ({activeNode?.host}:{activeNode?.daemonPort})
                              </Typography>
                            </Grid>

                            <Grid item xs={12}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                Node Storage Path
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontFamily: 'monospace',
                                  color: '#34d399',
                                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                  p: 1.5,
                                  borderRadius: 2,
                                  mt: 0.5,
                                }}
                              >
                                {activeServer.path}
                              </Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    )}

                    {/* Console Tab */}
                    {currentTab === 'console' && (
                      <Card
                        sx={{
                          backgroundColor: 'rgba(15, 23, 42, 0.7)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: 3,
                        }}
                      >
                        <CardContent sx={{ p: 3 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#f8fafc' }}>
                              Wings Process Console
                            </Typography>
                            <Button
                              size="small"
                              startIcon={<Trash2 size={14} />}
                              onClick={() => setLogs([])}
                              sx={{ color: '#94a3b8' }}
                            >
                              Clear View
                            </Button>
                          </Stack>

                          <Box
                            sx={{
                              height: 360,
                              backgroundColor: '#030712',
                              borderRadius: 2,
                              p: 2,
                              overflowY: 'auto',
                              fontFamily: 'monospace',
                              fontSize: '0.85rem',
                              border: '1px solid rgba(255, 255, 255, 0.05)',
                            }}
                          >
                            {logs.length === 0 ? (
                              <Typography variant="body2" sx={{ color: '#475569', fontStyle: 'italic' }}>
                                Waiting for Wings server process output...
                              </Typography>
                            ) : (
                              logs.map((log, i) => (
                                <Typography key={i} variant="body2" sx={{ color: '#cbd5e1', lineHeight: 1.5 }}>
                                  {log}
                                </Typography>
                              ))
                            )}
                          </Box>

                          <Box component="form" onSubmit={handleSendCommand} sx={{ mt: 2, display: 'flex', gap: 1.5 }}>
                            <TextField
                              fullWidth
                              size="small"
                              placeholder="Type command into server stdin..."
                              value={commandInput}
                              onChange={(e) => setCommandInput(e.target.value)}
                            />
                            <Button
                              type="submit"
                              variant="contained"
                              disabled={!commandInput.trim()}
                              startIcon={<Send size={16} />}
                              sx={{
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                px: 3,
                                borderRadius: 2,
                                '&:hover': { backgroundColor: '#059669' },
                              }}
                            >
                              Send
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <Card
                    sx={{
                      backgroundColor: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 3,
                      p: 4,
                      textAlign: 'center',
                    }}
                  >
                    <Typography variant="body1" sx={{ color: '#94a3b8', mb: 2 }}>
                      No Minecraft server instances found on node &ldquo;{activeNode?.name}&rdquo;.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Plus size={16} />}
                      onClick={() => setCreateServerModalOpen(true)}
                      sx={{
                        backgroundColor: '#10b981',
                        borderRadius: 2,
                        '&:hover': { backgroundColor: '#059669' },
                      }}
                    >
                      Create First Instance
                    </Button>
                  </Card>
                )}
              </Box>
            )}
          </Container>
        </Box>

        {/* Install Node Modal */}
        <InstallNodeModal
          open={installModalOpen}
          onClose={() => setInstallModalOpen(false)}
          onNodeInstalled={(node) => {
            setNodes((prev) => [...prev.filter((n) => n.id !== node.id), node]);
            setActiveNodeId(node.id);
            setInstallModalOpen(false);
            setToast({ message: `Node "${node.name}" installed successfully!`, type: 'success' });
          }}
        />

        {/* Create Server Modal */}
        {activeNode && (
          <CreateServerModal
            open={createServerModalOpen}
            node={activeNode}
            onClose={() => setCreateServerModalOpen(false)}
            onServerCreated={() => {
              loadServers();
              setToast({ message: 'Server created on node.', type: 'success' });
            }}
          />
        )}

        {/* Toast Notification */}
        <Snackbar
          open={Boolean(toast)}
          autoHideDuration={3500}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setToast(null)}
            severity={toast?.type || 'info'}
            sx={{
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {toast?.message}
          </Alert>
        </Snackbar>
      </WindowLayout>
    </ThemeProvider>
  );
}
