import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CssBaseline,
  ThemeProvider
} from '@mui/material';
import Desktop from './Desktop';
import GeminiLoader from './components/GeminiLoader';
import { getAppTheme } from './theme';
import './App.css';

function App() {
  const [token, setToken] = useState<string | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      localStorage.setItem('netlink_token', urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
      return urlToken;
    }
    return localStorage.getItem('netlink_token');
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setLoginError('');

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTarget = urlParams.get('target');

      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, target: urlTarget ? urlTarget.trim() : undefined }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');

      let activeTarget = target.trim();
      if (activeTarget && data.targets && !data.targets.includes(activeTarget)) {
        activeTarget = '';
      }
      if (!activeTarget && data.targets && data.targets.length > 0) {
        activeTarget = data.targets[0];
        setTarget(activeTarget);
      }

      localStorage.setItem('netlink_token', data.token);
      localStorage.setItem('netlink_target', activeTarget);
      localStorage.setItem('netlink_allowed_targets', JSON.stringify(data.targets || []));
      setAllowedTargets(data.targets || []);
      setToken(data.token);
    } catch (err: any) {
      setLoginError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('netlink_token');
    localStorage.removeItem('netlink_target');
    localStorage.removeItem('netlink_allowed_targets');
    setToken(null);
    setUsername('');
    setPassword('');
    setAllowedTargets([]);
  };

  return (
    <ThemeProvider theme={getAppTheme('Dark')}>
      <CssBaseline />
      {!token ? (
        <Box className="login-container">
          {/* Left Side: Brand & Visuals (Hidden on mobile) */}
          <Box className="left-panel">
            <Box className="logo-wrapper">
              <Typography className="logo-text" variant="h6">
                <span className="logo-dot" />
                NetLink Login
              </Typography>
            </Box>
            <Box className="left-content">
              <Typography className="left-title" variant="h2">
                NetLink Demo<br />
              </Typography>
              <Typography className="left-subtitle" variant="body1">
                Zero-Config Self-Destructing Environment.
              </Typography>

              {/* Docker Instructions for Desktop */}
              <Box sx={{ mt: 6, p: 3, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography variant="h6" sx={{ color: '#fff', mb: 1, fontFamily: "'Outfit', sans-serif" }}>1. Start your temporary node</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2, fontFamily: "'Outfit', sans-serif" }}>Run this command on any machine with Docker to generate your 24-hour demo credentials:</Typography>

                <Box sx={{ position: 'relative', mb: 2 }}>
                  <Box component="code" sx={{
                    display: 'block', p: 2, pr: 6, bgcolor: 'rgba(0,0,0,0.4)', borderRadius: 1,
                    color: '#38bdf8', borderLeft: '4px solid #38bdf8', fontFamily: 'monospace', wordBreak: 'break-all'
                  }}>
                    curl -ks {window.location.origin}/api/demo.sh | bash
                  </Box>
                  <Button
                    onClick={() => setShowExplanation(true)}
                    sx={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      minWidth: 'auto', width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
                      color: 'rgba(255,255,255,0.5)', p: 0, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: '#fff' }
                    }}
                  >
                    ?
                  </Button>
                </Box>

                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 0.5 }}>Windows (PowerShell):</Typography>
                <Box component="code" sx={{
                  display: 'block', p: 1.5, bgcolor: 'rgba(0,0,0,0.4)', borderRadius: 1,
                  color: '#38bdf8', borderLeft: '4px solid #38bdf8', fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all'
                }}>
                  Invoke-Expression (Invoke-WebRequest -Uri "{window.location.origin}/api/demo.ps1" -UseBasicParsing).Content
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Right Side: Clean Login Form */}
          <Box className="right-panel">
            <Box className="form-wrapper">
              <Typography className="form-title" variant="h4">
                Connect
              </Typography>
              <Typography className="form-subtitle" variant="body1">
                2. Login to manage your machine
              </Typography>

              {loginError && (
                <Alert className="styled-alert" severity="error">
                  {loginError}
                </Alert>
              )}

              <form className="form-container" onSubmit={handleLogin}>
                <TextField
                  className="styled-text-field"
                  label="Demo Username"
                  placeholder="demo_xxxxxxx"
                  variant="standard"
                  fullWidth
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />

                <TextField
                  className="styled-text-field"
                  label="Demo Password"
                  placeholder="Enter generated password"
                  type="password"
                  variant="standard"
                  fullWidth
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />

                {loading ? (
                  <Box className="loader-container">
                    <GeminiLoader size={48} />
                  </Box>
                ) : (
                  <Button
                    className="submit-button"
                    type="submit"
                    variant="contained"
                    fullWidth
                    disableElevation
                    disabled={loading}
                  >
                    Connect to Node
                  </Button>
                )}
              </form>

              <Typography variant="caption" sx={{ mt: 6, display: 'block', color: 'rgba(255,255,255,0.3)', textAlign: 'center', fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>
                <strong>Privacy Disclaimer:</strong> This demo environment is completely stateless and self-destructing. We use zero cookies, no third-party tracking, and collect no personal data. All demo accounts and associated network data are automatically and permanently deleted after 24 hours.
              </Typography>
            </Box>
          </Box>

          {/* Modal Explanation Overlay */}
          {showExplanation && (
            <Box sx={{
              position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.8)', zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, backdropFilter: 'blur(4px)'
            }}>
              <Box sx={{
                bgcolor: '#0f172a', p: 4, borderRadius: 2, maxWidth: 400, width: '100%',
                border: '1px solid rgba(56,189,248,0.3)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
              }}>
                <Typography variant="h5" sx={{ color: '#38bdf8', mb: 2, fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>
                  How it works
                </Typography>
                <Box component="ul" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.95rem', lineHeight: 1.6, pl: 2.5, m: 0, mb: 4, fontFamily: "'Outfit', sans-serif" }}>
                  <Box component="li" sx={{ mb: 1.5 }}><strong>Auto-Setup:</strong> The script fetches temporary credentials from this server.</Box>
                  <Box component="li" sx={{ mb: 1.5 }}><strong>Isolation:</strong> It pulls the open-source NetLink Node Docker image and runs it safely isolated on your machine.</Box>
                  <Box component="li" sx={{ mb: 0 }}><strong>Self-Destruct:</strong> After exactly 24 hours, the node will automatically delete itself and your temporary account is wiped.</Box>
                </Box>
                <Button
                  onClick={() => setShowExplanation(false)}
                  fullWidth variant="outlined"
                  sx={{
                    color: '#fff', borderColor: 'rgba(255,255,255,0.2)', py: 1.5,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', borderColor: '#fff' }
                  }}
                >
                  Close
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      ) : (
        <Desktop token={token} onLogout={handleLogout} target={target} setTarget={setTarget} allowedTargets={allowedTargets} />
      )}
    </ThemeProvider>
  );
}

export default App;
