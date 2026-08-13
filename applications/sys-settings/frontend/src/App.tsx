import { Box } from '@mui/material';
import { WindowLayout } from '@netlink/ui';
import SettingsApp from './SettingsApp';

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const ticket = urlParams.get('ticket');

  return (
    <WindowLayout>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
        <SettingsApp ticket={ticket || ''} />
      </Box>
    </WindowLayout>
  );
}
