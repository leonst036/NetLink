import { Box } from '@mui/material';
import { WindowLayout } from '@netlink/ui';
import FileApp from './FileApp';

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const ticket = urlParams.get('ticket');
  const target = urlParams.get('target') || ''; 
  const initialIp = urlParams.get('ip') || '';

  return (
    <WindowLayout>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
        <FileApp ticket={ticket || ''} target={target} initialIp={initialIp} />
      </Box>
    </WindowLayout>
  );
}
