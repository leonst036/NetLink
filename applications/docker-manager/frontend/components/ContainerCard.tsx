import React from 'react';

export default function ContainerCard({ container, stats, handleAction, handleViewLogs, handleInspect, handleExec, handleRemove }: any) {
    const state = container.State || 'unknown';
    const isRunning = state === 'running';
    const isPaused = state === 'paused';
    const cStats = stats[container.ID] || stats[container.ID?.substring(0, 12)] || {};

    const parsePercent = (str?: string) => {
        if (!str) return 0;
        const match = str.match(/([0-9.]+)/);
        return match ? Math.min(100, parseFloat(match[1])) : 0;
    };

    const cpuVal = parsePercent(cStats.CPUPerc);
    const memVal = parsePercent(cStats.MemPerc);
    
    return (
        <div className="nl-panel dm-card">
            <div className="dm-card-header">
                <div>
                    <h3 className="dm-card-title">{container.Names}</h3>
                    <span className="dm-code-sub">{container.ID?.substring(0, 12)}</span>
                </div>
                <span className={`dm-badge ${isRunning ? 'running' : isPaused ? 'paused' : 'stopped'}`}>
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

                {isRunning && (
                    <div className="dm-card-metrics">
                        <div className="dm-metric-item">
                            <div className="dm-metric-header">
                                <span>CPU</span>
                                <span>{cStats.CPUPerc || '0.00%'}</span>
                            </div>
                            <div className="dm-progress-bar">
                                <div className="dm-progress-fill cpu" style={{ width: `${cpuVal}%` }} />
                            </div>
                        </div>

                        <div className="dm-metric-item">
                            <div className="dm-metric-header">
                                <span>Memory</span>
                                <span>{cStats.MemUsage || cStats.MemPerc || '0.00%'}</span>
                            </div>
                            <div className="dm-progress-bar">
                                <div className="dm-progress-fill mem" style={{ width: `${memVal}%` }} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="dm-card-actions">
                {isRunning ? (
                    <>
                        <button className="nl-button danger" onClick={() => handleAction('stop', container.ID)}>
                            Stop
                        </button>
                        <button className="nl-button secondary" onClick={() => handleAction('pause', container.ID)}>
                            Pause
                        </button>
                        <button className="nl-button secondary" onClick={() => handleExec(container)}>
                            ⚡ Exec
                        </button>
                    </>
                ) : isPaused ? (
                    <>
                        <button className="nl-button success" onClick={() => handleAction('unpause', container.ID)}>
                            Unpause
                        </button>
                        <button className="nl-button danger" onClick={() => handleAction('stop', container.ID)}>
                            Stop
                        </button>
                    </>
                ) : (
                    <button className="nl-button success" onClick={() => handleAction('start', container.ID)}>
                        Start
                    </button>
                )}

                <button className="nl-button secondary" onClick={() => handleAction('restart', container.ID)}>
                    Restart
                </button>
                <button className="nl-button secondary" onClick={() => handleInspect(container)}>
                    Inspect
                </button>
                <button className="nl-button secondary" onClick={() => handleViewLogs(container)}>
                    Logs
                </button>
                <button className="nl-button danger" onClick={() => handleRemove(container.ID)}>
                    Delete
                </button>
            </div>
        </div>
    );
}

