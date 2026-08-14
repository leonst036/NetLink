import { useState, useEffect, useRef } from "react";
// @ts-ignore
import RFB from "@novnc/novnc";
import { Maximize, Monitor, Loader2 } from "lucide-react";
import { Box, TextField, Select, MenuItem, Button, IconButton, Toolbar, Typography, Tooltip, ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import "./VncApp.css";

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

interface VncAppProps {
    ticket: string;
    target: string;
    initialIp?: string;
}

export default function VncApp({ ticket, target, initialIp }: VncAppProps) {
    const [selectedIp, setSelectedIp] = useState(initialIp || "");
    const [vncPort, setVncPort] = useState("5900");
    const [vncPassword, setVncPassword] = useState("");
    const [selectedMonitor, setSelectedMonitor] = useState("1");
    const [savedLogins, setSavedLogins] = useState<any[]>([]);
    const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
    const [isConnected, setIsConnected] = useState(false);
    const [stats, setStats] = useState({ fps: 0, latency: 0 });
    const [isDebug, setIsDebug] = useState(() => localStorage.getItem("netlink_debug") === "true");

    const containerRef = useRef<HTMLDivElement>(null);
    const rfbRef = useRef<RFB | null>(null);
    const statIntervalRef = useRef<any>(null);

    const debugLog = (...args: unknown[]) => {
        if (window.localStorage.getItem("netlink_debug") === "true") {
            console.log("[VNC Debug]", ...args);
        }
    };

    useEffect(() => {
        const handleSettingsChange = () => setIsDebug(localStorage.getItem("netlink_debug") === "true");
        window.addEventListener("settingsChange", handleSettingsChange);
        return () => window.removeEventListener("settingsChange", handleSettingsChange);
    }, []);

    const disconnectVnc = () => {
        if (rfbRef.current) {
            debugLog("Disconnecting existing VNC session");
            rfbRef.current.disconnect();
            rfbRef.current = null;
        }
        if (statIntervalRef.current) {
            clearInterval(statIntervalRef.current);
            statIntervalRef.current = null;
        }
        setStatus("disconnected");
        setIsConnected(false);
    };

    const connectVnc = () => {
        if (!ticket || !containerRef.current || !selectedIp) {
            debugLog("VNC connection skipped due to missing prerequisites", { ticketPresent: !!ticket, hasContainer: !!containerRef.current, selectedIp });
            return;
        }

        disconnectVnc();
        setStatus("connecting");
        debugLog("Starting VNC connection attempt", { target, selectedIp, vncPort, hasPassword: !!vncPassword, monitor: selectedMonitor });

        const isSecure = window.location.protocol === "https:";
        const protocol = isSecure ? "wss:" : "ws:";
        let host = window.location.host;
        if (host.includes("localhost:5173")) host = import.meta.env.VITE_RELAY_HOST || "localhost:4535";
        const socketUrl = `${protocol}//${host}/api/vnc-viewer/ws?ticket=${encodeURIComponent(ticket)}&target=${encodeURIComponent(target)}`;
        debugLog("Connecting web socket", { socketUrl });

        const ws = new window.WebSocket(socketUrl, ["binary"]);

        let isBackendReady = false;
        let sendBuffer: any[] = [];
        const originalSend = ws.send.bind(ws);

        ws.send = function (data: any) {
            if (!isBackendReady) {
                debugLog("Queuing outbound websocket message until backend is ready", { dataType: typeof data, queuedCount: sendBuffer.length + 1 });
                sendBuffer.push(data);
            } else {
                debugLog("Sending websocket message", { dataType: typeof data });
                originalSend(data);
            }
        };

        ws.addEventListener("open", () => {
            debugLog("Websocket opened");
        });

        ws.addEventListener("close", (event) => {
            debugLog("Websocket closed", { code: event.code, reason: event.reason });
            if (status === "connecting") {
                setStatus("disconnected");
                setIsConnected(false);
            }
        });

        ws.addEventListener("error", (event) => {
            debugLog("Websocket error", event);
            setStatus("disconnected");
            setIsConnected(false);
        });

        let frames = 0;
        let lastTime = performance.now();
        statIntervalRef.current = setInterval(() => {
            const now = performance.now();
            const currentFps = Math.round((frames * 1000) / (now - lastTime));

            const startPing = performance.now();
            fetch("/health").then(() => {
                const latency = Math.round(performance.now() - startPing);
                setStats({ fps: currentFps, latency });
            }).catch(() => {
                setStats({ fps: currentFps, latency: 0 });
            });

            frames = 0;
            lastTime = now;
        }, 1000);

        ws.addEventListener("message", (e) => {
            frames++;
            let text = "";
            if (e.data instanceof ArrayBuffer) {
                text = new TextDecoder().decode(e.data);
            } else if (typeof e.data === "string") {
                text = e.data;
            }

            debugLog("Received websocket message", { backendReady: isBackendReady, textSnippet: text.slice(0, 200) });

            if (!isBackendReady && text.includes("ready_for_credentials")) {
                const credentialsPayload = JSON.stringify({ type: "connect_vnc", ip: selectedIp, port: parseInt(vncPort, 10) || 5900 });
                debugLog("Backend requested credentials; sending VNC connect request", { payload: credentialsPayload });
                originalSend(credentialsPayload);
                e.stopImmediatePropagation();
                return;
            }

            if (!isBackendReady && text.includes("vnc_started")) {
                isBackendReady = true;
                debugLog("Backend reported VNC started; flushing buffered messages", { bufferedCount: sendBuffer.length });
                sendBuffer.forEach(data => originalSend(data));
                sendBuffer = [];
                e.stopImmediatePropagation();
                return;
            }
        });

        const rfb = new RFB(containerRef.current, ws, {
            credentials: { password: vncPassword }
        });

        rfb.qualityLevel = 4;
        rfb.compressionLevel = 4;

        rfb.scaleViewport = true;
        rfb.resizeSession = true;

        rfb.addEventListener("connect", () => {
            debugLog("noVNC connected", { selectedIp, vncPort, monitor: selectedMonitor });
            setStatus("connected");
            setIsConnected(true);

            try {
                if (typeof rfb.sendSetMonitor === "function") {
                    const monitorNumber = parseInt(selectedMonitor, 10);
                    if (!isNaN(monitorNumber)) {
                        debugLog("Sending initial monitor selection", { monitorNumber });
                        rfb.sendSetMonitor(monitorNumber);
                    }
                }
            } catch (e) {
                console.error("Failed to send set monitor message", e);
            }
        });
        rfb.addEventListener("disconnect", () => {
            debugLog("noVNC disconnected");
            setStatus("disconnected");
            setIsConnected(false);
        });
        rfbRef.current = rfb;
    };

    useEffect(() => {
        return () => disconnectVnc();
    }, []);

    // Fetch saved logins
    useEffect(() => {
        debugLog("Fetching saved VNC logins");
        fetch("/api/server-logins", { headers: { "Authorization": `Ticket ${ticket}` } })
            .then(res => res.json())
            .then(data => {
                if (data.logins) {
                    const vncLogins = data.logins.filter((l: any) => l.type === "vnc");
                    debugLog("Loaded saved VNC logins", { count: vncLogins.length });
                    setSavedLogins(vncLogins);
                }
            })
            .catch(err => {
                debugLog("Failed to fetch saved VNC logins", err);
                console.error("Failed to fetch logins", err);
            });
    }, [ticket]);

    const applyLogin = (e: any) => {
        const login = savedLogins.find(l => l.id === e.target.value);
        if (login) {
            debugLog("Applying saved VNC login", { name: login.name, ip: login.ip, port: login.port || "5900" });
            setSelectedIp(login.ip);
            setVncPort(login.port || "5900");
            setVncPassword(login.password);
        }
    };

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            debugLog("Entering fullscreen");
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            debugLog("Exiting fullscreen");
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        if (isConnected && rfbRef.current) {
            debugLog("Monitor selection changed; updating connected session", { selectedMonitor });
            try {
                // @ts-ignore
                if (typeof rfbRef.current.sendSetMonitor === "function") {
                    const monitorNumber = parseInt(selectedMonitor, 10);
                    if (!isNaN(monitorNumber)) {
                        // @ts-ignore
                        debugLog("Sending updated monitor selection", { monitorNumber });
                        rfbRef.current.sendSetMonitor(monitorNumber);
                    }
                }
            } catch (e) {
                console.error("Failed to send set monitor message", e);
            }
        }
    }, [selectedMonitor, isConnected]);

    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Box className="vnc-container">
                <Toolbar className="vnc-toolbar" variant="dense">
                    {savedLogins.length > 0 && (
                        <Select
                            className="vnc-select"
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
                    <TextField
                        className="vnc-text-field"
                        size="small"
                        value={selectedIp}
                        onChange={(e) => setSelectedIp(e.target.value)}
                        placeholder="Target IP"
                        disabled={isConnected}
                        style={{ width: 130 }}
                    />
                    <TextField
                        className="vnc-text-field"
                        size="small"
                        value={vncPort}
                        onChange={(e) => setVncPort(e.target.value)}
                        placeholder="Port"
                        disabled={isConnected}
                        style={{ width: 80 }}
                    />
                    <TextField
                        className="vnc-text-field"
                        size="small"
                        type="password"
                        value={vncPassword}
                        onChange={(e) => setVncPassword(e.target.value)}
                        placeholder="Password"
                        disabled={isConnected}
                        style={{ width: 110 }}
                    />
                    <Box className="monitor-container">
                        <Typography className="monitor-label" variant="body2">Monitor:</Typography>
                        <TextField
                            className="vnc-text-field"
                            size="small"
                            type="number"
                            inputProps={{ min: 1 }}
                            value={selectedMonitor}
                            onChange={(e) => setSelectedMonitor(e.target.value)}
                            style={{ width: 60 }}
                        />
                    </Box>
                    {isConnected ? (
                        <>
                            <Button
                                className="vnc-button"
                                variant="contained"
                                color="error"
                                onClick={disconnectVnc}
                            >
                                Disconnect
                            </Button>
                            <Tooltip title="Fullscreen">
                                <IconButton className="fullscreen-icon-button" onClick={toggleFullscreen}>
                                    <Maximize size={16} />
                                </IconButton>
                            </Tooltip>
                        </>
                    ) : (
                        <Button
                            className="vnc-button"
                            variant="contained"
                            color="success"
                            onClick={connectVnc}
                            disabled={status === "connecting" || !selectedIp}
                        >
                            {status === "connecting" ? "Connecting..." : "Connect VNC"}
                        </Button>
                    )}
                </Toolbar>

                <Box className="vnc-screen-container" ref={containerRef}>
                    {status === "disconnected" && (
                        <Box sx={{ textAlign: "center", p: 3, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                            <Monitor size={48} color="#38bdf8" style={{ opacity: 0.8 }} />
                            <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 600 }}>
                                VNC Remote Desktop Client
                            </Typography>
                            <Typography variant="body2" sx={{ color: "#94a3b8", maxWidth: 360 }}>
                                Enter Target IP & Port, then click <strong style={{ color: "#38bdf8" }}>Connect VNC</strong> to start session.
                            </Typography>
                        </Box>
                    )}

                    {status === "connecting" && (
                        <Box sx={{ textAlign: "center", p: 3, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
                            <Loader2 size={36} color="#38bdf8" className="spin-icon" />
                            <Typography variant="body1" sx={{ color: "#38bdf8", fontWeight: 500 }}>
                                Connecting to VNC Server ({selectedIp}:{vncPort})...
                            </Typography>
                        </Box>
                    )}

                    {isDebug && isConnected && (
                        <Box className="debug-stats-container">
                            <div>FPS: {stats.fps}</div>
                            <div>Ping: {stats.latency}ms</div>
                        </Box>
                    )}
                </Box>
            </Box>
        </ThemeProvider>
    );
}
