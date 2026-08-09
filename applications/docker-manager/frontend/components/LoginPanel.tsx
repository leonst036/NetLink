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
                        <img src="/apps/docker-manager/frontend/assets/docker.svg" alt="Docker" width="36" height="36" />
                    </div>
                    <h2 style={{ margin: '0 0 6px 0', fontFamily: 'var(--dm-font-heading)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--dm-text-heading)' }}>
                        Docker Engine Manager
                    </h2>
                    <p style={{ margin: 0, color: 'var(--dm-text-muted)', fontSize: '0.88rem' }}>
                        Secure SSH connection to your Docker daemon
                    </p>
                </div>

                {error && (
                    <div style={{ padding: '12px 16px', background: 'rgba(244,63,94,0.12)', border: '1px solid var(--dm-rose)', borderRadius: '10px', color: 'var(--dm-rose)', fontSize: '0.85rem', marginBottom: '20px' }}>
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleConnect}>
                    <div className="dm-form-row">
                        <div className="dm-form-group">
                            <label>Host / IP Address</label>
                            <input 
                                className="dm-input dm-input-bare"
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
                                className="dm-input dm-input-bare"
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
                            className="dm-input dm-input-bare"
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
                                className="dm-copy-btn"
                                style={{ fontSize: '0.75rem', color: 'var(--dm-cyan)' }}
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        <input 
                            className="dm-input dm-input-bare"
                            type={showPassword ? "text" : "password"} 
                            placeholder="••••••••"
                            value={credentials.password}
                            onChange={e => setCredentials({ ...credentials, password: e.target.value })}
                            required
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 20px', fontSize: '0.82rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--dm-text-muted)', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={remember}
                                onChange={e => setRemember(e.target.checked)}
                            />
                            Save credentials locally
                        </label>
                        <button type="button" className="dm-copy-btn" style={{ color: 'var(--dm-cyan)' }} onClick={handleQuickLocalhost}>
                            ⚡ Fill 127.0.0.1
                        </button>
                    </div>
                    
                    <button type="submit" className="dm-btn dm-btn-primary" disabled={connecting} style={{ width: '100%', height: '44px', fontSize: '0.95rem' }}>
                        {connecting ? 'Connecting...' : 'Connect to Docker Engine'}
                    </button>
                </form>
            </div>
        </div>
    );
}
