import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import './index.css'
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
      main: '#3a86ff',
    },
    background: {
      default: '#020617',
      paper: '#0f172a',
    },
  },
  typography: {
    fontFamily: '"Outfit", "Roboto", "Helvetica", "Arial", sans-serif',
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
