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
import './NetworkGraph.css';
import { useNotificationStore } from '../../store/useNotificationStore';

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
  isScanning: boolean;
  onScanClick: () => void;
}

export default function NetworkGraph({ servers, onNodeClick, onVncClick, onSftpClick, token, target, isScanning, onScanClick }: NetworkGraphProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const [search, setSearch] = useState('');
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [promptDialog, setPromptDialog] = useState<{ title: string; defaultValue: string; onConfirm: (val: string) => void } | null>(null);
  const [promptValue, setPromptValue] = useState('');

  const { addNotification } = useNotificationStore();

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
              return { ...n, deletable: false, className: 'node-nat', data: { ...n.data, label: n.data?.label || 'NAT / Gateway' } };
            }
            if (n.data?.nickname) {
              loadedNicknames[n.id] = n.data.nickname as string;
              return { ...n, className: 'node-device', data: { ...n.data, label: n.data.nickname || n.id } };
            }
            if (n.id === 'relay') {
              return { ...n, className: 'node-relay', data: { ...n.data, label: 'Relay Server' } };
            }
            if (n.id.startsWith('switch-')) {
              return { ...n, className: 'node-switch', data: { ...n.data, label: n.data?.label || 'Switch / Router' } };
            }
            return { ...n, className: 'node-device', data: { ...n.data, label: n.id } };
          });

          const hasNat = updatedNodes.some((n: Node) => n.id === 'nat');
          if (!hasNat) {
            updatedNodes.push({
              id: 'nat',
              position: { x: 300, y: 150 },
              data: { label: 'NAT / Gateway' },
              deletable: false,
              className: 'node-nat'
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
              className: 'node-nat'
            },
            {
              id: 'relay',
              position: { x: 400, y: 300 },
              data: { label: 'Relay Server' },
              className: 'node-relay'
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
        setPromptValue((node.data.label as string) || '');
        setPromptDialog({
          title: 'Enter new name for switch/router:',
          defaultValue: (node.data.label as string) || '',
          onConfirm: (newName) => {
            if (newName.trim() !== '') {
              setNodes((nds) =>
                nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, label: newName.trim() } } : n))
              );
            }
          }
        });
      } else {
        const currentNick = nicknames[node.id] || node.data.nickname || '';
        setPromptValue(currentNick as string);
        setPromptDialog({
          title: 'Enter nickname for device:',
          defaultValue: currentNick as string,
          onConfirm: (newName) => {
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
        });
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
      addNotification('Topology saved successfully!', 'success');
    } catch (err) {
      addNotification('Failed to save topology', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const addDeviceToGraph = (server: ServerData) => {
    if (nodes.find(n => n.id === server.ip)) {
      addNotification('Device is already in the graph.', 'info');
      return;
    }
    const nickname = nicknames[server.ip] || server.hostname || '';
    const label = nickname || server.ip;
    const newNode: Node = {
      id: server.ip,
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: { label, nickname },
      className: 'node-device'
    };
    setNodes(nds => [...nds, newNode]);
  };

  const addSwitch = () => {
    const id = `switch-${Date.now()}`;
    const newNode: Node = {
      id,
      position: { x: 200, y: 200 },
      data: { label: `Switch / Router` },
      className: 'node-switch'
    };
    setNodes(nds => [...nds, newNode]);
  };

  const filteredServers = servers.filter(s =>
    s.ip.includes(search) ||
    (s.hostname || '').toLowerCase().includes(search.toLowerCase()) ||
    (nicknames[s.ip] || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box className="root-container">
      {/* Sidebar: Device List */}
      <Paper className="sidebar-container" elevation={0}>
        <Box className="sidebar-header">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography className="header-title" variant="subtitle1" sx={{ mb: 0 }}>
              <ServerIcon size={18} /> Discovered Devices
            </Typography>
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={onScanClick}
              disabled={isScanning}
            >
              {isScanning ? 'Scanning...' : 'Scan'}
            </Button>
          </Box>
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

        <List className="device-list" onWheelCapture={(e) => e.stopPropagation()}>
          {filteredServers.map(server => {
            const inGraph = nodes.some(n => n.id === server.ip);
            return (
              <Paper className="device-paper" key={server.ip} variant="outlined">
                <Typography variant="subtitle2" color="primary">{server.ip}</Typography>
                <Typography className="device-hostname" variant="caption" color="text.secondary">
                  {server.hostname || 'Unknown Host'}
                </Typography>

                {isEditMode && (
                  <Box className="edit-actions-container">
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
                <Box className="quick-connect-container">
                  <Button className="quick-connect-button"
                    size="small"
                    variant="outlined"
                    onClick={() => onNodeClick(server.ip)}
                  >
                    SSH
                  </Button>
                  <Button className="quick-connect-button"
                    size="small"
                    variant="outlined"
                    color="success"
                    onClick={() => onVncClick(server.ip)}
                  >
                    VNC
                  </Button>
                  <Button className="quick-connect-button"
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={() => onSftpClick(server.ip)}
                  >
                    SFTP
                  </Button>
                </Box>
              </Paper>
            );
          })}
          {filteredServers.length === 0 && (
            <Typography className="no-devices-text" variant="body2" color="text.secondary" align="center">
              No devices found.
            </Typography>
          )}
        </List>
      </Paper>

      {/* Main Graph Area */}
      <Box className="graph-area">
        {/* Toolbar */}
        <Box className="toolbar-container">
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
              <Paper className="info-paper">
                <Typography variant="caption" color="text.secondary">
                  Double-click to rename. Select and press Backspace to delete.
                </Typography>
              </Paper>
            </>
          )}
        </Box>

        {isLoading ? (
          <Box className="loading-container">
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
        <Dialog className="styled-dialog"
          open={!!selectedDevice}
          onClose={() => setSelectedDevice(null)}
        >
          {selectedDevice && (
            <>
              <DialogTitle className="styled-dialog-title">
                {selectedDevice === 'relay' ? 'Relay Server' :
                 selectedDevice === 'nat' ? 'NAT / Gateway' :
                 selectedDevice.startsWith('switch-') ? 'Network Switch' :
                 (nicknames[selectedDevice] || selectedDevice)}
              </DialogTitle>
              <DialogContent className="styled-dialog-content">
                {selectedDevice !== 'relay' && selectedDevice !== 'nat' && !selectedDevice.startsWith('switch-') && (
                  <Typography className="dialog-text" variant="body2" color="text.secondary">
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
                  <Box className="dialog-actions-container">
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

        {/* Prompt Dialog */}
        <Dialog className="styled-dialog"
          open={!!promptDialog}
          onClose={() => setPromptDialog(null)}
        >
          {promptDialog && (
            <>
              <DialogTitle className="styled-dialog-title">
                {promptDialog.title}
              </DialogTitle>
              <DialogContent className="styled-dialog-content">
                <TextField
                  autoFocus
                  fullWidth
                  variant="outlined"
                  size="small"
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      promptDialog.onConfirm(promptValue);
                      setPromptDialog(null);
                    }
                  }}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setPromptDialog(null)} color="inherit">Cancel</Button>
                <Button onClick={() => {
                  promptDialog.onConfirm(promptValue);
                  setPromptDialog(null);
                }} color="primary" variant="contained">Save</Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Box>
    </Box>
  );
}