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
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 24, // M3 Expressive Pill shape
          textTransform: 'none',
          padding: '8px 24px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        contained: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          '&:hover': {
            boxShadow: '0 8px 20px rgba(56, 189, 248, 0.3)',
            transform: 'translateY(-2px) scale(1.02)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          // backdropFilter: 'blur(16px)', // Disabled for window dragging performance
          border: '1px solid rgba(255,255,255,0.05)',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: 'rgba(255,255,255,0.03)',
          '& fieldset': {
            borderColor: 'rgba(255,255,255,0.1)',
          },
          '&:hover fieldset': {
            borderColor: 'rgba(255,255,255,0.2)',
          }
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
        },
      },
    },
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
