import React, { useState } from 'react';

export default function ContainerCard({ container, stats, handleAction, handleViewLogs, handleInspect, handleExec, handleRemove }: any) {
    const [copied, setCopied] = useState(false);
    const state = container.State || 'unknown';
    const isRunning = state === 'running';
    const isPaused = state === 'paused';
    const cStats = stats[container.ID] || stats[container.ID?.substring(0, 12)] || {};

    const parsePercent = (str?: string) => {
        if (!str) return 0;
        const match = str.match(/([0-9.]+)/);
        return match && match[1] ? Math.min(100, parseFloat(match[1])) : 0;
    };

    const cpuVal = parsePercent(cStats.CPUPerc);
    const memVal = parsePercent(cStats.MemPerc);

    const handleCopyId = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (container.ID) {
            navigator.clipboard.writeText(container.ID);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };
    
    return (
        <div className={`dm-card state-${isRunning ? 'running' : isPaused ? 'paused' : 'stopped'}`}>
            <div className="dm-card-header">
                <div className="dm-card-title-group">
                    <h3 className="dm-card-title" title={container.Names}>{container.Names}</h3>
                    <span className="dm-code-sub">
                        <span>{container.ID?.substring(0, 12)}</span>
                        <button 
                            type="button" 
                            className="dm-text-link" 
                            style={{ fontSize: '0.7rem', textDecoration: 'none' }}
                            onClick={handleCopyId}
                            title="Copy Container ID"
                        >
                            {copied ? '✓ Copied' : '📋'}
                        </button>
                    </span>
                </div>
                <span className={`dm-badge ${isRunning ? 'running' : isPaused ? 'paused' : 'stopped'}`}>
                    <span className="dm-badge-dot" />
                    {container.State}
                </span>
            </div>
            
            <div className="dm-card-details">
                <div className="dm-detail-row">
                    <span className="dm-detail-label">Image</span>
                    <span className="dm-detail-value" title={container.Image}>{container.Image}</span>
                </div>
                <div className="dm-detail-row">
                    <span className="dm-detail-label">Status</span>
                    <span className="dm-detail-value">{container.Status}</span>
                </div>
                <div className="dm-detail-row">
                    <span className="dm-detail-label">Ports</span>
                    <span className="dm-detail-value">
                        {container.Ports ? (
                            <span className="dm-chip dm-chip-primary">{container.Ports}</span>
                        ) : (
                            <span style={{ opacity: 0.5 }}>None</span>
                        )}
                    </span>
                </div>

                {isRunning && (
                    <div className="dm-card-metrics">
                        <div className="dm-metric-item">
                            <div className="dm-metric-header">
                                <span>CPU Usage</span>
                                <span>{cStats.CPUPerc || '0.00%'}</span>
                            </div>
                            <div className="dm-progress-bar">
                                <div className="dm-progress-fill cpu" style={{ width: `${cpuVal}%` }} />
                            </div>
                        </div>

                        <div className="dm-metric-item">
                            <div className="dm-metric-header">
                                <span>Memory Usage</span>
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
                        <button className="dm-action-btn danger" onClick={() => handleAction('stop', container.ID)} title="Stop Container">
                            ⏹️ Stop
                        </button>
                        <button className="dm-action-btn" onClick={() => handleAction('pause', container.ID)} title="Pause Container">
                            ⏸️ Pause
                        </button>
                        <button className="dm-action-btn" onClick={() => handleExec(container)} title="Execute Command inside Container">
                            ⚡ Exec
                        </button>
                    </>
                ) : isPaused ? (
                    <>
                        <button className="dm-action-btn success" onClick={() => handleAction('unpause', container.ID)} title="Unpause Container">
                            ▶️ Resume
                        </button>
                        <button className="dm-action-btn danger" onClick={() => handleAction('stop', container.ID)} title="Stop Container">
                            ⏹️ Stop
                        </button>
                    </>
                ) : (
                    <button className="dm-action-btn success" onClick={() => handleAction('start', container.ID)} title="Start Container">
                        ▶️ Start
                    </button>
                )}

                <button className="dm-action-btn" onClick={() => handleAction('restart', container.ID)} title="Restart Container">
                    🔄 Restart
                </button>
                <button className="dm-action-btn" onClick={() => handleInspect(container)} title="Inspect Config & Details">
                    🔍 Inspect
                </button>
                <button className="dm-action-btn" onClick={() => handleViewLogs(container)} title="View Container Output Logs">
                    📜 Logs
                </button>
                <button className="dm-action-btn danger" onClick={() => handleRemove(container.ID)} title="Delete Container">
                    🗑️ Delete
                </button>
            </div>
        </div>
    );
}


