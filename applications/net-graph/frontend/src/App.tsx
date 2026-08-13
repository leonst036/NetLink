import { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { WindowLayout } from '@netlink/ui';
import NetworkGraph from './NetworkGraph';

export default function App() {
  const [servers, setServers] = useState([]);
  const [isScanning, setIsScanning] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const ticket = urlParams.get('ticket');
  
  useEffect(() => {
    // We can fetch target from the window message or it might be passed as a query param. 
    // Let's rely on ticket auth. The backend can infer target from the ticket if needed, or we just pass it.
    // In DynamicAppLoader, we could pass target as a URL param.
    // For now, let's just fetch servers using the ticket.
    fetchServers();
  }, [ticket]);

  const fetchServers = async () => {
    setIsScanning(true);
    try {
        const res = await fetch(`/api/servers`, {
            headers: {
                'Authorization': `Ticket ${ticket}`
            }
        });
        if (!res.ok) {
            throw new Error('Failed to scan network');
        }
        const devices = await res.json();
        setServers(devices);
    } catch (err: any) {
        console.error('Failed to fetch servers', err);
    } finally {
        setIsScanning(false);
    }
  };

  const openApp = (appId: string, title: string, extraParams: any = {}) => {
      window.parent.postMessage({ type: 'open_app', appId, title, extraParams }, '*');
  };

  return (
    <WindowLayout>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
        <NetworkGraph
          servers={servers}
          onNodeClick={(ip: string) => openApp('net-terminal', `Terminal: ${ip}`, { ip })}
          onVncClick={(ip: string) => openApp('vnc-viewer', `VNC: ${ip}`, { ip })}
          onSftpClick={(ip: string) => openApp('sftp-client', `SFTP: ${ip}`, { ip })}
          isScanning={isScanning}
          onScanClick={fetchServers}
          ticket={ticket || ''}
        />
      </Box>
    </WindowLayout>
  );
}
