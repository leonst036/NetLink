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
  // const [isRegistering, setIsRegistering] = useState(false);
  // const [registerSuccess, setRegisterSuccess] = useState('');

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
    // setRegisterSuccess('');

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

  /*
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password) return;

    setLoading(true);
    setLoginError('');
    setRegisterSuccess('');

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');

      setRegisterSuccess('Registration successful! You can now log in.');
      setIsRegistering(false);
    } catch (err: any) {
      setLoginError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };
  */

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
              NetLink <br />
            </Typography>
            <Typography className="left-subtitle" variant="body1">
              Connect to your home network from everywhere, without VPN.
            </Typography>
          </Box>
        </Box>

        {/* Right Side: Clean Login Form */}
        <Box className="right-panel">
          <Box className="form-wrapper">
            <Typography className="form-title" variant="h4">
              Welcome back
            </Typography>
            <Typography className="form-subtitle" variant="body1">
              Enter your credentials to access your environment.
            </Typography>

            {loginError && (
              <Alert className="styled-alert" severity="error">
                {loginError}
              </Alert>
            )}

            {/*
            {registerSuccess && (
              <Alert severity="success" sx={{ mb: 4, bgcolor: 'transparent', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#86efac', borderRadius: 0 }}>
                {registerSuccess}
              </Alert>
            )}
            */}

            <form className="form-container" onSubmit={handleLogin}>
              <TextField
                className="styled-text-field"
                label="Username"
                variant="standard"
                fullWidth
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />

              {/*
              {isRegistering && (
                <TextField
                  label="Email"
                  type="email"
                  variant="standard"
                  fullWidth
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  sx={textFieldSx}
                />
              )}
              */}

              <TextField
                className="styled-text-field"
                label="Password"
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
                  Sign in
                </Button>
              )}
            </form>

            {/*
            <Typography variant="body2" sx={{ mt: 6, color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontFamily: "'Outfit', sans-serif" }}>
              {isRegistering ? 'Already have an account?' : "Don't have an account?"}
              <Link
                component="button"
                onClick={() => { setIsRegistering(!isRegistering); setLoginError(''); setRegisterSuccess(''); }}
                sx={{
                  ml: 1, color: '#fff', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.3)',
                  transition: 'border-color 0.2s', '&:hover': { borderBottom: '1px solid #fff' }
                }}
              >
                {isRegistering ? 'Sign in' : 'Sign up'}
              </Link>
            </Typography>
            */}

            {/*
            {isRegistering && (
              <Box sx={{ mt: 6, pt: 4, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', mb: 2, fontFamily: "'Outfit', sans-serif" }}>
                  Deploy Node
                </Typography>
                <Box component="code" sx={{
                  bgcolor: 'rgba(255,255,255,0.03)', p: 2, borderRadius: 0, border: '1px solid rgba(255,255,255,0.1)',
                  display: 'block', wordBreak: 'break-all', fontFamily: "'Fira Code', monospace", fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)'
                }}>
                  curl -ks {window.location.origin}/api/install.sh | bash
                </Box>
              </Box>
            )}
            */}
          </Box>
        </Box>
      </Box>
      ) : (
        <Desktop token={token} onLogout={handleLogout} target={target} setTarget={setTarget} allowedTargets={allowedTargets} />
      )}
    </ThemeProvider>
  );
}

export default App;
