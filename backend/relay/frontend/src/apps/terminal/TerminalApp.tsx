import { useState, useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Box, TextField, Select, MenuItem, Button, Toolbar } from '@mui/material';
import { styled } from '@mui/material/styles';

interface TerminalAppProps {
  token: string;
  target: string;
  initialIp?: string;
}

export default function TerminalApp({ token, target, initialIp }: TerminalAppProps) {
  const [selectedIp, setSelectedIp] = useState(initialIp || '');
  const [sshUsername, setSshUsername] = useState('');
  const [sshPassword, setSshPassword] = useState('');
  const [savedLogins, setSavedLogins] = useState<any[]>([]);

  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [isConnected, setIsConnected] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const disconnectTerminal = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (termRef.current) {
      try {
        termRef.current.write('\r\n[Disconnected from server]\r\n');
        termRef.current.dispose();
      } catch (e) {}
      termRef.current = null;
    }
    fitAddonRef.current = null;
    setStatus('disconnected');
    setIsConnected(false);
  };

  const connectTerminal = () => {
    if (!token || !terminalRef.current) return;

    if (socketRef.current) socketRef.current.close();
    if (termRef.current) termRef.current.dispose();

    setStatus('connecting');
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"Fira Code", Menlo, Monaco, Consolas, monospace',
      fontSize: 14,
      theme: {
        background: '#050811',
        foreground: '#f8fafc',
        cursor: '#3a86ff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    // Slight delay for fit addon to get correct dimensions in RND wrapper
    setTimeout(() => fitAddon.fit(), 100);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    term.write('Connecting to NetLink Relay Server...\r\n');
    console.log('Debug: Connecting to WebSocket')

    const isSecure = window.location.protocol === 'https:';
    const protocol = isSecure ? 'wss:' : 'ws:';
    let host = window.location.host;
    if (host.includes('localhost:5173')) host = import.meta.env.VITE_RELAY_HOST || 'localhost:4535'; // Dev mode fallback

    const socketUrl = `${protocol}//${host}/client?token=${encodeURIComponent(token)}&target=${encodeURIComponent(target)}`;
    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('Debug: WebSocket connected');
      setStatus('connected');
      setIsConnected(true);
      term.write('\r\n*** Connected to Relay Server. Ready for SSH session ***\r\n\r\n');
    };

    socket.onmessage = async (event) => {
      console.log('Debug: Message received from WebSocket');
      let textData = event.data;
      if (event.data instanceof Blob) {
        textData = await event.data.text();
      } else if (event.data instanceof ArrayBuffer) {
        textData = new TextDecoder().decode(event.data);
      }

      try {
        const data = JSON.parse(textData);
        if (data.type === 'ready_for_credentials') {
          term.write('\r\n[System] Backend connected. Authenticating...\r\n');
          socket.send(JSON.stringify({
            type: 'connect',
            ip: selectedIp || 'localhost',
            username: sshUsername,
            password: sshPassword
          }));
          console.log('Debug: Sending connection request');
          return;
        }
      } catch (err) {
        // Not a JSON control message, treat as standard terminal output
      }

      term.write(textData);
    };

    socket.onclose = (event) => {
      setStatus('disconnected');
      console.log(`Debug: WebSocket closed with code ${event.code}`);
      setIsConnected(false);
      term.write(`\r\nConnection closed. Code: ${event.code}\r\n`);
    };

    socket.onerror = () => {
      setStatus('disconnected');
      setIsConnected(false);
      term.write('\r\nWebSocket Error.\r\n');
    };

    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });
  };

  useEffect(() => {
    let timeout: any;
    const handleResize = () => {
      if (fitAddonRef.current && termRef.current?.element) {
        try {
          fitAddonRef.current.fit();
        } catch (err) {
          // ignore error if terminal is destroyed during resize
        }
      }
    };

    // Use a debounced ResizeObserver to prevent infinite resize loops
    const observer = new ResizeObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        handleResize();
      }, 100);
    });

    if (terminalRef.current) {
      observer.observe(terminalRef.current);
    }

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
      if (socketRef.current) socketRef.current.close();
      if (termRef.current) {
        try { termRef.current.dispose(); } catch (e) {}
      }
    };
  }, []);

  // Sync initialIp prop if it changes and we're not connected
  useEffect(() => {
    if (initialIp && !isConnected) {
      setSelectedIp(initialIp);
    }
  }, [initialIp, isConnected]);

  // Fetch saved logins
  useEffect(() => {
    fetch('/api/server-logins', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.logins) {
          setSavedLogins(data.logins.filter((l: any) => l.type === 'ssh'));
        }
      })
      .catch(err => console.error('Failed to fetch logins', err));
  }, [token]);

  const applyLogin = (e: any) => {
    const login = savedLogins.find(l => l.id === e.target.value);
    if (login) {
      setSelectedIp(login.ip);
      setSshUsername(login.loginUsername);
      setSshPassword(login.password);
    }
  };

  return (
    <TerminalContainer>
      <TerminalToolbar variant="dense">
        {savedLogins.length > 0 && (
          <LoginSelect
            size="small"
            value=""
            displayEmpty
            onChange={applyLogin}
            disabled={isConnected}
          >
            <MenuItem value="" disabled>Saved Logins...</MenuItem>
            {savedLogins.map(l => (
              <MenuItem key={l.id} value={l.id}>{l.name} ({l.ip})</MenuItem>
            ))}
          </LoginSelect>
        )}
        <TerminalTextField
          size="small"
          value={selectedIp}
          onChange={(e) => setSelectedIp(e.target.value)}
          placeholder="Target IP"
          disabled={isConnected}
          $width={130}
        />
        <TerminalTextField
          size="small"
          value={sshUsername}
          onChange={(e) => setSshUsername(e.target.value)}
          placeholder="Username"
          disabled={isConnected}
          $width={120}
        />
        <TerminalTextField
          size="small"
          type="password"
          value={sshPassword}
          onChange={(e) => setSshPassword(e.target.value)}
          placeholder="Password"
          disabled={isConnected}
          $width={120}
        />
        {isConnected ? (
          <TerminalButton
            variant="contained"
            color="error"
            onClick={disconnectTerminal}
          >
            Disconnect
          </TerminalButton>
        ) : (
          <TerminalButton
            variant="contained"
            color="primary"
            onClick={connectTerminal}
            disabled={status === 'connecting' || !selectedIp || !sshUsername}
          >
            {status === 'connecting' ? 'Connecting...' : 'Connect'}
          </TerminalButton>
        )}
      </TerminalToolbar>
      <TerminalScreen ref={terminalRef} />
    </TerminalContainer>
  );
}

const TerminalContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: 'transparent',
});

const TerminalToolbar = styled(Toolbar)(({ theme }) => ({
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  display: 'flex',
  gap: theme.spacing(1.5),
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),
  paddingLeft: '10px !important',
  paddingRight: '10px !important',
}));

const LoginSelect = styled(Select)(({ theme }) => ({
  width: 140,
  '& .MuiSelect-select': {
    paddingTop: theme.spacing(0.8),
    paddingBottom: theme.spacing(0.8),
  },
}));

interface TerminalTextFieldProps {
  $width?: number | string;
}

const TerminalTextField = styled(TextField)<TerminalTextFieldProps>(({ theme, $width }) => ({
  width: $width,
  '& .MuiInputBase-input': {
    paddingTop: theme.spacing(0.8),
    paddingBottom: theme.spacing(0.8),
  },
}));

const TerminalButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
}));

const TerminalScreen = styled(Box)(({ theme }) => ({
  flex: 1,
  padding: theme.spacing(1.5),
  '& .xterm': {
    padding: '4px',
  },
}));
