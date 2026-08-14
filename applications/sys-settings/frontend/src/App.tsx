import { Box, createTheme, ThemeProvider, CssBaseline } from '@mui/material';
import { WindowLayout } from '@netlink/ui';
import SettingsApp from './SettingsApp';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#38bdf8',
      light: '#7dd3fc',
      dark: '#0284c7',
    },
    secondary: {
      main: '#a855f7',
    },
    background: {
      default: '#090d16',
      paper: '#111827',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const ticket = urlParams.get('ticket');

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <WindowLayout>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
          <SettingsApp ticket={ticket || ''} />
        </Box>
      </WindowLayout>
    </ThemeProvider>
  );
}
