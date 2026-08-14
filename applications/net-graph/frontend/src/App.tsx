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
    fetchServers();
  }, [ticket]);

  const fetchServers = async (refresh: boolean = false) => {
    setIsScanning(true);
    try {
      const url = refresh ? `/api/net-graph/scan?refresh=true` : `/api/net-graph/scan`;
      const res = await fetch(url, {
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
          onScanClick={() => fetchServers(true)}
          ticket={ticket || ''}
        />
      </Box>
    </WindowLayout>
  );
}
