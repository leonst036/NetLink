import { useState } from 'react';
import Desktop from './Desktop';
import './App.css'; // ensure global styles remain intact if needed

function App() {
  // Authentication State
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
    return urlParams.get('target') || ''; // Default to empty so we can pick from saved
  });

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setLoginError('');
    setRegisterSuccess('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, target: target.trim() || undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // If user didn't specify a target but has saved ones, pick the first
      let activeTarget = target.trim();
      if (!activeTarget && data.targets && data.targets.length > 0) {
        activeTarget = data.targets[0];
        setTarget(activeTarget);
      }

      localStorage.setItem('netlink_token', data.token);
      setToken(data.token);
    } catch (err: any) {
      setLoginError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Handle Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password) return;

    setLoading(true);
    setLoginError('');
    setRegisterSuccess('');

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

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
    setToken(null);
    setUsername('');
    setEmail('');
    setPassword('');
  };

  // Render Login Page if not authenticated
  if (!token) {
    return (
      <div style={{ display: 'flex', width: '100vw', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        <div className="bg-glow"></div>
        <div className="bg-glow-2"></div>
        <div className="glass-card">
          <h1 className="logo-title">NetLink</h1>
          <p className="subtitle">Secure OS Environment</p>

          {loginError && <div className="alert-error" style={{ color: '#ff4d4f', background: 'rgba(255,77,79,0.1)', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>{loginError}</div>}
          {registerSuccess && <div className="alert-success" style={{ color: '#52c41a', background: 'rgba(82,196,26,0.1)', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>{registerSuccess}</div>}

          <form onSubmit={isRegistering ? handleRegister : handleLogin}>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label className="form-label" htmlFor="username" style={{ display: 'block', marginBottom: '5px', color: '#eee' }}>Username</label>
              <input
                className="form-input"
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                disabled={loading}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>

            {isRegistering && (
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label className="form-label" htmlFor="email" style={{ display: 'block', marginBottom: '5px', color: '#eee' }}>Email</label>
                <input
                  className="form-input"
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  required={isRegistering}
                  disabled={loading}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label className="form-label" htmlFor="password" style={{ display: 'block', marginBottom: '5px', color: '#eee' }}>Password</label>
              <input
                className="form-input"
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                disabled={loading}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>

            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '10px', borderRadius: '4px', background: '#177ddc', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
              {loading ? (isRegistering ? 'Registering...' : 'Authenticating...') : (isRegistering ? 'Register' : 'Sign In')}
            </button>

            <div style={{ marginTop: '15px', textAlign: 'center', fontSize: '0.9rem' }}>
              <span style={{ color: '#aaa' }}>{isRegistering ? 'Already have an account? ' : 'Need an account? '}</span>
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setLoginError('');
                  setRegisterSuccess('');
                }}
                style={{ background: 'none', border: 'none', color: '#177ddc', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                {isRegistering ? 'Log in' : 'Register'}
              </button>
            </div>
          </form>

          {isRegistering && (
            <div className="docker-instructions" style={{ marginTop: '30px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.85rem', color: '#ddd' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#fff' }}>Connect Local Server via Docker</h4>
              <p style={{ margin: '0 0 10px 0', lineHeight: '1.4' }}>Run this command on your server to download and execute the NetLink setup script:</p>
              <code style={{ background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '4px', display: 'block', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                curl -ks {window.location.origin}/api/install.sh | bash
              </code>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render Desktop Environment
  return <Desktop token={token} onLogout={handleLogout} target={target} />;
}

export default App;
