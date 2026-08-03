import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import './index.css'
import './main.css'
import App from './App.tsx'

const patchConsoleLogForDebug = () => {
  const globalWindow = window as Window & { __netlinkConsoleLogPatched?: boolean };
  if (globalWindow.__netlinkConsoleLogPatched) return;

  globalWindow.__netlinkConsoleLogPatched = true;

  const originalLog = console.log.bind(console);
  console.log = (...args: unknown[]) => {
    const firstArg = args[0];
    const isDebugMessage = typeof firstArg === 'string' && firstArg.trimStart().toLowerCase().startsWith('debug:');
    const debugEnabled = localStorage.getItem('netlink_debug') === 'true';

    if (!debugEnabled && isDebugMessage) return;

    originalLog(...args);
  };
};

patchConsoleLogForDebug();

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#38bdf8',
    },
    background: {
      default: '#020617',
      paper: '#0f172a',
    },
    divider: 'rgba(255,255,255,0.08)',
  },
  typography: {
    fontFamily: '"Outfit", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.025em' },
    h2: { fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontWeight: 700, letterSpacing: '-0.01em' },
    h4: { fontWeight: 600, letterSpacing: '0em' },
    h5: { fontWeight: 600, letterSpacing: '0.01em' },
    h6: { fontWeight: 600, letterSpacing: '0.01em' },
    button: { fontWeight: 600, letterSpacing: '0.02em' },
  },
  shape: {
    borderRadius: 12,
  },

});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
