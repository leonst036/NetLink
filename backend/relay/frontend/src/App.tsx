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
import GeminiLoader from './components/GeminiLoader';
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, target: urlTarget ? urlTarget.trim() : undefined }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');

      // If user specified a target but it's not in their allowed targets, clear it
      let activeTarget = target.trim();
      if (activeTarget && data.targets && !data.targets.includes(activeTarget)) {
        activeTarget = '';
      }
      
      // If no active target is set, pick the first allowed one
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
              NetLink Demo<br />
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.2rem', lineHeight: 1.6, fontFamily: "'Outfit', sans-serif" }}>
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
        <Box sx={{
          flex: { xs: 1, md: '0 0 520px', lg: '0 0 600px' },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          p: { xs: 4, sm: 8, md: 10 },
          bgcolor: '#000',
          position: 'relative',
          zIndex: 1,
          borderLeft: { md: '1px solid rgba(255,255,255,0.08)' },
          overflowY: 'auto'
        }}>
          <Box sx={{ maxWidth: 400, width: '100%', mx: 'auto' }}>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 600, mb: 1, fontFamily: "'Outfit', sans-serif", letterSpacing: '-1px' }}>
              Connect
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.4)', mb: 6, fontFamily: "'Outfit', sans-serif" }}>
              2. Login to manage your machine
            </Typography>

            {loginError && (
              <Alert severity="error" sx={{ mb: 4, bgcolor: 'transparent', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', borderRadius: 0 }}>
                {loginError}
              </Alert>
            )}

            <Box component="form" onSubmit={handleLogin} sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <TextField
                label="Demo Username"
                placeholder="demo_xxxxxxx"
                variant="standard"
                fullWidth
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                sx={textFieldSx}
              />

              <TextField
                label="Demo Password"
                placeholder="Enter generated password"
                type="password"
                variant="standard"
                fullWidth
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                sx={textFieldSx}
              />

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
                  <GeminiLoader size={48} />
                </Box>
              ) : (
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disableElevation
                  disabled={loading}
                  sx={{
                    mt: 3, py: 2,
                    borderRadius: '24px',
                    bgcolor: '#38bdf8',
                    color: '#0f172a',
                    fontWeight: 600,
                    fontSize: '1rem',
                    textTransform: 'none',
                    fontFamily: "'Outfit', sans-serif",
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      bgcolor: '#7dd3fc',
                      transform: 'translateY(-2px) scale(1.02)',
                      boxShadow: '0 8px 20px rgba(56,189,248,0.3)'
                    },
                    '&:disabled': {
                      bgcolor: 'rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.3)'
                    }
                  }}
                >
                  Connect to Node
                </Button>
              )}
            </Box>

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
    );
  }

  return <Desktop token={token} onLogout={handleLogout} target={target} setTarget={setTarget} allowedTargets={allowedTargets} />;
}

export default App;
