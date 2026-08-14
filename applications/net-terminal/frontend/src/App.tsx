import { useState, useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { Box, TextField, Select, MenuItem, Button, Toolbar, ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import "./TerminalApp.css";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#0b0f19",
      paper: "#1e293b"
    },
    primary: {
      main: "#38bdf8"
    }
  }
});

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const ticket = urlParams.get("ticket") || "";
  const target = urlParams.get("target") || "";
  const initialIp = urlParams.get("ip") || "";

  const [selectedIp, setSelectedIp] = useState(initialIp);
  const [sshUsername, setSshUsername] = useState("");
  const [sshPassword, setSshPassword] = useState("");
  const [savedLogins, setSavedLogins] = useState<any[]>([]);
  const [storedSessions, setStoredSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");

  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [isConnected, setIsConnected] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const inputDisposableRef = useRef<{ dispose: () => void } | null>(null);

  // Initialize terminal on mount so screen is immediately interactive & visible
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "Fira Code, Menlo, Monaco, Consolas, monospace",
      fontSize: 14,
      theme: {
        background: "#0b0f19",
        foreground: "#f8fafc",
        cursor: "#38bdf8",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    term.writeln("\x1b[1;36m[NetLink Remote SSH Terminal]\x1b[0m");
    term.writeln("\x1b[90mEnter Target IP, Username & Password, then click Connect to start SSH session.\x1b[0m\r\n");

    setTimeout(() => {
      try { fitAddon.fit(); } catch (e) { }
    }, 100);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const handleResize = () => {
      if (fitAddonRef.current && termRef.current?.element) {
        try { fitAddonRef.current.fit(); } catch (err) { }
        console.log("Debug: Terminal resized");
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (socketRef.current) socketRef.current.close();
      if (inputDisposableRef.current) {
        try { inputDisposableRef.current.dispose(); } catch (e) { }
      }
      try { term.dispose(); } catch (e) { }
    };
  }, []);

  const disconnectTerminal = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (inputDisposableRef.current) {
      try { inputDisposableRef.current.dispose(); } catch (e) { }
      inputDisposableRef.current = null;
    }
    if (termRef.current) {
      try { termRef.current.write("\r\n\x1b[31m[Detached from server]\x1b[0m\r\n"); } catch (e) { }
    }
    setStatus("disconnected");
    setIsConnected(false);
  };

  const connectTerminal = () => {
    if (!ticket || !terminalRef.current || !termRef.current) return;

    if (socketRef.current) socketRef.current.close();

    if (inputDisposableRef.current) {
      try { inputDisposableRef.current.dispose(); } catch (e) { }
      inputDisposableRef.current = null;
    }

    setStatus("connecting");
    const term = termRef.current;
    term.clear();
    term.write("Connecting to NetLink Relay Server...\r\n");

    const sessionId = activeSessionId || crypto.randomUUID();
    if (!activeSessionId) {
      setActiveSessionId(sessionId);
    }

    const isSecure = window.location.protocol === "https:";
    const protocol = isSecure ? "wss:" : "ws:";
    const host = window.location.host;

    const socketUrl = `${protocol}//${host}/client?ticket=${encodeURIComponent(ticket)}&target=${encodeURIComponent(target)}&sessionId=${encodeURIComponent(sessionId)}`;
    const socket = new WebSocket(socketUrl);
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus("connected");
      setIsConnected(true);
      term.write("\r\n\x1b[1;32m*** Connected to Relay Server. Authenticating SSH session... ***\x1b[0m\r\n\r\n");
    };

    socket.onmessage = (event) => {
      let textData = event.data;
      if (event.data instanceof ArrayBuffer) {
        textData = new TextDecoder().decode(event.data);
      }

      try {
        const data = JSON.parse(textData);
        if (data.type === "ready_for_credentials") {
          term.write("\r\n[System] Backend ready. Sending SSH credentials...\r\n");
          socket.send(JSON.stringify({
            type: "connect",
            ip: selectedIp || "localhost",
            username: sshUsername,
            password: sshPassword,
            sessionId
          }));
          return;
        }
      } catch (err) { }

      term.write(textData);
    };

    socket.onclose = (event) => {
      if (socketRef.current !== socket) return;
      setStatus("disconnected");
      setIsConnected(false);
      term.write(`\r\n\x1b[31mConnection closed. Code: ${event.code}\x1b[0m\r\n`);
      if (inputDisposableRef.current) {
        try { inputDisposableRef.current.dispose(); } catch (e) { }
        inputDisposableRef.current = null;
      }
    };

    socket.onerror = () => {
      if (socketRef.current !== socket) return;
      setStatus("disconnected");
      setIsConnected(false);
      term.write("\r\n\x1b[31mWebSocket Connection Error.\x1b[0m\r\n");
    };

    inputDisposableRef.current = term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });
  };

  useEffect(() => {
    if (initialIp && !isConnected) {
      setSelectedIp(initialIp);
    }
  }, [initialIp, isConnected]);

  // Fetch saved logins using ticket
  useEffect(() => {
    if (!ticket) return;

    fetch("/api/server-logins", { headers: { "Authorization": `Ticket ${ticket}` } })
      .then(res => res.json())
      .then(data => {
        if (data.logins) {
          setSavedLogins(data.logins.filter((l: any) => l.type === "ssh"));
        }
      })
      .catch(err => console.error("Failed to fetch logins", err));

    fetch("/api/net-terminal/ssh-sessions", { headers: { "Authorization": `Ticket ${ticket}` } })
      .then(res => res.json())
      .then(data => {
        if (data.sessions) {
          setStoredSessions(data.sessions);
        }
      })
      .catch(err => console.error("Failed to fetch stored sessions", err));
  }, [ticket]);

  const applyLogin = (e: any) => {
    const login = savedLogins.find(l => l.id === e.target.value);
    if (login) {
      setSelectedIp(login.ip);
      setSshUsername(login.loginUsername);
      setSshPassword(login.password);
      setActiveSessionId("");
    }
  };

  const applyStoredSession = (e: any) => {
    const session = storedSessions.find(s => s.sessionId === e.target.value);
    if (session) {
      setSelectedIp(session.ip);
      setSshUsername(session.sshUsername);
      setSshPassword("");
      setActiveSessionId(session.sessionId);
    }
  };

  const saveCurrentSession = () => {
    if (!activeSessionId) return;
    const name = prompt("Enter a name for this session:", `${sshUsername}@${selectedIp}`);
    if (!name) return;

    fetch("/api/net-terminal/ssh-sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Ticket ${ticket}`
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
          alert("Session saved!");
        }
      })
      .catch(err => console.error("Failed to save session", err));
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
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
              disabled={status === "connecting" || !selectedIp || !sshUsername}
            >
              {status === "connecting" ? "Connecting..." : "Connect"}
            </Button>
          )}
        </Toolbar>
        <Box className="terminal-screen" ref={terminalRef} />
      </Box>
    </ThemeProvider>
  );
}
