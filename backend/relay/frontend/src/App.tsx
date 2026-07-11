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
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  const [target, setTarget] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('target') || 'my-local-server';
  });

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setLoginError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('netlink_token', data.token);
      setToken(data.token);
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

          {loginError && <div className="alert-error">{loginError}</div>}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <input
                className="form-input"
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin username"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                className="form-input"
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="target">Target Node</label>
              <input
                className="form-input"
                id="target"
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Target identifier"
                disabled={loading}
              />
            </div>

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render Desktop Environment
  return <Desktop token={token} onLogout={handleLogout} target={target} />;
}

export default App;
