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
  const [showExplanation, setShowExplanation] = useState(false);

  const [target, setTarget] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('target') || localStorage.getItem('netlink_target') || ''; // Default to empty so we can pick from saved
  });

  const [allowedTargets, setAllowedTargets] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('netlink_allowed_targets') || '[]');
    } catch {
      return [];
    }
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

  // Render Login Page if not authenticated
  if (!token) {
    return (
      <div style={{ display: 'flex', width: '100vw', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        <div className="bg-glow"></div>
        <div className="bg-glow-2"></div>
        <div className="glass-card" style={{ maxWidth: '500px' }}>
          <h1 className="logo-title">NetLink Demo</h1>
          <p className="subtitle">Zero-Config Self-Destructing Environment</p>

          <div className="docker-instructions" style={{ margin: '20px 0', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.85rem', color: '#ddd', position: 'relative' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#fff' }}>1. Start your temporary node</h4>
            <p style={{ margin: '0 0 10px 0', lineHeight: '1.4' }}>Run this command on any Linux machine with Docker to generate your 24-hour demo credentials:</p>
            <div style={{ position: 'relative' }}>
              <code style={{ background: 'rgba(0,0,0,0.4)', padding: '12px', paddingRight: '40px', borderRadius: '4px', display: 'block', wordBreak: 'break-all', fontFamily: 'monospace', color: '#38bdf8', borderLeft: '4px solid #38bdf8' }}>
                curl -ks {window.location.origin}/api/demo.sh | bash
              </code>
              <button 
                type="button"
                onClick={() => setShowExplanation(true)}
                title="What does this do?"
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', color: '#888', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
              >
                ?
              </button>
            </div>
          </div>

          <h4 style={{ margin: '0 0 15px 0', color: '#fff', textAlign: 'center' }}>2. Login to manage your machine</h4>

          {loginError && <div className="alert-error" style={{ color: '#ff4d4f', background: 'rgba(255,77,79,0.1)', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>{loginError}</div>}

          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label className="form-label" htmlFor="username" style={{ display: 'block', marginBottom: '5px', color: '#eee' }}>Demo Username</label>
              <input
                className="form-input"
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="demo_xxxxxxx"
                required
                disabled={loading}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" htmlFor="password" style={{ display: 'block', marginBottom: '5px', color: '#eee' }}>Demo Password</label>
              <input
                className="form-input"
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter generated password"
                required
                disabled={loading}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>

            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '12px', borderRadius: '4px', background: '#38bdf8', color: '#0f172a', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', transition: 'background 0.2s' }}>
              {loading ? 'Authenticating...' : 'Connect to Node'}
            </button>
          </form>
        </div>

        {showExplanation && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: '#0f172a', padding: '25px', borderRadius: '8px', maxWidth: '400px', width: '100%', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#38bdf8' }}>How it works</h3>
              <ul style={{ color: '#ddd', fontSize: '0.9rem', lineHeight: '1.5', paddingLeft: '20px', margin: '0 0 20px 0' }}>
                <li style={{ marginBottom: '10px' }}><strong>Auto-Setup:</strong> The script fetches temporary credentials from this server.</li>
                <li style={{ marginBottom: '10px' }}><strong>Isolation:</strong> It pulls the open-source NetLink Node Docker image and runs it safely isolated on your machine.</li>
                <li style={{ marginBottom: '10px' }}><strong>Self-Destruct:</strong> After exactly 24 hours, the node will automatically delete itself and your temporary account is wiped.</li>
              </ul>
              <button 
                onClick={() => setShowExplanation(false)}
                style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render Desktop Environment
  return <Desktop token={token} onLogout={handleLogout} target={target} setTarget={setTarget} allowedTargets={allowedTargets} />;
}

export default App;
