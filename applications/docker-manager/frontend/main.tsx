import React, { useState, useEffect } from 'react';

export default function DockerManager({ token }: { token?: string }) {
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [credentials, setCredentials] = useState({ host: '', port: '22', username: '', password: '' });
    const [containers, setContainers] = useState<any[]>([]);
    const [error, setError] = useState('');

    const executeCommand = async (command: string) => {
        const res = await fetch('/api/docker-manager/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...credentials, command })
        });
        
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Request failed');
        }
        
        const data = await res.json();
        if (data.stderr) {
            console.error('Command stderr:', data.stderr);
        }
        return data;
    };

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setConnecting(true);
        setError('');
        
        try {
            // Test connection and get containers
            const result = await executeCommand(`docker ps -a --format '{{json .}}'`);
            
            if (result.code !== 0) {
                throw new Error(`Command failed with code ${result.code}: ${result.stderr}`);
            }

            const parsedContainers = result.stdout
                .split('\n')
                .filter((line: string) => line.trim() !== '')
                .map((line: string) => JSON.parse(line));
                
            setContainers(parsedContainers);
            setConnected(true);
        } catch (err: any) {
            setError(err.message || 'Failed to connect');
        } finally {
            setConnecting(false);
        }
    };

    const refreshContainers = async () => {
        try {
            const result = await executeCommand(`docker ps -a --format '{{json .}}'`);
            if (result.code === 0) {
                const parsedContainers = result.stdout
                    .split('\n')
                    .filter((line: string) => line.trim() !== '')
                    .map((line: string) => JSON.parse(line));
                setContainers(parsedContainers);
            }
        } catch (err) {
            console.error('Failed to refresh containers', err);
        }
    };

    const handleAction = async (action: 'start' | 'stop' | 'restart', containerId: string) => {
        try {
            await executeCommand(`docker ${action} ${containerId}`);
            await refreshContainers();
        } catch (err: any) {
            alert(`Failed to ${action} container: ${err.message}`);
        }
    };

    if (!connected) {
        return (
            <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', fontFamily: 'Outfit, sans-serif' }}>
                <div className="nl-panel">
                    <h2 style={{ marginBottom: '20px', color: 'var(--text-main)' }}>Connect to Server</h2>
                    {error && <div style={{ color: 'var(--danger)', marginBottom: '15px' }}>{error}</div>}
                    <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-main)' }}>Host</label>
                            <input 
                                type="text" 
                                value={credentials.host}
                                onChange={e => setCredentials({...credentials, host: e.target.value})}
                                required
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-main)' }}>Port</label>
                            <input 
                                type="number" 
                                value={credentials.port}
                                onChange={e => setCredentials({...credentials, port: e.target.value})}
                                required
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-main)' }}>Username</label>
                            <input 
                                type="text" 
                                value={credentials.username}
                                onChange={e => setCredentials({...credentials, username: e.target.value})}
                                required
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-main)' }}>Password</label>
                            <input 
                                type="password" 
                                value={credentials.password}
                                onChange={e => setCredentials({...credentials, password: e.target.value})}
                                required
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', boxSizing: 'border-box' }}
                            />
                        </div>
                        <button type="submit" className="nl-button" disabled={connecting} style={{ marginTop: '10px', width: '100%', padding: '12px' }}>
                            {connecting ? 'Connecting...' : 'Connect via SSH'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', fontFamily: 'Outfit, sans-serif', color: 'var(--text-main)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0 }}>Docker Containers on {credentials.host}</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="nl-button" onClick={refreshContainers} style={{ backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.2)' }}>
                        Refresh
                    </button>
                    <button className="nl-button" onClick={() => setConnected(false)} style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        Disconnect
                    </button>
                </div>
            </div>
            
            <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {containers.map(container => (
                    <div key={container.ID} className="nl-panel" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', wordBreak: 'break-all', fontWeight: 600 }}>{container.Names}</h3>
                            <span style={{ 
                                padding: '4px 10px', 
                                borderRadius: '20px', 
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                letterSpacing: '0.5px',
                                textTransform: 'uppercase',
                                background: container.State === 'running' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: container.State === 'running' ? 'var(--success)' : 'var(--danger)',
                                border: `1px solid ${container.State === 'running' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                            }}>
                                {container.State}
                            </span>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex' }}>
                                <strong style={{ minWidth: '60px', color: 'var(--text-main)' }}>Image:</strong> 
                                <span style={{ wordBreak: 'break-all' }}>{container.Image}</span>
                            </div>
                            <div style={{ display: 'flex' }}>
                                <strong style={{ minWidth: '60px', color: 'var(--text-main)' }}>Status:</strong> 
                                <span>{container.Status}</span>
                            </div>
                            <div style={{ display: 'flex' }}>
                                <strong style={{ minWidth: '60px', color: 'var(--text-main)' }}>Ports:</strong> 
                                <span style={{ wordBreak: 'break-all' }}>{container.Ports || 'None'}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '5px' }}>
                            {container.State !== 'running' && (
                                <button className="nl-button" style={{ flex: 1, backgroundColor: 'var(--success)', fontWeight: 600 }} onClick={() => handleAction('start', container.ID)}>
                                    Start
                                </button>
                            )}
                            {container.State === 'running' && (
                                <button className="nl-button" style={{ flex: 1, backgroundColor: 'var(--danger)', fontWeight: 600 }} onClick={() => handleAction('stop', container.ID)}>
                                    Stop
                                </button>
                            )}
                            <button className="nl-button" style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 600 }} onClick={() => handleAction('restart', container.ID)}>
                                Restart
                            </button>
                        </div>
                    </div>
                ))}
                
                {containers.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        No containers found on this server.
                    </div>
                )}
            </div>
        </div>
    );
}
