import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CssBaseline,
  ThemeProvider,
  InputAdornment
} from '@mui/material';
import { ShieldCheck, Lock, User, Terminal, Laptop, ArrowRight } from 'lucide-react';
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

          {/* Left Side: Brand, Architecture & Live Metrics */}
          <Box className="left-panel">
            <Box className="logo-wrapper">
              <Box className="os-badge">
                <Box className="os-dot" />
                <Typography className="os-text">NetLink OS</Typography>
                <Typography className="os-version">/ v2.4.0</Typography>
              </Box>
            </Box>

            <Box className="left-content">
              <Typography className="left-title" variant="h3">
                Decentralized Remote Control &amp; <span className="gradient-title-text">Edge Access</span>
              </Typography>
              <Typography className="left-subtitle">
                Connect instantly to bare-metal servers, home labs, VMs, and container clusters with zero open inbound ports.
              </Typography>

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
                  <span>Self-Hosted Gateway</span>
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
              <span>NetLink Gateway Engine</span>
            </Box>
          </Box>

          {/* Right Side: Clean Obsidian Glass Login Form */}
          <Box className="right-panel">
            <Box className="form-wrapper">
              <Box className="form-header-badge">
                <ShieldCheck size={26} color="#38bdf8" />
              </Box>
              <Typography className="form-title" variant="h5">
                Welcome to NetLink
              </Typography>
              <Typography className="form-subtitle">
                Enter your credentials to unlock your environment.
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
                    Sign in to Gateway
                  </Button>
                )}
              </form>

              <a href="/devices/authorize" className="device-auth-link">
                <Laptop size={15} />
                <span>Authorize external desktop client</span>
              </a>
            </Box>
          </Box>
        </Box>
      ) : (
        <Desktop token={token} onLogout={handleLogout} target={target} setTarget={setTarget} allowedTargets={allowedTargets} />
      )}
      </Box>
    </ThemeProvider>
  );
}

export default App;
