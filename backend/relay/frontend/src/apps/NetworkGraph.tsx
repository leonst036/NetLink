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
  List,
  useTheme
} from '@mui/material';

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
  const theme = useTheme();
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
    <Box sx={{ display: 'flex', height: '100%', width: '100%', minHeight: 0, bgcolor: 'transparent' }}>
      {/* Sidebar: Device List */}
      <Paper 
        elevation={0}
        sx={{ 
          width: 320, 
          borderRight: `1px solid rgba(255,255,255,0.05)`, 
          display: 'flex', 
          flexDirection: 'column',
          bgcolor: 'rgba(0,0,0,0.2)',
          borderRadius: 0,
        }}
      >
        <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, fontWeight: 'bold' }}>
            <ServerIcon size={18} /> Discovered Devices
          </Typography>
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
        </Box>

        <List sx={{ flex: 1, overflowY: 'auto', p: 1 }} onWheelCapture={(e) => e.stopPropagation()}>
          {filteredServers.map(server => {
            const inGraph = nodes.some(n => n.id === server.ip);
            return (
              <Paper key={server.ip} variant="outlined" sx={{ p: 1.5, mb: 1, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" color="primary">{server.ip}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {server.hostname || 'Unknown Host'}
                </Typography>

                {isEditMode && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1 }}>
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
                  </Box>
                )}

                {/* Quick Connect Buttons */}
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onNodeClick(server.ip)}
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    SSH
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="success"
                    onClick={() => onVncClick(server.ip)}
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    VNC
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={() => onSftpClick(server.ip)}
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    SFTP
                  </Button>
                </Box>
              </Paper>
            );
          })}
          {filteredServers.length === 0 && (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 4 }}>
              No devices found.
            </Typography>
          )}
        </List>
      </Paper>

      {/* Main Graph Area */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        {/* Toolbar */}
        <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', gap: 1, alignItems: 'center' }}>
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
              <Paper sx={{ px: 2, py: 0.5, bgcolor: 'rgba(15, 23, 42, 0.8)' }}>
                <Typography variant="caption" color="text.secondary">
                  Double-click to rename. Select and press Backspace to delete.
                </Typography>
              </Paper>
            </>
          )}
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: 'primary.main' }}>
            <div className="animate-spin" style={{ marginRight: '10px', width: '20px', height: '20px', border: '2px solid transparent', borderTopColor: 'currentColor', borderRadius: '50%' }}></div>
            <Typography>Loading Topology...</Typography>
          </Box>
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
        <Dialog 
          open={!!selectedDevice} 
          onClose={() => setSelectedDevice(null)}
          sx={{
            '& .MuiDialog-paper': {
              bgcolor: 'background.paper',
              backgroundImage: 'none',
              border: `1px solid ${theme.palette.divider}`,
              minWidth: 320
            }
          }}
        >
          {selectedDevice && (
            <>
              <DialogTitle sx={{ pb: 1 }}>
                {selectedDevice === 'relay' ? 'Relay Server' : 
                 selectedDevice === 'nat' ? 'NAT / Gateway' : 
                 selectedDevice.startsWith('switch-') ? 'Network Switch' :
                 (nicknames[selectedDevice] || selectedDevice)}
              </DialogTitle>
              <DialogContent sx={{ pb: 2 }}>
                {selectedDevice !== 'relay' && selectedDevice !== 'nat' && !selectedDevice.startsWith('switch-') && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    IP: {selectedDevice}
                  </Typography>
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
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
                  </Box>
                )}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setSelectedDevice(null)} color="inherit">Close</Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Box>
    </Box>
  );
}
