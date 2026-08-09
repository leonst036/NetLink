import React from 'react';

export default function LoginPanel({ credentials, setCredentials, connecting, error, handleConnect }: any) {
    return (
        <div className="dm-layout">
            <div className="nl-panel dm-login-card">
                <div className="dm-login-header">
                    <div className="dm-login-icon">
                        <img src="/apps/docker-manager/frontend/assets/docker.svg" alt="Docker" width="28" height="28" />
                    </div>
                    <h2>Docker Manager</h2>
                    <p>SSH Server Login</p>
                </div>

                {error && <div className="dm-error">{error}</div>}

                <form onSubmit={handleConnect}>
                    <div className="dm-form-row">
                        <div className="dm-form-group">
                            <label>Host / IP</label>
                            <input 
                                className="dm-input"
                                type="text" 
                                placeholder="192.168.1.100"
                                value={credentials.host}
                                onChange={e => setCredentials({ ...credentials, host: e.target.value })}
                                required
                            />
                        </div>
                        <div className="dm-form-group">
                            <label>Port</label>
                            <input 
                                className="dm-input"
                                type="number" 
                                value={credentials.port}
                                onChange={e => setCredentials({ ...credentials, port: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                    
                    <div className="dm-form-group">
                        <label>Username</label>
                        <input 
                            className="dm-input"
                            type="text" 
                            placeholder="root"
                            value={credentials.username}
                            onChange={e => setCredentials({ ...credentials, username: e.target.value })}
                            required
                        />
                    </div>
                    
                    <div className="dm-form-group">
                        <label>Password</label>
                        <input 
                            className="dm-input"
                            type="password" 
                            placeholder="••••••••"
                            value={credentials.password}
                            onChange={e => setCredentials({ ...credentials, password: e.target.value })}
                            required
                        />
                    </div>
                    
                    <button type="submit" className="nl-button" disabled={connecting} style={{ width: '100%', marginTop: '8px' }}>
                        {connecting ? 'Connecting...' : 'Connect via SSH'}
                    </button>
                </form>
            </div>
        </div>
    );
}
