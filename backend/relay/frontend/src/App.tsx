import { useState, useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

function App() {
  // Authentication State
  const [token, setToken] = useState<string | null>(() => {
    // Check URL params first, then localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      localStorage.setItem('netlink_token', urlToken);
      // Clean url token to avoid exposing it
      window.history.replaceState({}, document.title, window.location.pathname);
      return urlToken;
    }
    return localStorage.getItem('netlink_token');
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  // Terminal & Connection State
  const [target, setTarget] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('target') || 'my-local-server';
  });
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [isConnected, setIsConnected] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setLoginError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('netlink_token', data.token);
      setToken(data.token);
    } catch (err: any) {
      setLoginError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    disconnectTerminal();
    localStorage.removeItem('netlink_token');
    setToken(null);
    setUsername('');
    setPassword('');
  };

  // Disconnect Terminal
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

  // Connect Terminal
  const connectTerminal = () => {
    if (!token || !terminalRef.current) return;

    // Clean up any existing connection
    if (socketRef.current) {
      socketRef.current.close();
    }
    if (termRef.current) {
      termRef.current.dispose();
    }

    setStatus('connecting');

    // Create Terminal Instance
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"Fira Code", Menlo, Monaco, Consolas, monospace',
      fontSize: 14,
      theme: {
        background: '#050811',
        foreground: '#f8fafc',
        cursor: '#3a86ff',
        black: '#000000',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#818cf8',
        cyan: '#06b6d4',
        white: '#f8fafc',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    term.write('Connecting to NetLink Relay Server...\r\n');

    // WebSocket URL Configuration
    const isSecure = window.location.protocol === 'https:';
    const protocol = isSecure ? 'wss:' : 'ws:';
    const wsPort = '4536';
    const host = window.location.hostname
      ? `${window.location.hostname}:${wsPort}`
      : `localhost:${wsPort}`;

    const socketUrl = `${protocol}//${host}/client?token=${encodeURIComponent(token)}&target=${encodeURIComponent(target)}`;

    term.write(`Target Endpoint: ${target}\r\n`);
    term.write(`Relay Server URL: ${socketUrl}\r\n\r\n`);

    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus('connected');
      setIsConnected(true);
      term.write('\r\n*** Connected to Relay Server. Ready for SSH session ***\r\n\r\n');
    };

    socket.onmessage = (event) => {
      term.write(event.data);
    };

    socket.onclose = (event) => {
      setStatus('disconnected');
      setIsConnected(false);
      term.write(`\r\nConnection closed. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}\r\n`);
    };

    socket.onerror = () => {
      setStatus('disconnected');
      setIsConnected(false);
      term.write('\r\nWebSocket Error. Please verify server connection and credentials.\r\n');
    };

    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });
  };

  // Handle Resizing
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (err) {
          // Ignore dimensions errors on hidden elements
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (termRef.current) termRef.current.dispose();
    };
  }, []);

  // Render Login Page
  if (!token) {
    return (
      <>
        <div className="bg-glow"></div>
        <div className="bg-glow-2"></div>
        <div className="glass-card">
          <h1 className="logo-title">NetLink</h1>
          <p className="subtitle">Secure SSH Gateway Tunnel</p>

          {loginError && <div className="alert-error">{loginError}</div>}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <input
                className="form-input"
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin username"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                className="form-input"
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                disabled={loading}
              />
            </div>

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </>
    );
  }

  // Render Terminal View
  return (
    <>
      <div className="bg-glow"></div>
      <div className="bg-glow-2"></div>
      
      <div className="terminal-layout">
        <div className="terminal-header">
          <div className="header-left">
            <div className="window-dots">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
            </div>
            <div className="status-info">
              <span className={`status-dot ${status}`}></span>
              <span style={{ textTransform: 'capitalize' }}>{status}</span>
            </div>
          </div>

          <div className="header-center">
            NetLink SSH Terminal
          </div>

          <div className="header-right">
            <button className="btn-logout" onClick={handleLogout}>Log Out</button>
          </div>
        </div>

        <div className="terminal-container-wrapper">
          <div className="connection-config">
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Target device identifier (e.g. my-local-server)"
              disabled={isConnected}
            />
            {isConnected ? (
              <button className="btn-secondary" onClick={disconnectTerminal}>
                Disconnect
              </button>
            ) : (
              <button 
                className="btn-primary" 
                style={{ width: 'auto', padding: '8px 24px', margin: 0, boxShadow: 'none' }}
                onClick={connectTerminal}
                disabled={status === 'connecting'}
              >
                {status === 'connecting' ? 'Connecting...' : 'Connect'}
              </button>
            )}
          </div>
          <div id="terminal-container" ref={terminalRef}></div>
        </div>
      </div>
    </>
  );
}

export default App;
