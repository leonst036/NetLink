import React, { useState, useEffect } from 'react';

function LoginPanel({ credentials, setCredentials, connecting, error, handleConnect }: any) {
    return (
        <div className="dm-layout">
            <div className="nl-panel dm-login-card">
                <div className="dm-login-header">
                    <div className="dm-login-icon">
                        <img src="/apps/docker-manager/frontend/docker.svg" alt="Docker" width="28" height="28" />
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

function DashboardHeader({ credentials, refreshContainers, setConnected }: any) {
    return (
        <div className="dm-header">
            <div className="dm-header-info">
                <h2>Docker Engine</h2>
                <div className="dm-status-indicator">
                    <span className="dm-dot" />
                    {credentials.username}@{credentials.host}
                </div>
            </div>
            
            <div className="dm-actions">
                <button className="nl-button secondary" onClick={refreshContainers}>
                    Refresh
                </button>
                <button className="nl-button danger" onClick={() => setConnected(false)}>
                    Disconnect
                </button>
            </div>
        </div>
    );
}

function ContainerCard({ container, handleAction }: any) {
    const isRunning = container.State === 'running';
    
    return (
        <div className="nl-panel dm-card">
            <div className="dm-card-header">
                <h3 className="dm-card-title">{container.Names}</h3>
                <span className={`dm-badge ${isRunning ? 'running' : 'stopped'}`}>
                    {container.State}
                </span>
            </div>
            
            <div className="dm-card-details">
                <div className="dm-detail-row">
                    <span className="dm-detail-label">Image</span>
                    <span className="dm-detail-value">{container.Image}</span>
                </div>
                <div className="dm-detail-row">
                    <span className="dm-detail-label">Status</span>
                    <span className="dm-detail-value">{container.Status}</span>
                </div>
                <div className="dm-detail-row">
                    <span className="dm-detail-label">Ports</span>
                    <span className="dm-detail-value">{container.Ports || 'None'}</span>
                </div>
            </div>
            
            <div className="dm-card-actions">
                {isRunning ? (
                    <button className="nl-button danger" onClick={() => handleAction('stop', container.ID)}>
                        Stop
                    </button>
                ) : (
                    <button className="nl-button success" onClick={() => handleAction('start', container.ID)}>
                        Start
                    </button>
                )}
                <button className="nl-button secondary" onClick={() => handleAction('restart', container.ID)}>
                    Restart
                </button>
            </div>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="nl-panel dm-empty">
            <img src="/apps/docker-manager/frontend/empty.svg" alt="Empty" width="48" height="48" />
            <h3>No Containers Found</h3>
            <p>No active or stopped Docker containers on this host.</p>
        </div>
    );
}

export default function DockerManager() {
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [credentials, setCredentials] = useState({ host: '', port: '22', username: '', password: '' });
    const [containers, setContainers] = useState<any[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "/apps/docker-manager/frontend/styles.css";
        document.head.appendChild(link);
        return () => {
            document.head.removeChild(link);
        };
    }, []);

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
        return data;
    };

    const parseContainersOutput = (stdout: string): any[] => {
        if (!stdout || !stdout.trim()) return [];
        const containers: any[] = [];
        const lines = stdout.split('\n');
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            const firstBrace = line.indexOf('{');
            const lastBrace = line.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                const jsonCandidate = line.substring(firstBrace, lastBrace + 1);
                try {
                    const parsed = JSON.parse(jsonCandidate);
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        containers.push(parsed);
                    }
                } catch (err) {
                    console.warn('Failed to parse container JSON line:', line, err);
                }
            }
        }
        return containers;
    };

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setConnecting(true);
        setError('');
        
        try {
            const result = await executeCommand("docker ps -a --format '{{json .}}'");
            if (result.code !== 0) throw new Error(`Failed code ${result.code}: ${result.stderr}`);
            
            const parsedContainers = parseContainersOutput(result.stdout || '');
                
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
            const result = await executeCommand("docker ps -a --format '{{json .}}'");
            if (result.code === 0) {
                const parsedContainers = parseContainersOutput(result.stdout || '');
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
            <LoginPanel 
                credentials={credentials} 
                setCredentials={setCredentials} 
                connecting={connecting} 
                error={error} 
                handleConnect={handleConnect} 
            />
        );
    }

    return (
        <div className="dm-dashboard">
            <DashboardHeader 
                credentials={credentials} 
                refreshContainers={refreshContainers} 
                setConnected={setConnected} 
            />
            
            <div className="dm-content">
                <div className="dm-grid">
                    {containers.map(container => (
                        <ContainerCard 
                            key={container.ID} 
                            container={container} 
                            handleAction={handleAction} 
                        />
                    ))}
                    {containers.length === 0 && <EmptyState />}
                </div>
            </div>
        </div>
    );
}
