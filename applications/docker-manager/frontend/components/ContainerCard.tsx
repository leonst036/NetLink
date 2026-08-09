import React from 'react';

export default function ContainerCard({ container, stats, handleAction, handleViewLogs, handleRemove }: any) {
    const isRunning = container.State === 'running';
    const cStats = stats[container.ID] || {};
    
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
                {isRunning && cStats.CPUPerc && (
                    <>
                        <div className="dm-detail-row">
                            <span className="dm-detail-label">CPU Usage</span>
                            <span className="dm-detail-value">{cStats.CPUPerc}</span>
                        </div>
                        <div className="dm-detail-row">
                            <span className="dm-detail-label">Memory</span>
                            <span className="dm-detail-value">{cStats.MemUsage || cStats.MemPerc}</span>
                        </div>
                    </>
                )}
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
                <button className="nl-button secondary" onClick={() => handleViewLogs(container)}>
                    Logs
                </button>
                <button className="nl-button danger" onClick={() => handleRemove(container.ID)}>
                    Remove
                </button>
            </div>
        </div>
    );
}
