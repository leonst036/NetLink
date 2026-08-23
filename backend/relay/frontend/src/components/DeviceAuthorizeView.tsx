import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Chip,
  Paper
} from '@mui/material';
import {
  Laptop,
  CheckCircle,
  XCircle,
  Clock,
  Key,
  ShieldCheck,
  Server,
  ArrowRight,
  LogOut
} from 'lucide-react';
import GeminiLoader from './GeminiLoader';
import { DevicePasswordDialog } from './DevicePasswordDialog';

interface DeviceAuthorizeViewProps {
  token: string | null;
  onLogin: (token: string, targets: string[]) => void;
  onLogout: () => void;
}

interface SessionData {
  device_code: string;
  user_code: string;
  device_name: string;
  client_type: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  expires_in: number;
  available_targets: string[];
  online_targets: string[];
}

export const DeviceAuthorizeView: React.FC<DeviceAuthorizeViewProps> = ({
  token,
  onLogin,
  onLogout,
}) => {
  const [code, setCode] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('code') || '';
  });

  const [session, setSession] = useState<SessionData | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [actionResult, setActionResult] = useState<'approved' | 'denied' | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const fetchSession = useCallback(async (codeToFetch: string) => {
    if (!codeToFetch.trim()) return;
    if (!token) return;

    setLoadingSession(true);
    setSessionError(null);

    try {
      const res = await fetch(`/api/auth/device/session?code=${encodeURIComponent(codeToFetch.trim())}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load device session');
      }

      setSession(data);
      setTimeLeft(data.expires_in);

      if (data.available_targets && data.available_targets.length > 0) {
        // Default to first online target or first target
        const onlineFirst = data.available_targets.find((t: string) => data.online_targets?.includes(t));
        setSelectedTarget(onlineFirst || data.available_targets[0]);
      } else {
        setSelectedTarget('local-server');
      }
    } catch (err: any) {
      setSessionError(err.message || 'Session not found or expired');
      setSession(null);
    } finally {
      setLoadingSession(false);
    }
  }, [token]);

  useEffect(() => {
    if (code && token) {
      fetchSession(code);
    }
  }, [code, token, fetchSession]);
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || actionResult) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, actionResult]);

  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) return;

    setLoginLoading(true);
    setLoginError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');

      onLogin(data.token, data.targets || []);
    } catch (err: any) {
      setLoginError(err.message || 'Invalid credentials');
    } finally {
      setLoginLoading(false);
    }
  };

    const handleDecision = async (decision: 'approve' | 'deny') => {
    if (!session || !token) return;

    if (decision === 'approve') {
      setConfirmPassword('');
      setPasswordError(null);
      setIsPasswordModalOpen(true);
      return;
    }

    setSubmitting(true);
    setSessionError(null);

    try {
      const res = await fetch('/api/auth/device/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_code: session.user_code,
          target_id: selectedTarget || 'local-server',
          decision: 'deny'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to deny device');
      }

      setActionResult('denied');
    } catch (err: any) {
      setSessionError(err.message || 'Failed to deny request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveWithPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!session || !token) return;

    if (!confirmPassword.trim()) {
      setPasswordError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    setPasswordError(null);

    try {
      const res = await fetch('/api/auth/device/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_code: session.user_code,
          target_id: selectedTarget || 'local-server',
          decision: 'approve',
          password: confirmPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authorize device');
      }

      setIsPasswordModalOpen(false);
      setActionResult('approved');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to authorize request');
    } finally {
      setSubmitting(false);
    }
  };

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top, #09132b 0%, #020617 70%, #000000 100%)',
      color: '#fff',
      padding: { xs: 2, sm: 4 },
      fontFamily: '"Outfit", sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <Box sx={{
        position: 'absolute',
        top: '-10%',
        left: '20%',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(0,0,0,0) 70%)',
        pointerEvents: 'none',
        filter: 'blur(40px)'
      }} />
      <Box sx={{
        position: 'absolute',
        bottom: '-10%',
        right: '20%',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(147, 51, 234, 0.12) 0%, rgba(0,0,0,0) 70%)',
        pointerEvents: 'none',
        filter: 'blur(40px)'
      }} />

      <Paper elevation={24} sx={{
        width: '100%',
        maxWidth: 520,
        borderRadius: 4,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.1)',
        padding: { xs: 3, sm: 5 },
        position: 'relative',
        zIndex: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(56, 189, 248, 0.4)'
            }}>
              <ShieldCheck size={20} color="#fff" />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
              NetLink
            </Typography>
          </Box>

          {token && (
            <Button
              size="small"
              onClick={onLogout}
              startIcon={<LogOut size={14} />}
              sx={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: '0.8rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                '&:hover': { color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }
              }}
            >
              Sign out
            </Button>
          )}
        </Box>
        {!token ? (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1, color: '#fff' }}>
              Device Authorization
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 3 }}>
              Sign in to your NetLink account to link and authorize this device.
            </Typography>

            {loginError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {loginError}
              </Alert>
            )}

            <form onSubmit={handleInlineLogin}>
              <TextField
                label="Username"
                variant="outlined"
                fullWidth
                required
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                sx={{ mb: 2.5 }}
                disabled={loginLoading}
              />
              <TextField
                label="Password"
                type="password"
                variant="outlined"
                fullWidth
                required
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                sx={{ mb: 3 }}
                disabled={loginLoading}
              />

              {loginLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <GeminiLoader size={40} />
                </Box>
              ) : (
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  sx={{
                    py: 1.5,
                    background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '1rem',
                    boxShadow: '0 4px 15px rgba(56, 189, 248, 0.3)'
                  }}
                >
                  Sign in & Continue
                </Button>
              )}
            </form>
          </Box>
        ) : actionResult === 'approved' ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Box sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)',
              border: '2px solid #22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
              boxShadow: '0 0 25px rgba(34, 197, 94, 0.3)'
            }}>
              <CheckCircle size={40} color="#22c55e" />
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#fff' }}>
              Device Authorized!
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 4, px: 2 }}>
              <strong>{session?.device_name || 'Your device'}</strong> is now connected and linked with target server <strong>{selectedTarget}</strong>. You can safely return to your NetConnect desktop app.
            </Typography>

            <Button
              variant="contained"
              fullWidth
              onClick={() => { window.location.href = '/'; }}
              sx={{
                py: 1.5,
                background: '#fff',
                color: '#000',
                fontWeight: 600,
                '&:hover': { background: 'rgba(255,255,255,0.9)' }
              }}
            >
              Open NetLink Dashboard
            </Button>
          </Box>
        ) : actionResult === 'denied' ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Box sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '2px solid #ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
              boxShadow: '0 0 25px rgba(239, 68, 68, 0.3)'
            }}>
              <XCircle size={40} color="#ef4444" />
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#fff' }}>
              Access Denied
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 4 }}>
              The authorization request for this device was rejected.
            </Typography>

            <Button
              variant="outlined"
              fullWidth
              onClick={() => { window.location.href = '/'; }}
              sx={{ py: 1.5, borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
            >
              Return to NetLink
            </Button>
          </Box>
        ) : !session ? (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1, color: '#fff' }}>
              Link New Device
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 3 }}>
              Enter the verification code displayed on your NetConnect desktop client.
            </Typography>

            {sessionError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {sessionError}
              </Alert>
            )}

            <TextField
              label="User Code"
              placeholder="NET-XXXX"
              variant="outlined"
              fullWidth
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              sx={{
                mb: 3,
                '& input': {
                  fontSize: '1.4rem',
                  letterSpacing: '3px',
                  fontWeight: 700,
                  textAlign: 'center',
                  fontFamily: 'monospace'
                }
              }}
            />

            <Button
              variant="contained"
              fullWidth
              disabled={!code.trim() || loadingSession}
              onClick={() => fetchSession(code)}
              sx={{
                py: 1.5,
                background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)',
                color: '#fff',
                fontWeight: 600
              }}
            >
              {loadingSession ? <CircularProgress size={24} color="inherit" /> : 'Find Request'}
            </Button>
          </Box>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#fff' }}>
                Device Request
              </Typography>
              {timeLeft !== null && (
                <Chip
                  icon={<Clock size={14} color={timeLeft < 60 ? '#f87171' : '#38bdf8'} />}
                  label={`Expires in ${formatSeconds(timeLeft)}`}
                  size="small"
                  sx={{
                    background: timeLeft < 60 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                    color: timeLeft < 60 ? '#f87171' : '#38bdf8',
                    border: `1px solid ${timeLeft < 60 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
                    fontWeight: 600
                  }}
                />
              )}
            </Box>

            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 3 }}>
              An external desktop app is requesting access to connect through your NetLink gateway.
            </Typography>

            {sessionError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {sessionError}
              </Alert>
            )}
            <Box sx={{
              p: 2.5,
              borderRadius: 3,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              mb: 3
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                <Box sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '12px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Laptop size={22} color="#38bdf8" />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>
                    {session.device_name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                    Type: {session.client_type}
                  </Typography>
                </Box>
                <Chip
                  icon={<Key size={12} color="#fff" />}
                  label={session.user_code}
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff'
                  }}
                />
              </Box>
            </Box>
            <Box sx={{ mb: 4 }}>
              <Typography variant="caption" sx={{
                color: 'rgba(255,255,255,0.7)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'block',
                mb: 1
              }}>
                Target Server / Network
              </Typography>
              <FormControl fullWidth size="medium">
                <InputLabel id="target-select-label" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  Authorize for Target Server
                </InputLabel>
                <Select
                  labelId="target-select-label"
                  value={selectedTarget}
                  label="Authorize for Target Server"
                  onChange={e => setSelectedTarget(e.target.value)}
                  sx={{
                    color: '#fff',
                    '.MuiSvgIcon-root': { color: '#fff' }
                  }}
                >
                  {session.available_targets.map(target => {
                    const isOnline = session.online_targets?.includes(target);
                    return (
                      <MenuItem key={target} value={target}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Server size={16} color="#38bdf8" />
                            <span>{target}</span>
                          </Box>
                          <Chip
                            label={isOnline ? 'Online' : 'Registered'}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              background: isOnline ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                              color: isOnline ? '#86efac' : 'rgba(255,255,255,0.6)'
                            }}
                          />
                        </Box>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                fullWidth
                disabled={submitting}
                onClick={() => handleDecision('deny')}
                startIcon={<XCircle size={18} />}
                sx={{
                  py: 1.5,
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  fontWeight: 600,
                  '&:hover': {
                    borderColor: '#ef4444',
                    background: 'rgba(239, 68, 68, 0.1)'
                  }
                }}
              >
                Deny
              </Button>

              <Button
                variant="contained"
                fullWidth
                disabled={submitting || (timeLeft !== null && timeLeft <= 0)}
                onClick={() => handleDecision('approve')}
                startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <ArrowRight size={18} />}
                sx={{
                  py: 1.5,
                  background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)',
                  color: '#fff',
                  fontWeight: 600,
                  boxShadow: '0 4px 15px rgba(56, 189, 248, 0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #1d4ed8 100%)'
                  }
                }}
              >
                Authorize
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
      
      <DevicePasswordDialog
        open={isPasswordModalOpen}
        deviceName={session?.device_name}
        password={confirmPassword}
        passwordError={passwordError}
        submitting={submitting}
        onPasswordChange={setConfirmPassword}
        onClose={() => setIsPasswordModalOpen(false)}
        onSubmit={handleApproveWithPassword}
      />
    </Box>
  );
};