import { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import type {
  Connection,
  Edge,
  Node,
  NodeChange,
  EdgeChange
} from '@xyflow/react';
import { Save, Plus, Search, Server as ServerIcon, Settings2, Pencil } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List
} from '@mui/material';
import { styled } from '@mui/material/styles';

interface ServerData {
  ip: string;
  hostname: string;
}

interface NetworkGraphProps {
  servers: ServerData[];
  onNodeClick: (ip: string) => void;
  onVncClick: (ip: string) => void;
  onSftpClick: (ip: string) => void;
  token: string;
  target: string;
}

export default function NetworkGraph({ servers, onNodeClick, onVncClick, onSftpClick, token, target }: NetworkGraphProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const [search, setSearch] = useState('');
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  // Load Topology
  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/topology?target=${encodeURIComponent(target)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then(data => {
        if (data && data.nodes && data.nodes.length > 0) {
          setNodes(data.nodes);
          setEdges(data.edges || []);

          // extract nicknames from nodes
          const loadedNicknames: Record<string, string> = {};
          let updatedNodes = data.nodes.map((n: Node) => {
            if (n.id === 'nat') {
              return { ...n, deletable: false, data: { ...n.data, label: n.data?.label || 'NAT / Gateway' }, style: { ...n.style, background: '#7c2d12', color: '#fdba74', border: '2px solid #ea580c', borderRadius: '8px', padding: '15px', fontWeight: 'bold' } };
            }
            if (n.data?.nickname) {
              loadedNicknames[n.id] = n.data.nickname as string;
              return { ...n, data: { ...n.data, label: n.data.nickname || n.id } };
            }
            if (n.id !== 'relay' && !n.id.startsWith('switch-')) {
              return { ...n, data: { ...n.data, label: n.id } };
            }
            return n;
          });

          const hasNat = updatedNodes.some((n: Node) => n.id === 'nat');
          if (!hasNat) {
            updatedNodes.push({
              id: 'nat',
              position: { x: 300, y: 150 },
              data: { label: 'NAT / Gateway' },
              deletable: false,
              style: { background: '#7c2d12', color: '#fdba74', border: '2px solid #ea580c', borderRadius: '8px', padding: '15px', fontWeight: 'bold' }
            });
          }

          setNodes(updatedNodes);

          if (data.nicknames && Object.keys(data.nicknames).length > 0) {
            setNicknames({ ...loadedNicknames, ...data.nicknames });
          } else {
            setNicknames(loadedNicknames);
          }
        } else {
          setNodes([
            {
              id: 'nat',
              position: { x: 200, y: 150 },
              data: { label: 'NAT / Gateway' },
              deletable: false,
              style: { background: '#7c2d12', color: '#fdba74', border: '2px solid #ea580c', borderRadius: '8px', padding: '15px', fontWeight: 'bold' }
            },
            {
              id: 'relay',
              position: { x: 400, y: 300 },
              data: { label: 'Relay Server' },
              style: { background: '#0f172a', color: '#38bdf8', border: '2px solid #38bdf8', borderRadius: '8px', padding: '15px' }
            }
          ]);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [target, token]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      if (!isEditMode) {
        const allowed = changes.filter(c => c.type === 'select');
        if (allowed.length > 0) setNodes((nds) => applyNodeChanges(allowed, nds));
        return;
      }
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [isEditMode]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      if (!isEditMode) {
        const allowed = changes.filter(c => c.type === 'select');
        if (allowed.length > 0) setEdges((eds) => applyEdgeChanges(allowed, eds));
        return;
      }
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [isEditMode]
  );

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      if (!isEditMode) return;
      const edge = { ...params, animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } } as Edge;
      setEdges((eds) => addEdge(edge, eds));
    },
    [isEditMode]
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!isEditMode) return;
      if (node.id === 'relay' || node.id === 'nat') return;

      if (node.id.startsWith('switch-')) {
        const newName = window.prompt('Enter new name for switch/router:', node.data.label as string);
        if (newName !== null && newName.trim() !== '') {
          setNodes((nds) =>
            nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, label: newName.trim() } } : n))
          );
        }
      } else {
        const currentNick = nicknames[node.id] || node.data.nickname || '';
        const newName = window.prompt('Enter nickname for device:', currentNick as string);
        if (newName !== null) {
          const trimmedName = newName.trim();
          setNicknames(prev => ({ ...prev, [node.id]: trimmedName }));
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === node.id) {
                const finalName = trimmedName || n.id;
                return { ...n, data: { ...n.data, nickname: trimmedName, label: finalName } };
              }
              return n;
            })
          );
        }
      }
    },
    [isEditMode, nicknames]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (isEditMode) return;
      setSelectedDevice(node.id);
    },
    [isEditMode]
  );

  const saveTopology = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/topology?target=${encodeURIComponent(target)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nodes, edges, nicknames })
      });
      alert('Topology saved successfully!');
    } catch (err) {
      alert('Failed to save topology');
    } finally {
      setIsSaving(false);
    }
  };

  const addDeviceToGraph = (server: ServerData) => {
    if (nodes.find(n => n.id === server.ip)) {
      alert('Device is already in the graph.');
      return;
    }
    const nickname = nicknames[server.ip] || server.hostname || '';
    const label = nickname || server.ip;
    const newNode: Node = {
      id: server.ip,
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: { label, nickname },
      style: { background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: '8px', padding: '10px' }
    };
    setNodes(nds => [...nds, newNode]);
  };

  const addSwitch = () => {
    const id = `switch-${Date.now()}`;
    const newNode: Node = {
      id,
      position: { x: 200, y: 200 },
      data: { label: `Switch / Router` },
      style: { background: '#020617', color: '#a78bfa', border: '2px dashed #8b5cf6', borderRadius: '50%', width: 80, height: 80, display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center', fontSize: '0.8rem' }
    };
    setNodes(nds => [...nds, newNode]);
  };

  const filteredServers = servers.filter(s =>
    s.ip.includes(search) ||
    (s.hostname || '').toLowerCase().includes(search.toLowerCase()) ||
    (nicknames[s.ip] || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <RootContainer>
      {/* Sidebar: Device List */}
      <SidebarContainer elevation={0}>
        <SidebarHeader>
          <HeaderTitle variant="subtitle1">
            <ServerIcon size={18} /> Discovered Devices
          </HeaderTitle>
          <TextField
            fullWidth
            size="small"
            placeholder="Search IP or Hostname..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} />
                  </InputAdornment>
                ),
              }
            }}
          />
        </SidebarHeader>

        <DeviceList onWheelCapture={(e) => e.stopPropagation()}>
          {filteredServers.map(server => {
            const inGraph = nodes.some(n => n.id === server.ip);
            return (
              <DevicePaper key={server.ip} variant="outlined">
                <Typography variant="subtitle2" color="primary">{server.ip}</Typography>
                <DeviceHostname variant="caption" color="text.secondary">
                  {server.hostname || 'Unknown Host'}
                </DeviceHostname>

                {isEditMode && (
                  <EditActionsContainer>
                    <TextField
                      size="small"
                      placeholder="Nickname..."
                      value={nicknames[server.ip] || ''}
                      onChange={e => {
                        const newVal = e.target.value;
                        setNicknames(prev => ({ ...prev, [server.ip]: newVal }));
                        setNodes(nds => nds.map(n => {
                          if (n.id === server.ip) {
                            return { ...n, data: { ...n.data, nickname: newVal, label: newVal || server.ip } };
                          }
                          return n;
                        }));
                      }}
                    />
                    <Button
                      variant={inGraph ? "outlined" : "contained"}
                      size="small"
                      disabled={inGraph}
                      onClick={() => addDeviceToGraph(server)}
                      startIcon={!inGraph && <Plus size={16} />}
                      fullWidth
                    >
                      {inGraph ? 'In Graph' : 'Add to Graph'}
                    </Button>
                  </EditActionsContainer>
                )}

                {/* Quick Connect Buttons */}
                <QuickConnectContainer>
                  <QuickConnectButton
                    size="small"
                    variant="outlined"
                    onClick={() => onNodeClick(server.ip)}
                  >
                    SSH
                  </QuickConnectButton>
                  <QuickConnectButton
                    size="small"
                    variant="outlined"
                    color="success"
                    onClick={() => onVncClick(server.ip)}
                  >
                    VNC
                  </QuickConnectButton>
                  <QuickConnectButton
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={() => onSftpClick(server.ip)}
                  >
                    SFTP
                  </QuickConnectButton>
                </QuickConnectContainer>
              </DevicePaper>
            );
          })}
          {filteredServers.length === 0 && (
            <NoDevicesText variant="body2" color="text.secondary" align="center">
              No devices found.
            </NoDevicesText>
          )}
        </DeviceList>
      </SidebarContainer>

      {/* Main Graph Area */}
      <GraphArea>
        {/* Toolbar */}
        <ToolbarContainer>
          <Button
            variant="contained"
            color={isEditMode ? "primary" : "inherit"}
            onClick={() => setIsEditMode(!isEditMode)}
            startIcon={<Pencil size={16} />}
          >
            {isEditMode ? 'Exit Edit Mode' : 'Edit Mode'}
          </Button>

          {isEditMode && (
            <>
              <Button variant="contained" color="secondary" onClick={addSwitch} startIcon={<Settings2 size={16} />}>
                Add Switch
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={saveTopology}
                disabled={isSaving}
                startIcon={<Save size={16} />}
              >
                {isSaving ? 'Saving...' : 'Save Topology'}
              </Button>
              <InfoPaper>
                <Typography variant="caption" color="text.secondary">
                  Double-click to rename. Select and press Backspace to delete.
                </Typography>
              </InfoPaper>
            </>
          )}
        </ToolbarContainer>

        {isLoading ? (
          <LoadingContainer>
            <div className="animate-spin" style={{ marginRight: '10px', width: '20px', height: '20px', border: '2px solid transparent', borderTopColor: 'currentColor', borderRadius: '50%' }}></div>
            <Typography>Loading Topology...</Typography>
          </LoadingContainer>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            nodesDraggable={isEditMode}
            nodesConnectable={isEditMode}
            elementsSelectable={true}
            edgesFocusable={isEditMode}
            fitView
          >
            <Controls />
            <MiniMap nodeColor="#1e293b" maskColor="rgba(2, 6, 23, 0.8)" />
            <Background color="#1e293b" gap={20} />
          </ReactFlow>
        )}

        {/* Protocol Selection Modal */}
        <StyledDialog
          open={!!selectedDevice}
          onClose={() => setSelectedDevice(null)}
        >
          {selectedDevice && (
            <>
              <StyledDialogTitle>
                {selectedDevice === 'relay' ? 'Relay Server' :
                 selectedDevice === 'nat' ? 'NAT / Gateway' :
                 selectedDevice.startsWith('switch-') ? 'Network Switch' :
                 (nicknames[selectedDevice] || selectedDevice)}
              </StyledDialogTitle>
              <StyledDialogContent>
                {selectedDevice !== 'relay' && selectedDevice !== 'nat' && !selectedDevice.startsWith('switch-') && (
                  <DialogText variant="body2" color="text.secondary">
                    IP: {selectedDevice}
                  </DialogText>
                )}

                {selectedDevice.startsWith('switch-') ? (
                  <Typography variant="body2" color="text.secondary" align="center">
                    No remote protocols available for this switch.
                  </Typography>
                ) : selectedDevice === 'nat' ? (
                  <Typography variant="body2" color="text.secondary" align="center">
                    Gateway device. Connect via SSH if supported.
                  </Typography>
                ) : (
                  <DialogActionsContainer>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => { onNodeClick(selectedDevice === 'relay' ? '' : selectedDevice); setSelectedDevice(null); }}
                    >
                      Connect via SSH
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="success"
                      onClick={() => { onVncClick(selectedDevice === 'relay' ? '' : selectedDevice); setSelectedDevice(null); }}
                    >
                      Connect via VNC
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="warning"
                      onClick={() => { onSftpClick(selectedDevice === 'relay' ? '' : selectedDevice); setSelectedDevice(null); }}
                    >
                      Browse via SFTP
                    </Button>
                  </DialogActionsContainer>
                )}
              </StyledDialogContent>
              <DialogActions>
                <Button onClick={() => setSelectedDevice(null)} color="inherit">Close</Button>
              </DialogActions>
            </>
          )}
        </StyledDialog>
      </GraphArea>
    </RootContainer>
  );
}

