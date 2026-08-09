import React, { useState } from 'react';

export default function LoginPanel({ credentials, setCredentials, remember, setRemember, connecting, error, handleConnect }: any) {
    const [showPassword, setShowPassword] = useState(false);

    const handleQuickLocalhost = () => {
        setCredentials((prev: any) => ({
            ...prev,
            host: '127.0.0.1',
            port: '22',
            username: prev.username || 'root'
        }));
    };

    return (
        <div className="dm-layout">
            <div className="dm-login-card">
                <div className="dm-login-header">
                    <div className="dm-login-icon">
                        <img src="/apps/docker-manager/frontend/assets/docker.svg" alt="Docker" width="34" height="34" />
                    </div>
                    <h2>Docker Engine Manager</h2>
                    <p>Secure SSH connection to your Docker daemon</p>
                </div>

                {error && (
                    <div className="dm-error">
                        <span>⚠️</span> {error}
                    </div>
                )}

                <form onSubmit={handleConnect}>
                    <div className="dm-form-row">
                        <div className="dm-form-group">
                            <label>Host / IP Address</label>
                            <input 
                                className="dm-input"
                                type="text" 
                                placeholder="192.168.1.100 or localhost"
                                value={credentials.host}
                                onChange={e => setCredentials({ ...credentials, host: e.target.value })}
                                required
                            />
                        </div>
                        <div className="dm-form-group">
                            <label>SSH Port</label>
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
                        <label>SSH Username</label>
                        <input 
                            className="dm-input"
                            type="text" 
                            placeholder="e.g. root or ubuntu"
                            value={credentials.username}
                            onChange={e => setCredentials({ ...credentials, username: e.target.value })}
                            required
                        />
                    </div>
                    
                    <div className="dm-form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label>SSH Password</label>
                            <button 
                                type="button" 
                                className="dm-text-link"
                                style={{ fontSize: '0.75rem' }}
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        <input 
                            className="dm-input"
                            type={showPassword ? "text" : "password"} 
                            placeholder="••••••••"
                            value={credentials.password}
                            onChange={e => setCredentials({ ...credentials, password: e.target.value })}
                            required
                        />
                    </div>

                    <div className="dm-login-options">
                        <label className="dm-checkbox-label">
                            <input
                                type="checkbox"
                                checked={remember}
                                onChange={e => setRemember(e.target.checked)}
                            />
                            Save credentials locally
                        </label>
                        <button type="button" className="dm-text-link" onClick={handleQuickLocalhost}>
                            ⚡ Fill 127.0.0.1
                        </button>
                    </div>
                    
                    <button type="submit" className="nl-button" disabled={connecting} style={{ width: '100%', marginTop: '14px', height: '44px' }}>
                        {connecting ? 'Connecting...' : 'Connect to Docker Engine'}
                    </button>
                </form>
            </div>
        </div>
    );
}


