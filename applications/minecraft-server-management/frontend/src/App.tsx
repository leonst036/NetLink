import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Tabs,
  Tab,
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
  LayoutDashboard,
  Terminal,
  Folder,
  Plus,
} from 'lucide-react';
import { NodeInfo, NodeServerItem } from './types';
import {
  getNodes,
  saveLocalNodes,
  getNodeServers,
  powerNodeServer,
  sendNodeServerCommand,
  getNodeServerLogs,
} from './api';

import { Header } from './components/Header';
import { InstanceControlBar } from './components/InstanceControlBar';
import { OverviewTab } from './components/OverviewTab';
import { ConsoleTab } from './components/ConsoleTab';
import { FileManager } from './components/FileManager';
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

  const [currentTab, setCurrentTab] = useState<'overview' | 'console' | 'files'>('overview');
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [createServerModalOpen, setCreateServerModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const activeNodeRef = useRef<NodeInfo | null>(null);
  const activeServerIdRef = useRef<string | null>(null);

  const activeNode = useMemo(() => {
    return nodes.find((n) => n.id === activeNodeId) || nodes[0] || null;
  }, [nodes, activeNodeId]);

  const activeServer = useMemo(() => {
    return servers.find((s) => s.id === activeServerId) || null;
  }, [servers, activeServerId]);

  activeNodeRef.current = activeNode;
  activeServerIdRef.current = activeServerId;

  // Load registered nodes without unmounting or triggering cascade if unchanged
  const loadNodes = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const data = await getNodes();
      setNodes((prev) => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
      if (data.length > 0) {
        setActiveNodeId((curr) => curr || data[0].id);
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNodes(true);
  }, [loadNodes]);

  // Load server instances without unmounting
  const loadServers = useCallback(async () => {
    const node = activeNodeRef.current;
    if (!node) {
      setServers([]);
      return;
    }
    try {
      const serverList = await getNodeServers(node);
      setServers((prev) => (JSON.stringify(prev) === JSON.stringify(serverList) ? prev : serverList));
      if (serverList.length > 0) {
        setActiveServerId((curr) => (curr && serverList.some((s) => s.id === curr) ? curr : serverList[0].id));
      } else {
        setActiveServerId(null);
      }
    } catch {
      // Quiet fallback
    }
  }, []);

  useEffect(() => {
    if (activeNode) {
      loadServers();
    }
  }, [activeNode?.id, loadServers]);

  // Poll server logs
  const fetchLogs = useCallback(async () => {
    const node = activeNodeRef.current;
    const serverId = activeServerIdRef.current;
    if (!node || !serverId) return;
    try {
      const latestLogs = await getNodeServerLogs(node, serverId);
      setLogs((prev) => (JSON.stringify(prev) === JSON.stringify(latestLogs) ? prev : latestLogs));
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    if (activeServer && currentTab === 'console') {
      fetchLogs();
      const interval = setInterval(fetchLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [activeServer?.id, currentTab, fetchLogs]);

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
  const handleSendCommand = async (cmd: string) => {
    if (!activeNode || !activeServerId) return;
    try {
      await sendNodeServerCommand(activeNode, activeServerId, cmd);
      fetchLogs();
    } catch (err: any) {
      setToast({ message: `Failed to send command: ${err.message}`, type: 'error' });
    }
  };

  // Completely silent and stable refresh without scroll jumps
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadNodes(false), loadServers(), fetchLogs()]);
    } finally {
      setRefreshing(false);
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
            {/* Header Module */}
            <Header
              nodes={nodes}
              activeNode={activeNode}
              refreshing={refreshing}
              onSelectNode={setActiveNodeId}
              onRefresh={handleRefresh}
              onOpenInstallModal={() => setInstallModalOpen(true)}
            />

            {loading ? (
              <Box sx={{ py: 10, textAlign: 'center' }}>
                <CircularProgress size={32} sx={{ color: '#10b981' }} />
              </Box>
            ) : nodes.length === 0 ? (
              /* Empty State */
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
              /* Connected Node View */
              <Box sx={{ mt: 3 }}>
                {/* Instance Control Bar Module */}
                <InstanceControlBar
                  activeNode={activeNode}
                  servers={servers}
                  activeServer={activeServer}
                  actionLoading={actionLoading}
                  onSelectServer={setActiveServerId}
                  onPowerAction={handlePower}
                  onOpenCreateModal={() => setCreateServerModalOpen(true)}
                />

                {activeServer ? (
                  <>
                    {/* Navigation Tabs */}
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
                        <Tab value="files" icon={<Folder size={18} />} iconPosition="start" label="Files" />
                      </Tabs>
                    </Box>

                    {/* Tab Views */}
                    {currentTab === 'overview' && (
                      <OverviewTab activeNode={activeNode} activeServer={activeServer} />
                    )}

                    {currentTab === 'console' && (
                      <ConsoleTab
                        logs={logs}
                        onClearLogs={() => setLogs([])}
                        onSendCommand={handleSendCommand}
                      />
                    )}

                    {currentTab === 'files' && (
                      <FileManager node={activeNode} serverId={activeServer.id} />
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

        {/* Modals */}
        <InstallNodeModal
          open={installModalOpen}
          onClose={() => setInstallModalOpen(false)}
          onNodeInstalled={(node) => {
            const nextNodes = [...nodes.filter((n) => n.id !== node.id), node];
            setNodes(nextNodes);
            saveLocalNodes(nextNodes);
            setActiveNodeId(node.id);
            setInstallModalOpen(false);
            setToast({ message: `Node "${node.name}" installed successfully!`, type: 'success' });
          }}

        />

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
