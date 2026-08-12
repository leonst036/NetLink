import { useState, useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Box, TextField, Select, MenuItem, Button, Toolbar } from '@mui/material';
import './TerminalApp.css';

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const ticket = urlParams.get('ticket') || '';
  const target = urlParams.get('target') || '';
  const initialIp = urlParams.get('ip') || '';

  const [selectedIp, setSelectedIp] = useState(initialIp);
  const [sshUsername, setSshUsername] = useState('');
  const [sshPassword, setSshPassword] = useState('');
  const [savedLogins, setSavedLogins] = useState<any[]>([]);
  const [storedSessions, setStoredSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');

  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [isConnected, setIsConnected] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const inputDisposableRef = useRef<{ dispose: () => void } | null>(null);

  const disconnectTerminal = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (inputDisposableRef.current) {
      try { inputDisposableRef.current.dispose(); } catch (e) {}
      inputDisposableRef.current = null;
    }
    if (termRef.current) {
      try { termRef.current.write('\r\n[Detached from server]\r\n'); } catch (e) {}
    }
    setStatus('disconnected');
    setIsConnected(false);
  };

  const connectTerminal = () => {
    if (!ticket || !terminalRef.current) return;

    if (socketRef.current) socketRef.current.close();

    if (inputDisposableRef.current) {
      try { inputDisposableRef.current.dispose(); } catch (e) {}
      inputDisposableRef.current = null;
    }

    setStatus('connecting');
    let term = termRef.current;
    if (!term) {
      term = new Terminal({
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

      setTimeout(() => fitAddon.fit(), 100);

      termRef.current = term;
      fitAddonRef.current = fitAddon;
    }

    term.write('Connecting to NetLink Relay Server...\r\n');

    const sessionId = activeSessionId || crypto.randomUUID();
    if (!activeSessionId) {
      setActiveSessionId(sessionId);
    }

    const isSecure = window.location.protocol === 'https:';
    const protocol = isSecure ? 'wss:' : 'ws:';
    const host = window.location.host; // This is the iframe host (e.g. localhost:4535)

    const socketUrl = `${protocol}//${host}/client?ticket=${encodeURIComponent(ticket)}&target=${encodeURIComponent(target)}&sessionId=${encodeURIComponent(sessionId)}`;
    const socket = new WebSocket(socketUrl);
    socket.binaryType = 'arraybuffer';
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus('connected');
      setIsConnected(true);
      term.write('\r\n*** Connected to Relay Server. Ready for SSH session ***\r\n\r\n');
    };

    socket.onmessage = (event) => {
      let textData = event.data;
      if (event.data instanceof ArrayBuffer) {
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
            password: sshPassword,
            sessionId
          }));
          return;
        }
      } catch (err) {}

      term.write(textData);
    };

    socket.onclose = (event) => {
      if (socketRef.current !== socket) return;
      setStatus('disconnected');
      setIsConnected(false);
      term.write(`\r\nConnection closed. Code: ${event.code}\r\n`);
      if (inputDisposableRef.current) {
        try { inputDisposableRef.current.dispose(); } catch (e) {}
        inputDisposableRef.current = null;
      }
    };

    socket.onerror = () => {
      if (socketRef.current !== socket) return;
      setStatus('disconnected');
      setIsConnected(false);
      term.write('\r\nWebSocket Error.\r\n');
    };

    inputDisposableRef.current = term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });
  };

  useEffect(() => {
    let timeout: any;
    const handleResize = () => {
      if (fitAddonRef.current && termRef.current?.element) {
        try { fitAddonRef.current.fit(); } catch (err) {}
      }
    };

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
      if (inputDisposableRef.current) {
        try { inputDisposableRef.current.dispose(); } catch (e) {}
      }
      if (termRef.current) {
        try { termRef.current.dispose(); } catch (e) {}
      }
    };
  }, []);

  useEffect(() => {
    if (initialIp && !isConnected) {
      setSelectedIp(initialIp);
    }
  }, [initialIp, isConnected]);

  // Fetch saved logins using ticket
  useEffect(() => {
    if (!ticket) return;
    
    fetch('/api/server-logins', { headers: { 'Authorization': `Ticket ${ticket}` } })
      .then(res => res.json())
      .then(data => {
        if (data.logins) {
          setSavedLogins(data.logins.filter((l: any) => l.type === 'ssh'));
        }
      })
      .catch(err => console.error('Failed to fetch logins', err));

    fetch('/api/ssh-sessions', { headers: { 'Authorization': `Ticket ${ticket}` } })
      .then(res => res.json())
      .then(data => {
        if (data.sessions) {
          setStoredSessions(data.sessions);
        }
      })
      .catch(err => console.error('Failed to fetch stored sessions', err));
  }, [ticket]);

  const applyLogin = (e: any) => {
    const login = savedLogins.find(l => l.id === e.target.value);
    if (login) {
      setSelectedIp(login.ip);
      setSshUsername(login.loginUsername);
      setSshPassword(login.password);
      setActiveSessionId('');
    }
  };

  const applyStoredSession = (e: any) => {
    const session = storedSessions.find(s => s.sessionId === e.target.value);
    if (session) {
      setSelectedIp(session.ip);
      setSshUsername(session.sshUsername);
      setSshPassword('');
      setActiveSessionId(session.sessionId);
    }
  };

  const saveCurrentSession = () => {
    if (!activeSessionId) return;
    const name = prompt("Enter a name for this session:", `${sshUsername}@${selectedIp}`);
    if (!name) return;

    fetch('/api/ssh-sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Ticket ${ticket}`
      },
      body: JSON.stringify({
        sessionId: activeSessionId,
        name,
        target,
        ip: selectedIp,
        sshUsername
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setStoredSessions([...storedSessions, { sessionId: activeSessionId, name, target, ip: selectedIp, sshUsername }]);
        alert('Session saved!');
      }
    })
    .catch(err => console.error('Failed to save session', err));
  };

  return (
    <Box className="terminal-container">
      <Toolbar className="terminal-toolbar" variant="dense">
        {savedLogins.length > 0 && (
          <Select
            className="login-select"
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
          </Select>
        )}
        <Select
          className="session-select"
          size="small"
          value=""
          displayEmpty
          onChange={applyStoredSession}
          disabled={isConnected || storedSessions.length === 0}
        >
          <MenuItem value="" disabled>Stored Sessions...</MenuItem>
          {storedSessions.map(s => (
            <MenuItem key={s.sessionId} value={s.sessionId}>{s.name} ({s.ip})</MenuItem>
          ))}
        </Select>
        <TextField
          className="terminal-text-field"
          size="small"
          value={selectedIp}
          onChange={(e) => setSelectedIp(e.target.value)}
          placeholder="Target IP"
          disabled={isConnected}
          style={{ width: 130 }}
        />
        <TextField
          className="terminal-text-field"
          size="small"
          value={sshUsername}
          onChange={(e) => setSshUsername(e.target.value)}
          placeholder="Username"
          disabled={isConnected}
          style={{ width: 120 }}
        />
        <TextField
          className="terminal-text-field"
          size="small"
          type="password"
          value={sshPassword}
          onChange={(e) => setSshPassword(e.target.value)}
          placeholder="Password"
          disabled={isConnected}
          style={{ width: 120 }}
        />
        {isConnected ? (
          <>
            <Button
              className="terminal-button"
              variant="contained"
              color="error"
              onClick={disconnectTerminal}
            >
              Disconnect
            </Button>
            <Button
              className="terminal-button"
              variant="contained"
              color="success"
              onClick={saveCurrentSession}
              style={{ marginLeft: 8 }}
            >
              Save Session
            </Button>
          </>
        ) : (
          <Button
            className="terminal-button"
            variant="contained"
            color="primary"
            onClick={connectTerminal}
            disabled={status === 'connecting' || !selectedIp || !sshUsername}
          >
            {status === 'connecting' ? 'Connecting...' : 'Connect'}
          </Button>
        )}
      </Toolbar>
      <Box className="terminal-screen" ref={terminalRef} />
    </Box>
  );
}
