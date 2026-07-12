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
            // Prefer the nicknames dictionary from the top-level
            setNicknames({ ...loadedNicknames, ...data.nicknames });
          } else {
            setNicknames(loadedNicknames);
          }
        } else {
          // Default empty or just the relay server node
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

  // Handlers for React Flow
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
      // Don't open connection modal in edit mode
      if (isEditMode) return;
      
      // Allow opening modal for any device, switch, or relay
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
    <div style={{ display: 'flex', height: '100%', background: '#050811' }}>

      {/* Sidebar: Device List */}
      <div style={{ width: '300px', background: '#0f172a', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc' }}>
            <ServerIcon size={16} /> Discovered Devices
          </h3>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search IP or Hostname..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 8px 8px 30px', background: 'rgba(2, 6, 23, 0.5)', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {filteredServers.map(server => {
            const inGraph = nodes.some(n => n.id === server.ip);
            return (
              <div key={server.ip} style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#38bdf8' }}>{server.ip}</div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px' }}>{server.hostname || 'Unknown Host'}</div>

                {isEditMode && (
                  <>
                    <input
                      type="text"
                      placeholder="Nickname..."
                      value={nicknames[server.ip] || ''}
                      onChange={e => {
                        const newVal = e.target.value;
                        setNicknames(prev => ({ ...prev, [server.ip]: newVal }));
                        // Update node label if it's already in the graph
                        setNodes(nds => nds.map(n => {
                          if (n.id === server.ip) {
                            return { ...n, data: { ...n.data, nickname: newVal, label: newVal || server.ip } };
                          }
                          return n;
                        }));
                      }}
                      style={{ width: '100%', padding: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid #334155', borderRadius: '4px', color: 'white', fontSize: '0.8rem', marginBottom: '8px' }}
                    />

                    <button
                      onClick={() => addDeviceToGraph(server)}
                      disabled={inGraph}
                      style={{ width: '100%', padding: '6px', background: inGraph ? '#1e293b' : '#3b82f6', color: inGraph ? '#64748b' : 'white', border: 'none', borderRadius: '4px', cursor: inGraph ? 'not-allowed' : 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      {inGraph ? 'In Graph' : <><Plus size={14} /> Add to Graph</>}
                    </button>
                  </>
                )}

                {/* Quick Connect Buttons */}
                <div style={{ display: 'flex', gap: '5px', marginTop: '8px' }}>
                  <button
                    onClick={() => onNodeClick(server.ip)}
                    style={{ flex: 1, padding: '4px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    SSH
                  </button>
                  <button
                    onClick={() => onVncClick(server.ip)}
                    style={{ flex: 1, padding: '4px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    VNC
                  </button>
                  <button
                    onClick={() => onSftpClick(server.ip)}
                    style={{ flex: 1, padding: '4px', background: 'rgba(251, 146, 60, 0.1)', color: '#fb923c', border: '1px solid rgba(251, 146, 60, 0.3)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    SFTP
                  </button>
                </div>
              </div>
            );
          })}
          {filteredServers.length === 0 && <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginTop: '20px' }}>No devices found.</div>}
        </div>
      </div>

      {/* Main Graph Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Toolbar */}
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            onClick={() => setIsEditMode(!isEditMode)} 
            style={{ ...toolbarBtnStyle, background: isEditMode ? '#3b82f6' : '#1e293b', borderColor: isEditMode ? '#2563eb' : '#475569' }} 
            title="Toggle Edit Mode"
          >
            <Pencil size={16} /> {isEditMode ? 'Exit Edit Mode' : 'Edit Mode'}
          </button>
          
          {isEditMode && (
            <>
              <button onClick={addSwitch} style={toolbarBtnStyle} title="Add Switch / Router Node">
                <Settings2 size={16} /> Add Switch
              </button>
              <button onClick={saveTopology} disabled={isSaving} style={{ ...toolbarBtnStyle, background: '#10b981', borderColor: '#059669', color: '#022c22' }} title="Save Topology to DB">
                <Save size={16} /> {isSaving ? 'Saving...' : 'Save Topology'}
              </button>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginLeft: '10px', background: 'rgba(15, 23, 42, 0.8)', padding: '6px 12px', borderRadius: '6px' }}>
                Double-click to rename. Select and press Backspace to delete.
              </div>
            </>
          )}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: '#38bdf8' }}>
            <div className="animate-spin" style={{ marginRight: '10px', width: '20px', height: '20px', border: '2px solid transparent', borderTopColor: '#38bdf8', borderRadius: '50%' }}></div>
            Loading Topology...
          </div>
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
        {selectedDevice && (
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(2, 6, 23, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 9999
          }} onClick={() => setSelectedDevice(null)}>
            <div style={{
              background: '#0f172a',
              border: '1px solid #38bdf8',
              padding: '25px',
              borderRadius: '12px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
              display: 'flex',
              flexDirection: 'column',
              gap: '15px',
              minWidth: '280px',
              transform: 'scale(1)',
              animation: 'popIn 0.2s ease-out'
            }} onClick={e => e.stopPropagation()}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.2rem' }}>
                  {selectedDevice === 'relay' ? 'Relay Server' : 
                   selectedDevice === 'nat' ? 'NAT / Gateway' : 
                   selectedDevice.startsWith('switch-') ? 'Network Switch' :
                   (nicknames[selectedDevice] || selectedDevice)}
                </h3>
                <button onClick={() => setSelectedDevice(null)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem', padding: 0 }}>&times;</button>
              </div>

              {selectedDevice !== 'relay' && selectedDevice !== 'nat' && !selectedDevice.startsWith('switch-') && (
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem', marginTop: '-10px' }}>
                  IP: {selectedDevice}
                </p>
              )}

              {selectedDevice.startsWith('switch-') ? (
                <div style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '10px 0' }}>
                  No remote protocols available for this switch.
                </div>
              ) : selectedDevice === 'nat' ? (
                <div style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '10px 0' }}>
                  Gateway device. Connect via SSH if supported.
                </div>
              ) : null}

              {(!selectedDevice.startsWith('switch-') && selectedDevice !== 'nat') && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    onClick={() => { onNodeClick(selectedDevice === 'relay' ? '' : selectedDevice); setSelectedDevice(null); }}
                    style={{ flex: 1, padding: '12px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold', transition: 'all 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)'}
                  >
                    SSH
                  </button>
                  <button
                    onClick={() => { onVncClick(selectedDevice === 'relay' ? '' : selectedDevice); setSelectedDevice(null); }}
                    style={{ flex: 1, padding: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold', transition: 'all 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
                  >
                    VNC
                  </button>
                  <button
                    onClick={() => { onSftpClick(selectedDevice === 'relay' ? '' : selectedDevice); setSelectedDevice(null); }}
                    style={{ flex: 1, padding: '12px', background: 'rgba(251, 146, 60, 0.1)', color: '#fb923c', border: '1px solid rgba(251, 146, 60, 0.4)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold', transition: 'all 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(251, 146, 60, 0.2)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(251, 146, 60, 0.1)'}
                  >
                    SFTP
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

const toolbarBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  background: '#1e293b',
  border: '1px solid #475569',
  color: '#f8fafc',
  padding: '8px 12px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 500,
  boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
};
