import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CssBaseline,
  ThemeProvider,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton
} from '@mui/material';
import {
  ShieldCheck,
  Lock,
  User,
  Terminal,
  Laptop,
  ArrowRight,
  Copy,
  Check,
  HelpCircle,
  Clock,
  Trash2
} from 'lucide-react';
import Desktop from './Desktop';
import NetLinkLoader from './components/NetLinkLoader';
import { DeviceAuthorizeView } from './components/DeviceAuthorizeView';
import { getAppTheme } from './theme';
import { getCookie, setCookie, deleteCookie, isJwtExpired, parseJwt } from './utils/cookieUtils';
import './App.css';

function App() {
  const [token, setToken] = useState<string | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      setCookie('netlink_token', urlToken, 1);
      localStorage.setItem('netlink_token', urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
      if (!isJwtExpired(urlToken)) return urlToken;
    }

    const cookieToken = getCookie('netlink_token');
    if (cookieToken && !isJwtExpired(cookieToken)) {
      localStorage.setItem('netlink_token', cookieToken);
      return cookieToken;
    }

    const localToken = localStorage.getItem('netlink_token');
    if (localToken && !isJwtExpired(localToken)) {
      setCookie('netlink_token', localToken, 1);
      return localToken;
    }

    return null;
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [copied, setCopied] = useState(false);

  const [target, setTarget] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('target') || localStorage.getItem('netlink_target') || '';
  });

  const [allowedTargets, setAllowedTargets] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('netlink_allowed_targets') || '[]');
    } catch {
      return [];
    }
  });

  const handleLogout = useCallback(() => {
    deleteCookie('netlink_token');
    localStorage.removeItem('netlink_token');
    localStorage.removeItem('netlink_target');
    localStorage.removeItem('netlink_allowed_targets');
    setToken(null);
    setUsername('');
    setPassword('');
    setAllowedTargets([]);
  }, []);

  // Set timer to automatically log out when JWT token expires
  useEffect(() => {
    if (!token) return;

    if (isJwtExpired(token)) {
      console.warn('JWT token is expired. Triggering logout.');
      handleLogout();
      return;
    }

    const payload = parseJwt(token);
    if (payload && payload.exp) {
      const timeUntilExpiry = (payload.exp * 1000) - Date.now();
      if (timeUntilExpiry > 0) {
        const timer = setTimeout(() => {
          console.warn('JWT token timer expired. Logging out.');
          handleLogout();
        }, timeUntilExpiry);
        return () => clearTimeout(timer);
      }
    }
  }, [token, handleLogout]);

  // Intercept global 401 Unauthorized responses & authentication failure events
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      let url = '';
      if (typeof args[0] === 'string') url = args[0];
      else if (args[0] instanceof Request) url = args[0].url;
      else if (args[0] instanceof URL) url = args[0].href;
      
      if (response.status === 401 && !url.includes('github.com')) {
        console.warn('HTTP 401 Unauthorized detected. Dispatching auth expired event.');
        window.dispatchEvent(new CustomEvent('netlink_auth_expired'));
      }
      return response;
    };

    const handleAuthExpired = () => {
      console.warn('Session expired or authentication failed. Logging out...');
      handleLogout();
    };

    window.addEventListener('netlink_auth_expired', handleAuthExpired);

    return () => {
      window.fetch = originalFetch;
      window.removeEventListener('netlink_auth_expired', handleAuthExpired);
    };
  }, [handleLogout]);

  // Redirect to requested page if already authenticated
  useEffect(() => {
    if (token && window.location.pathname === '/') {
      const urlParams = new URLSearchParams(window.location.search);
      const redirectUrl = urlParams.get('redirect');
      if (redirectUrl && redirectUrl.startsWith('/')) {
        window.location.href = redirectUrl;
      }
    }
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setLoginError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, target: target.trim() || undefined }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');

      let activeTarget = target.trim();
      if (!activeTarget && data.targets && data.targets.length > 0) {
        activeTarget = data.targets[0];
        setTarget(activeTarget);
      }

      setCookie('netlink_token', data.token, 1);
      localStorage.setItem('netlink_token', data.token);
      localStorage.setItem('netlink_target', activeTarget);
      localStorage.setItem('netlink_allowed_targets', JSON.stringify(data.targets || []));
      setAllowedTargets(data.targets || []);
      setToken(data.token);

      const urlParams = new URLSearchParams(window.location.search);
      const redirectUrl = urlParams.get('redirect');
      if (redirectUrl && redirectUrl.startsWith('/')) {
        window.location.href = redirectUrl;
        return;
      }
    } catch (err: any) {
      setLoginError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDemoCommand = () => {
    const origin = window.location.origin;
    const cmd = `curl -ks ${origin}/api/demo.sh | bash`;
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDeviceAuthorizeRoute = typeof window !== 'undefined' && (
    window.location.pathname === '/devices/authorize' ||
    window.location.pathname.startsWith('/devices/authorize')
  );

  if (isDeviceAuthorizeRoute) {
    if (!token) {
      const returnUrl = window.location.pathname + window.location.search;
      window.location.href = `/?redirect=${encodeURIComponent(returnUrl)}`;
      return null;
    }

    return (
      <ThemeProvider theme={getAppTheme('Dark')}>
        <CssBaseline />
        <DeviceAuthorizeView
          token={token}
          onLogout={handleLogout}
        />
      </ThemeProvider>
    );
  }

  const demoCmd = typeof window !== 'undefined' ? `curl -ks ${window.location.origin}/api/demo.sh | bash` : 'curl -ks /api/demo.sh | bash';

  return (
    <ThemeProvider theme={getAppTheme('Dark')}>
      <CssBaseline />
      <Box className="mobile-blocker">
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>Mobile Not Supported</Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
          Please use a desktop or tablet in landscape mode to access NetLink OS. Mobile support is coming soon.
        </Typography>
      </Box>
      <Box className="app-content">
      {!token ? (
        <Box className="login-container">
          <Box className="login-grid-bg" />

          {/* Left Side: Brand, Architecture, Demo Launcher & Live Metrics */}
          <Box className="left-panel">
            <Box className="logo-wrapper">
              <Box className="os-badge">
                <Box className="os-dot" />
                <Typography className="os-text">NetLink OS</Typography>
                <Typography className="os-version">/ v2.4.0 (Demo Mode)</Typography>
              </Box>
            </Box>

            <Box className="left-content">
              <Typography className="left-title" variant="h3">
                Decentralized Remote Control &amp; <span className="gradient-title-text">Edge Access</span>
              </Typography>
              <Typography className="left-subtitle">
                Zero-Config, Self-Destructing Environment with hardware-accelerated encrypted tunnels.
              </Typography>

              {/* Demo Node Interactive Command Box */}
              <Box sx={{
                mb: 3,
                p: 2.5,
                borderRadius: '16px',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 25px rgba(0,0,0,0.4)'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
                    1. Start Your Temporary Node
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<HelpCircle size={14} />}
                    onClick={() => setShowExplanation(true)}
                    sx={{ color: '#38bdf8', textTransform: 'none', fontSize: '0.75rem', p: 0.5 }}
                  >
                    How it works
                  </Button>
                </Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', display: 'block', mb: 1.5 }}>
                  Run this command on any machine with Docker to receive your 24-hour credentials:
                </Typography>

                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1.5,
                  borderRadius: '10px',
                  background: 'rgba(2, 6, 23, 0.75)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderLeft: '4px solid #38bdf8'
                }}>
                  <Box component="code" sx={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.85rem',
                    color: '#38bdf8',
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                    mr: 1
                  }}>
                    {demoCmd}
                  </Box>
                  <IconButton
                    size="small"
                    onClick={handleCopyDemoCommand}
                    sx={{ color: copied ? '#10b981' : 'rgba(255,255,255,0.7)', flexShrink: 0 }}
                    title="Copy to clipboard"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </IconButton>
                </Box>
              </Box>

              <Box className="feature-pills">
                <Box className="pill-item">
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                  <span>Zero-Config P2P</span>
                </Box>
                <Box className="pill-item">
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
                  <span>End-to-End Encrypted</span>
                </Box>
                <Box className="pill-item">
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#818cf8', boxShadow: '0 0 6px #818cf8' }} />
                  <span>24h Auto-Expiry</span>
                </Box>
              </Box>

              <Box className="telemetry-card">
                <Box className="telemetry-header">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Terminal size={16} color="#38bdf8" />
                    <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#fff' }}>
                      Gateway Telemetry
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                    <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600 }}>READY</Typography>
                  </Box>
                </Box>

                <Box className="telemetry-grid">
                  <Box className="telemetry-stat">
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>Uptime</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff', mt: 0.5 }}>99.9%</Typography>
                  </Box>
                  <Box className="telemetry-stat">
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>Latency</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#10b981', mt: 0.5 }}>&lt; 15ms</Typography>
                  </Box>
                  <Box className="telemetry-stat">
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>Tunnel</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#38bdf8', mt: 0.5 }}>ChaCha20</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
              <ShieldCheck size={16} color="#38bdf8" />
              <span>NetLink Gateway Engine (Demo Version)</span>
            </Box>
          </Box>

          {/* Right Side: Clean Obsidian Glass Login Form */}
          <Box className="right-panel">
            <Box className="form-wrapper">
              <Box className="form-header-badge">
                <ShieldCheck size={26} color="#38bdf8" />
              </Box>
              <Typography className="form-title" variant="h5">
                Sign in to Demo
              </Typography>
              <Typography className="form-subtitle">
                Enter your generated temporary credentials to unlock your environment.
              </Typography>

              {loginError && (
                <Alert className="styled-alert" severity="error">
                  {loginError}
                </Alert>
              )}

              <form className="form-container" onSubmit={handleLogin}>
                <TextField
                  className="styled-text-field"
                  label="Username"
                  variant="outlined"
                  fullWidth
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <User size={18} color="rgba(255, 255, 255, 0.4)" />
                        </InputAdornment>
                      ),
                    }
                  }}
                />

                <TextField
                  className="styled-text-field"
                  label="Password"
                  type="password"
                  variant="outlined"
                  fullWidth
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock size={18} color="rgba(255, 255, 255, 0.4)" />
                        </InputAdornment>
                      ),
                    }
                  }}
                />

                {loading ? (
                  <Box className="loader-container">
                    <NetLinkLoader size={48} />
                  </Box>
                ) : (
                  <Button
                    className="submit-button"
                    type="submit"
                    variant="contained"
                    fullWidth
                    disableElevation
                    disabled={loading}
                    endIcon={<ArrowRight size={18} />}
                  >
                    Connect to Node
                  </Button>
                )}
              </form>

              <Typography variant="caption" sx={{ mt: 3, display: 'block', color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>
                <strong>Privacy Disclaimer:</strong> This demo environment is completely stateless and self-destructing. We collect no personal data. All demo accounts and associated data are permanently wiped after 24 hours.
              </Typography>

              <a href="/devices/authorize" className="device-auth-link" style={{ marginTop: '16px' }}>
                <Laptop size={15} />
                <span>Authorize external desktop client</span>
              </a>
            </Box>
          </Box>

          {/* Explanation Modal */}
          <Dialog
            open={showExplanation}
            onClose={() => setShowExplanation(false)}
            maxWidth="xs"
            fullWidth
            slotProps={{
              paper: {
                sx: {
                  backgroundColor: 'rgba(15, 23, 42, 0.92)',
                  backdropFilter: 'blur(24px)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '20px',
                  color: '#fff',
                  boxShadow: '0 25px 50px rgba(0,0,0,0.8)'
                }
              }
            }}
          >
            <DialogTitle sx={{ color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              <HelpCircle size={20} />
              How Demo Mode Works
            </DialogTitle>
            <DialogContent sx={{ pt: 1 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <Terminal size={18} color="#38bdf8" style={{ marginTop: 2, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#fff' }}>1. Automatic Credential Setup</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>The installer script requests a temporary isolated user and node target from this relay.</Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <Clock size={18} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#fff' }}>2. Docker Sandboxing</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>It runs the official NetLink Node Docker container on your machine with zero open inbound ports.</Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <Trash2 size={18} color="#f87171" style={{ marginTop: 2, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#fff' }}>3. Guaranteed 24h Auto-Wipe</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>After 24 hours, the container stops and your temporary account and credentials are automatically destroyed.</Typography>
                  </Box>
                </Box>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
              <Button
                onClick={() => setShowExplanation(false)}
                variant="outlined"
                fullWidth
                sx={{ borderRadius: '20px', borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
              >
                Got It
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      ) : (
        <Desktop token={token} onLogout={handleLogout} target={target} setTarget={setTarget} allowedTargets={allowedTargets} />
      )}
      </Box>
    </ThemeProvider>
  );
}

export default App;
