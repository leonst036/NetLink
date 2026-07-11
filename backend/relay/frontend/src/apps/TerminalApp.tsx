import { useState, useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface TerminalAppProps {
  token: string;
  target: string;
  initialIp?: string;
}

export default function TerminalApp({ token, target, initialIp }: TerminalAppProps) {
  const [selectedIp, setSelectedIp] = useState(initialIp || '');
  const [sshUsername, setSshUsername] = useState('');
  const [sshPassword, setSshPassword] = useState('');
  
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

    const isSecure = window.location.protocol === 'https:';
    const protocol = isSecure ? 'wss:' : 'ws:';
    const wsPort = '4536';
    const host = window.location.hostname
      ? `${window.location.hostname}:${wsPort}`
      : `localhost:${wsPort}`;

    const socketUrl = `${protocol}//${host}/client?token=${encodeURIComponent(token)}&target=${encodeURIComponent(target)}`;
    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus('connected');
      setIsConnected(true);
      term.write('\r\n*** Connected to Relay Server. Ready for SSH session ***\r\n\r\n');
    };

    socket.onmessage = async (event) => {
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
          return;
        }
      } catch (err) {
        // Not a JSON control message
      }
      
      term.write(textData);
    };

    socket.onclose = (event) => {
      setStatus('disconnected');
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
        } catch (err) {}
      }
    };

    // Resize observer on terminalRef to auto-fit when window resizes
    const observer = new ResizeObserver(() => {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#050811' }}>
      <div style={{ padding: '10px', background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          type="text"
          value={selectedIp}
          onChange={(e) => setSelectedIp(e.target.value)}
          placeholder="Target IP"
          disabled={isConnected}
          style={inputStyle}
        />
        <input
          type="text"
          value={sshUsername}
          onChange={(e) => setSshUsername(e.target.value)}
          placeholder="Username"
          disabled={isConnected}
          style={inputStyle}
        />
        <input
          type="password"
          value={sshPassword}
          onChange={(e) => setSshPassword(e.target.value)}
          placeholder="Password"
          disabled={isConnected}
          style={inputStyle}
        />
        {isConnected ? (
          <button style={btnDisconnectStyle} onClick={disconnectTerminal}>Disconnect</button>
        ) : (
          <button style={btnConnectStyle} onClick={connectTerminal} disabled={status === 'connecting' || !selectedIp || !sshUsername}>
            {status === 'connecting' ? '...' : 'Connect'}
          </button>
        )}
      </div>
      <div id="terminal-container" ref={terminalRef} style={{ flex: 1, padding: '10px' }}></div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  padding: '6px 10px',
  borderRadius: '6px',
  color: 'white',
  fontSize: '0.85rem',
  width: '120px'
};

const btnConnectStyle: React.CSSProperties = {
  background: '#3b82f6',
  border: 'none',
  padding: '6px 12px',
  borderRadius: '6px',
  color: 'white',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 'bold'
};

const btnDisconnectStyle: React.CSSProperties = {
  ...btnConnectStyle,
  background: '#ef4444'
};
