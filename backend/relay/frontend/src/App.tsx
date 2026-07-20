import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CssBaseline
} from '@mui/material';
import Desktop from './Desktop';
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

  if (!token) {
    const textFieldSx = {
      '& .MuiInput-underline:before': {
        borderBottomColor: 'rgba(255, 255, 255, 0.2)',
      },
      '& .MuiInput-underline:hover:not(.Mui-disabled):before': {
        borderBottomColor: 'rgba(255, 255, 255, 0.5)',
      },
      '& .MuiInput-underline:after': {
        borderBottomColor: '#fff',
      },
      '& .MuiInputLabel-root': {
        color: 'rgba(255, 255, 255, 0.5)',
        fontFamily: "'Outfit', sans-serif",
        fontSize: '0.95rem',
        '&.Mui-focused': { color: '#fff' }
      },
      '& .MuiInputBase-input': {
        color: '#fff',
        fontFamily: "'Outfit', sans-serif",
        paddingBottom: '12px',
        fontSize: '1.1rem'
      }
    };

    return (
      <Box sx={{ display: 'flex', width: '100vw', minHeight: '100vh', bgcolor: '#000' }}>
        <CssBaseline />

        {/* Left Side: Brand & Visuals (Hidden on mobile) */}
        <Box sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1,
          position: 'relative',
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 8,
          '&::before': {
            content: '""',
            position: 'absolute', inset: 0,
            background: 'url(/login-bg.png) center/cover no-repeat',
            opacity: 0.7,
            zIndex: 0,
            filter: 'contrast(1.1) brightness(0.9)'
          },
          '&::after': {
            content: '""',
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, rgba(0,0,0,0.1) 0%, #000 100%)',
            zIndex: 0
          }
        }}>
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography variant="h6" sx={{
              fontWeight: 700, color: '#fff', letterSpacing: '2px',
              display: 'flex', alignItems: 'center', gap: 1.5,
              textTransform: 'uppercase', fontFamily: "'Outfit', sans-serif"
            }}>
              <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#fff', boxShadow: '0 0 15px 2px rgba(255,255,255,0.8)' }} />
              NetLink Login
            </Typography>
          </Box>
          <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 600 }}>
            <Typography variant="h2" sx={{ fontWeight: 600, color: '#fff', mb: 3, letterSpacing: '-2px', lineHeight: 1.1, fontFamily: "'Outfit', sans-serif" }}>
              NetLink <br />
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.2rem', lineHeight: 1.6, fontFamily: "'Outfit', sans-serif" }}>
              Connect to your home network from everywhere, without VPN.
            </Typography>
          </Box>
        </Box>

        {/* Right Side: Clean Login Form */}
        <Box sx={{
          flex: { xs: 1, md: '0 0 520px', lg: '0 0 600px' },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          p: { xs: 4, sm: 8, md: 10 },
          bgcolor: '#000',
          position: 'relative',
          zIndex: 1,
          borderLeft: { md: '1px solid rgba(255,255,255,0.08)' }
        }}>
          <Box sx={{ maxWidth: 400, width: '100%', mx: 'auto' }}>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 600, mb: 1, fontFamily: "'Outfit', sans-serif", letterSpacing: '-1px' }}>
              Welcome back
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.4)', mb: 6, fontFamily: "'Outfit', sans-serif" }}>
              Enter your credentials to access your environment.
            </Typography>

            {loginError && (
              <Alert severity="error" sx={{ mb: 4, bgcolor: 'transparent', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', borderRadius: 0 }}>
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

            <Box component="form" onSubmit={handleLogin} sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <TextField
                label="Username"
                variant="standard"
                fullWidth
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                sx={textFieldSx}
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
                label="Password"
                type="password"
                variant="standard"
                fullWidth
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                sx={textFieldSx}
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disableElevation
                disabled={loading}
                sx={{
                  mt: 3, py: 2,
                  borderRadius: 0,
                  bgcolor: '#fff',
                  color: '#000',
                  fontWeight: 600,
                  fontSize: '1rem',
                  textTransform: 'none',
                  fontFamily: "'Outfit', sans-serif",
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.85)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 10px 20px -10px rgba(255,255,255,0.3)'
                  },
                  '&:disabled': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.3)'
                  }
                }}
              >
                {loading ? 'Authenticating...' : 'Sign in'}
              </Button>
            </Box>

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
    );
  }

  return <Desktop token={token} onLogout={handleLogout} target={target} setTarget={setTarget} allowedTargets={allowedTargets} />;
}

export default App;
