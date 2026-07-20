import { useState, useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Box, TextField, Select, MenuItem, Button, Toolbar } from '@mui/material';

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
      termRef.current.write('\r\n[Disconnected from server]\r\n');
      termRef.current.dispose();
      termRef.current = null;
    }
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
    if (host.includes('localhost:5173')) host = 'localhost:4535'; // Dev mode fallback

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
        console.log('Debug: Error parsing WebSocket message: ', err);
        // Not a JSON control message
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
    const handleResize = () => {
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (err) {
          console.error('Error while resizing terminal window:', err)
        }
      }
    };

    // Resize observer on terminalRef to auto-fit when window resizes
    const observer = new ResizeObserver(() => {
      console.log('Debug: Terminal resized');
      handleResize();
    });

    if (terminalRef.current) {
      observer.observe(terminalRef.current);
    }

    return () => {
      observer.disconnect();
      if (socketRef.current) socketRef.current.close();
      if (termRef.current) termRef.current.dispose();
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#050811' }}>
      <Toolbar
        variant="dense"
        sx={{
          bgcolor: 'rgba(15, 23, 42, 0.9)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          gap: 1.5,
          py: 1,
          px: '10px !important'
        }}
      >
        {savedLogins.length > 0 && (
          <Select
            size="small"
            value=""
            displayEmpty
            onChange={applyLogin}
            disabled={isConnected}
            sx={{ width: 140, '& .MuiSelect-select': { py: 0.8 } }}
          >
            <MenuItem value="" disabled>Saved Logins...</MenuItem>
            {savedLogins.map(l => (
              <MenuItem key={l.id} value={l.id}>{l.name} ({l.ip})</MenuItem>
            ))}
          </Select>
        )}
        <TextField
          size="small"
          value={selectedIp}
          onChange={(e) => setSelectedIp(e.target.value)}
          placeholder="Target IP"
          disabled={isConnected}
          sx={{ width: 130, '& .MuiInputBase-input': { py: 0.8 } }}
        />
        <TextField
          size="small"
          value={sshUsername}
          onChange={(e) => setSshUsername(e.target.value)}
          placeholder="Username"
          disabled={isConnected}
          sx={{ width: 120, '& .MuiInputBase-input': { py: 0.8 } }}
        />
        <TextField
          size="small"
          type="password"
          value={sshPassword}
          onChange={(e) => setSshPassword(e.target.value)}
          placeholder="Password"
          disabled={isConnected}
          sx={{ width: 120, '& .MuiInputBase-input': { py: 0.8 } }}
        />
        {isConnected ? (
          <Button
            variant="contained"
            color="error"
            onClick={disconnectTerminal}
            sx={{ textTransform: 'none', px: 2 }}
          >
            Disconnect
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            onClick={connectTerminal}
            disabled={status === 'connecting' || !selectedIp || !sshUsername}
            sx={{ textTransform: 'none', px: 2 }}
          >
            {status === 'connecting' ? 'Connecting...' : 'Connect'}
          </Button>
        )}
      </Toolbar>
      <Box
        ref={terminalRef}
        sx={{
          flex: 1,
          p: 1.5,
          '& .xterm': { padding: '4px' }
        }}
      />
    </Box>
  );
}
