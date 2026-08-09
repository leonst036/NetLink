import React, { useState, useEffect } from 'react';

// --- Sub-Components ---

function LoginPanel({ credentials, setCredentials, connecting, error, handleConnect }: any) {
    return (
        <div className="dm-wrapper">
            <div className="bg-glow" style={{ animation: 'float 10s ease-in-out infinite' }} />
            <div className="bg-glow-2" style={{ animation: 'float 12s ease-in-out infinite reverse' }} />

            <div className="dm-glass-panel dm-login-panel">
                <div className="dm-login-header">
                    <div className="dm-login-icon">
                        <img src="/apps/docker-manager/frontend/docker.svg" alt="Docker" width="32" height="32" />
                    </div>
                    <h2 className="dm-login-title">Docker Hub</h2>
                    <p className="dm-login-subtitle">Secure SSH connection to your server</p>
                </div>

                {error && (
                    <div className="dm-error-message">
                        {error}
                    </div>
                )}

                <form onSubmit={handleConnect} className="dm-form">
                    <div className="dm-form-row">
                        <div className="dm-flex-2">
                            <label className="dm-label">Host / IP</label>
                            <input 
                                className="dm-input"
                                type="text" 
                                placeholder="192.168.1.100"
                                value={credentials.host}
                                onChange={e => setCredentials({...credentials, host: e.target.value})}
                                required
                            />
                        </div>
                        <div className="dm-flex-1">
                            <label className="dm-label">Port</label>
                            <input 
                                className="dm-input"
                                type="number" 
                                value={credentials.port}
                                onChange={e => setCredentials({...credentials, port: e.target.value})}
                                required
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="dm-label">Username</label>
                        <input 
                            className="dm-input"
                            type="text" 
                            placeholder="root"
                            value={credentials.username}
                            onChange={e => setCredentials({...credentials, username: e.target.value})}
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="dm-label">Password</label>
                        <input 
                            className="dm-input"
                            type="password" 
                            placeholder="••••••••"
                            value={credentials.password}
                            onChange={e => setCredentials({...credentials, password: e.target.value})}
                            required
                        />
                    </div>
                    
                    <button type="submit" className="dm-btn dm-btn-primary dm-mt-3 dm-p-large" disabled={connecting}>
                        {connecting ? (
                            <>
                                <img src="/apps/docker-manager/frontend/spinner.svg" alt="Loading" className="dm-spinner" width="20" height="20" />
                                Establishing Connection...
                            </>
                        ) : 'Connect via SSH'}
                    </button>
                </form>
            </div>
        </div>
    );
}

function DashboardHeader({ credentials, refreshContainers, setConnected }: any) {
    return (
        <div className="dm-header">
            <div>
                <h2 className="dm-header-title">
                    Docker Engine
                </h2>
                <div className="dm-header-status">
                    <div className="dm-status-dot" />
                    Connected to <strong>{credentials.username}@{credentials.host}</strong>
                </div>
            </div>
            
            <div className="dm-header-actions">
                <button className="dm-btn dm-btn-secondary" onClick={refreshContainers}>
                    <img src="/apps/docker-manager/frontend/refresh.svg" alt="Refresh" width="16" height="16" />
                    Refresh
                </button>
                <button className="dm-btn dm-btn-danger" onClick={() => setConnected(false)}>
                    Disconnect
                </button>
            </div>
        </div>
    );
}

function ContainerCard({ container, handleAction, index }: any) {
    const isRunning = container.State === 'running';
    
    return (
        <div className="dm-glass-panel dm-container-card" style={{ animationDelay: \`\${index * 0.05}s\` }}>
            {/* Card Header */}
            <div className="dm-card-header">
                <h3 className={\`dm-card-title \${isRunning ? 'running' : 'stopped'}\`}>
                    {container.Names}
                </h3>
                <span className={\`dm-status-badge \${isRunning ? 'running' : 'stopped'}\`}>
                    {container.State}
                </span>
            </div>
            
            {/* Card Body (Details) */}
            <div className="dm-card-body">
                <div className="dm-card-row">
                    <span className="dm-card-label">Image</span>
                    <span className="dm-card-value">{container.Image}</span>
                </div>
                <div className="dm-divider" />
                <div className="dm-card-row">
                    <span className="dm-card-label">Status</span>
                    <span className="dm-card-value muted">{container.Status}</span>
                </div>
                <div className="dm-divider" />
                <div className="dm-card-row align-top">
                    <span className="dm-card-label">Ports</span>
                    <span className="dm-card-value small">{container.Ports || 'None exposed'}</span>
                </div>
            </div>
            
            {/* Card Footer (Actions) */}
            <div className="dm-card-footer">
                {!isRunning && (
                    <button className="dm-btn dm-btn-success dm-flex-1" onClick={() => handleAction('start', container.ID)}>
                        <img src="/apps/docker-manager/frontend/start.svg" alt="Start" width="16" height="16" />
                        Start
                    </button>
                )}
                {isRunning && (
                    <button className="dm-btn dm-btn-danger dm-flex-1" onClick={() => handleAction('stop', container.ID)}>
                        <img src="/apps/docker-manager/frontend/stop.svg" alt="Stop" width="16" height="16" />
                        Stop
                    </button>
                )}
                <button className="dm-btn dm-btn-secondary dm-flex-1" onClick={() => handleAction('restart', container.ID)}>
                    <img src="/apps/docker-manager/frontend/restart.svg" alt="Restart" width="16" height="16" />
                    Restart
                </button>
            </div>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="dm-glass-panel dm-empty-state">
            <div className="dm-empty-icon">
                <img src="/apps/docker-manager/frontend/empty.svg" alt="Empty" width="64" height="64" />
            </div>
            <div>
                <h3 className="dm-empty-title">No Containers Found</h3>
                <p className="dm-empty-subtitle">
                    There are no Docker containers running on this host.
                </p>
            </div>
        </div>
    );
}

// --- Main Component ---

export default function DockerManager() {
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [credentials, setCredentials] = useState({ host: '', port: '22', username: '', password: '' });
    const [containers, setContainers] = useState<any[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        // Inject styles on mount
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
            const result = await executeCommand(\`docker ps -a --format '{{json .}}'\`);
            if (result.code !== 0) throw new Error(\`Failed code \${result.code}: \${result.stderr}\`);
            
            const parsedContainers = result.stdout
                .split('\\n')
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
            const result = await executeCommand(\`docker ps -a --format '{{json .}}'\`);
            if (result.code === 0) {
                const parsedContainers = result.stdout
                    .split('\\n')
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
            await executeCommand(\`docker \${action} \${containerId}\`);
            await refreshContainers();
        } catch (err: any) {
            alert(\`Failed to \${action} container: \${err.message}\`);
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
            
            <div className="dm-dashboard-content">
                <div className="dm-grid-container">
                    {containers.map((container, index) => (
                        <ContainerCard 
                            key={container.ID} 
                            container={container} 
                            handleAction={handleAction} 
                            index={index} 
                        />
                    ))}
                    
                    {containers.length === 0 && <EmptyState />}
                </div>
            </div>
        </div>
    );
}