// Styled Components
const RootContainer = styled(Box)({
  display: 'flex',
  height: '100%',
  width: '100%',
  minHeight: 0,
  backgroundColor: 'transparent',
});

const SidebarContainer = styled(Paper)({
  width: 320,
  borderRight: '1px solid rgba(255, 255, 255, 0.05)',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
  borderRadius: 0,
});

const SidebarHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const HeaderTitle = styled(Typography)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1),
  fontWeight: 'bold',
}));

const DeviceList = styled(List)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  padding: theme.spacing(1),
}));

const DevicePaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1.5),
  marginBottom: theme.spacing(1),
  backgroundColor: theme.palette.background.default,
}));

const DeviceHostname = styled(Typography)(({ theme }) => ({
  display: 'block',
  marginBottom: theme.spacing(1),
}));

const EditActionsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1),
}));

const QuickConnectContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  marginTop: theme.spacing(1),
}));

const QuickConnectButton = styled(Button)({
  flex: 1,
  minWidth: 0,
});

const NoDevicesText = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(4),
}));

const GraphArea = styled(Box)({
  flex: 1,
  position: 'relative',
});

const ToolbarContainer = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 16,
  left: 16,
  zIndex: 10,
  display: 'flex',
  gap: theme.spacing(1),
  alignItems: 'center',
}));

const InfoPaper = styled(Paper)(({ theme }) => ({
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  paddingTop: theme.spacing(0.5),
  paddingBottom: theme.spacing(0.5),
  backgroundColor: 'rgba(15, 23, 42, 0.8)',
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  height: '100%',
  justifyContent: 'center',
  alignItems: 'center',
  color: theme.palette.primary.main,
}));

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    backgroundColor: theme.palette.background.paper,
    backgroundImage: 'none',
    border: `1px solid ${theme.palette.divider}`,
    minWidth: 320,
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  paddingBottom: theme.spacing(1),
}));

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  paddingBottom: theme.spacing(2),
}));

const DialogText = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

const DialogActionsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));