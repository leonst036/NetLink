import { useCallback, useMemo } from 'react';
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

function getSubnet(ip: string) {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  return 'Unknown Network';
}

export default function NetworkGraph({ servers, onNodeClick }: NetworkGraphProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Root node
    nodes.push({
      id: 'root',
      position: { x: 0, y: 0 },
      data: { label: 'Local Server Gateway' },
      style: {
        background: '#0f172a',
        color: '#38bdf8',
        border: '2px solid #38bdf8',
        borderRadius: '8px',
        padding: '15px',
        fontWeight: 'bold',
        boxShadow: '0 0 15px rgba(56, 189, 248, 0.5)',
      },
    });

    const subnets = new Map<string, ServerData[]>();
    servers.forEach(server => {
      const subnet = getSubnet(server.ip);
      if (!subnets.has(subnet)) {
        subnets.set(subnet, []);
      }
      subnets.get(subnet)!.push(server);
    });

    const subnetKeys = Array.from(subnets.keys());
    const numSubnets = subnetKeys.length;
    const R1 = 350; // Radius for subnets

    subnetKeys.forEach((subnet, i) => {
      const angle1 = (i / numSubnets) * 2 * Math.PI;
      const subnetX = Math.cos(angle1) * R1;
      const subnetY = Math.sin(angle1) * R1;

      // Add subnet node
      const subnetNodeId = `subnet-${subnet}`;
      nodes.push({
        id: subnetNodeId,
        position: { x: subnetX, y: subnetY },
        data: { label: `Switch/Router\n${subnet}` },
        style: {
          background: '#1e293b',
          color: '#a78bfa',
          border: '2px dashed #8b5cf6',
          borderRadius: '50%',
          width: 100,
          height: 100,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          fontSize: '0.8rem',
        },
      });

      edges.push({
        id: `e-root-${subnetNodeId}`,
        source: 'root',
        target: subnetNodeId,
        animated: true,
        style: { stroke: '#8b5cf6', strokeWidth: 2 },
      });

      const devices = subnets.get(subnet)!;
      const numDevices = devices.length;
      
      // Dynamic radius based on number of devices to prevent overlap
      const R2 = Math.max(150, numDevices * 20); 

      devices.forEach((server, j) => {
        // distribute devices around the subnet node
        const angle2 = (j / numDevices) * 2 * Math.PI;
        const deviceX = subnetX + Math.cos(angle2) * R2;
        const deviceY = subnetY + Math.sin(angle2) * R2;

        nodes.push({
          id: server.ip,
          position: { x: deviceX, y: deviceY },
          data: { label: `${server.hostname || 'Linux-Server'}\n${server.ip}` },
          style: {
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid #475569',
            borderRadius: '8px',
            padding: '10px',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          },
        });

        edges.push({
          id: `e-${subnetNodeId}-${server.ip}`,
          source: subnetNodeId,
          target: server.ip,
          style: { stroke: '#475569' },
        });
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [servers]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id !== 'root' && !node.id.startsWith('subnet-')) {
        onNodeClick(node.id);
      }
    },
    [onNodeClick]
  );

  return (
    <div style={{ width: '100%', height: '100%', background: '#020617', borderRadius: '8px', overflow: 'hidden' }}>
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        onNodeClick={handleNodeClick}
        fitView
      >
        <Controls />
        <MiniMap nodeStrokeColor="#475569" nodeColor="#0f172a" maskColor="rgba(2, 6, 23, 0.8)" />
        <Background color="#1e293b" gap={20} />
      </ReactFlow>
    </div>
  );
}
