import { useState } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  TextField, 
  Button, 
  Alert, 
  Link,
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState('');

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
    setRegisterSuccess('');

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

  const handleLogout = () => {
    localStorage.removeItem('netlink_token');
    localStorage.removeItem('netlink_target');
    localStorage.removeItem('netlink_allowed_targets');
    setToken(null);
    setUsername('');
    setEmail('');
    setPassword('');
    setAllowedTargets([]);
  };

  if (!token) {
    return (
      <Box sx={{ 
        display: 'flex', width: '100vw', minHeight: '100vh', 
        justifyContent: 'center', alignItems: 'center', position: 'relative' 
      }}>
        <CssBaseline />
        <div className="bg-glow"></div>
        <div className="bg-glow-2"></div>
        
        <Card elevation={12} sx={{ 
          maxWidth: 440, width: '100%', borderRadius: 4, p: 2,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <CardContent>
            <Typography variant="h4" component="h1" align="center" gutterBottom sx={{
              fontWeight: 700, 
              background: 'linear-gradient(to right, #60a5fa, #818cf8, #c084fc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              NetLink
            </Typography>
            <Typography variant="subtitle1" align="center" color="text.secondary" sx={{ mb: 4 }}>
              Secure OS Environment
            </Typography>

            {loginError && <Alert severity="error" sx={{ mb: 3 }}>{loginError}</Alert>}
            {registerSuccess && <Alert severity="success" sx={{ mb: 3 }}>{registerSuccess}</Alert>}

            <Box component="form" onSubmit={isRegistering ? handleRegister : handleLogin}>
              <TextField
                label="Username"
                variant="outlined"
                fullWidth
                required
                margin="normal"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />

              {isRegistering && (
                <TextField
                  label="Email"
                  type="email"
                  variant="outlined"
                  fullWidth
                  required
                  margin="normal"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              )}

              <TextField
                label="Password"
                type="password"
                variant="outlined"
                fullWidth
                required
                margin="normal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />

              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={loading}
                sx={{ mt: 3, mb: 2, py: 1.5, borderRadius: 2 }}
              >
                {loading ? (isRegistering ? 'Registering...' : 'Authenticating...') : (isRegistering ? 'Register' : 'Sign In')}
              </Button>

              <Typography align="center" variant="body2" color="text.secondary">
                {isRegistering ? 'Already have an account? ' : 'Need an account? '}
                <Link
                  component="button"
                  type="button"
                  variant="body2"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setLoginError('');
                    setRegisterSuccess('');
                  }}
                  sx={{ cursor: 'pointer' }}
                >
                  {isRegistering ? 'Log in' : 'Register'}
                </Link>
              </Typography>
            </Box>

            {isRegistering && (
              <Box sx={{ mt: 4, p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Connect Local Server via Docker
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Run this command on your server to download and execute the NetLink setup script:
                </Typography>
                <Box component="code" sx={{ 
                  bgcolor: 'rgba(0,0,0,0.4)', p: 1, borderRadius: 1, 
                  display: 'block', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.85rem' 
                }}>
                  curl -ks {window.location.origin}/api/install.sh | bash
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    );
  }

  return <Desktop token={token} onLogout={handleLogout} target={target} setTarget={setTarget} allowedTargets={allowedTargets} />;
}

export default App;
