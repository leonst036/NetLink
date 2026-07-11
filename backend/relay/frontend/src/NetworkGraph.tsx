import { useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
} from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface ServerData {
  ip: string;
  hostname: string;
}

interface NetworkGraphProps {
  servers: ServerData[];
  onNodeClick: (ip: string) => void;
}

export default function NetworkGraph({ servers, onNodeClick }: NetworkGraphProps) {
  const initialNodes: Node[] = [
    {
      id: 'root',
      position: { x: 400, y: 50 },
      data: { label: 'Local Server Gateway' },
      style: {
        background: '#0f172a',
        color: '#38bdf8',
        border: '2px solid #38bdf8',
        borderRadius: '8px',
        padding: '10px',
        fontWeight: 'bold',
      },
    },
  ];

  const initialEdges: Edge[] = [];

  servers.forEach((server, index) => {
    const spacing = 200;
    const startX = 400 - ((servers.length - 1) * spacing) / 2;

    initialNodes.push({
      id: server.ip,
      position: { x: startX + index * spacing, y: 250 },
      data: { label: `${server.hostname || 'Linux-Server'}\n${server.ip}` },
      style: {
        background: '#1e293b',
        color: '#f8fafc',
        border: '1px solid #475569',
        borderRadius: '8px',
        padding: '10px',
        cursor: 'pointer',
      },
    });

    initialEdges.push({
      id: `e-root-${server.ip}`,
      source: 'root',
      target: server.ip,
      animated: true,
      style: { stroke: '#38bdf8' },
    });
  });

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id !== 'root') {
        onNodeClick(node.id);
      }
    },
    [onNodeClick]
  );

  return (
    <div style={{ width: '100%', height: '400px', background: '#050811', borderRadius: '10px', border: '1px solid #334155', overflow: 'hidden' }}>
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        onNodeClick={handleNodeClick}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background color="#334155" gap={16} />
      </ReactFlow>
    </div>
  );
}
