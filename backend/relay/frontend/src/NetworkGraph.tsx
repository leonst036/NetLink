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
import { Save, Plus, Search, Server as ServerIcon, Settings2 } from 'lucide-react';
import '@xyflow/react/dist/style.css';

interface ServerData {
  ip: string;
  hostname: string;
}

interface NetworkGraphProps {
  servers: ServerData[];
  onNodeClick: (ip: string) => void;
  onVncClick: (ip: string) => void;
  token: string;
  target: string;
}

export default function NetworkGraph({ servers, onNodeClick, onVncClick, token, target }: NetworkGraphProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const [search, setSearch] = useState('');
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Load Topology
  useEffect(() => {
    fetch(`/api/topology?target=${encodeURIComponent(target)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.nodes && data.nodes.length > 0) {
          setNodes(data.nodes);
          setEdges(data.edges || []);

          // extract nicknames from nodes
          const loadedNicknames: Record<string, string> = {};
          data.nodes.forEach((n: Node) => {
            if (n.data?.nickname) {
              loadedNicknames[n.id] = n.data.nickname as string;
            }
          });
          setNicknames(loadedNicknames);
        } else {
          // Default empty or just the relay server node
          setNodes([{
            id: 'relay',
            position: { x: 400, y: 300 },
            data: { label: 'Relay Server' },
            style: { background: '#0f172a', color: '#38bdf8', border: '2px solid #38bdf8', borderRadius: '8px', padding: '15px' }
          }]);
        }
      })
      .catch(console.error);
  }, [target, token]);

  // Handlers for React Flow
  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (params: Edge | Connection) => {
      const edge = { ...params, animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } } as Edge;
      setEdges((eds) => addEdge(edge, eds));
    },
    []
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id !== 'relay' && !node.id.startsWith('switch-')) {
        onNodeClick(node.id); // It's an IP
      }
    },
    [onNodeClick]
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
        body: JSON.stringify({ nodes, edges })
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
    const nickname = nicknames[server.ip] || server.hostname || 'Device';
    const newNode: Node = {
      id: server.ip,
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: { label: `${nickname}\n${server.ip}`, nickname },
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
    s.ip.includes(search) || (s.hostname || '').toLowerCase().includes(search.toLowerCase())
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
                        return { ...n, data: { ...n.data, nickname: newVal, label: `${newVal || server.hostname || 'Device'}\n${server.ip}` } };
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
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, display: 'flex', gap: '10px' }}>
          <button onClick={addSwitch} style={toolbarBtnStyle} title="Add Switch / Router Node">
            <Settings2 size={16} /> Add Switch
          </button>
          <button onClick={saveTopology} disabled={isSaving} style={{ ...toolbarBtnStyle, background: '#10b981', borderColor: '#059669', color: '#022c22' }} title="Save Topology to DB">
            <Save size={16} /> {isSaving ? 'Saving...' : 'Save Topology'}
          </button>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          fitView
        >
          <Controls />
          <MiniMap nodeColor="#1e293b" maskColor="rgba(2, 6, 23, 0.8)" />
          <Background color="#1e293b" gap={20} />
        </ReactFlow>
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
