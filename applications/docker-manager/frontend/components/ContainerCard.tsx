import React, { useState } from 'react';

export default function ContainerCard({ container, stats, handleAction, handleViewLogs, handleInspect, handleExec, handleRemove }: any) {
    const [copied, setCopied] = useState(false);
    const state = (container.State || 'unknown').toLowerCase();
    const isRunning = state === 'running';
    const isPaused = state === 'paused';
    const cStats = stats[container.ID] || stats[container.ID?.substring(0, 12)] || stats[container.Names] || {};

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
                    <div className="dm-code-sub">
                        <span>{container.ID?.substring(0, 12)}</span>
                        <button 
                            type="button" 
                            className="dm-copy-btn"
                            onClick={handleCopyId}
                            title="Copy Container ID"
                        >
                            {copied ? '✓ Copied' : '📋'}
                        </button>
                    </div>
                </div>
                <span className={`dm-badge ${isRunning ? 'running' : isPaused ? 'paused' : 'stopped'}`}>
                    <span className={`dm-dot-indicator ${isRunning ? '' : 'dm-dot-stopped'}`} />
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
                            <span className="dm-chip">{container.Ports}</span>
                        ) : (
                            <span style={{ opacity: 0.4 }}>None</span>
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
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                            </svg>
                            <span>Stop</span>
                        </button>
                        <button className="dm-action-btn" onClick={() => handleAction('pause', container.ID)} title="Pause Container">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="4" width="4" height="16"></rect>
                                <rect x="14" y="4" width="4" height="16"></rect>
                            </svg>
                            <span>Pause</span>
                        </button>
                        <button className="dm-action-btn" onClick={() => handleExec(container)} title="Execute Command in Terminal">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="4 17 10 11 4 5"></polyline>
                                <line x1="12" y1="19" x2="20" y2="19"></line>
                            </svg>
                            <span>Exec</span>
                        </button>
                    </>
                ) : isPaused ? (
                    <>
                        <button className="dm-action-btn success" onClick={() => handleAction('unpause', container.ID)} title="Unpause Container">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                            <span>Resume</span>
                        </button>
                        <button className="dm-action-btn danger" onClick={() => handleAction('stop', container.ID)} title="Stop Container">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                            </svg>
                            <span>Stop</span>
                        </button>
                    </>
                ) : (
                    <button className="dm-action-btn success" onClick={() => handleAction('start', container.ID)} title="Start Container">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        <span>Start</span>
                    </button>
                )}

                <button className="dm-action-btn" onClick={() => handleAction('restart', container.ID)} title="Restart Container">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                    <span>Restart</span>
                </button>
                <button className="dm-action-btn" onClick={() => handleInspect(container)} title="Inspect Details">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <span>Inspect</span>
                </button>
                <button className="dm-action-btn" onClick={() => handleViewLogs(container)} title="View Logs">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <span>Logs</span>
                </button>
                <button className="dm-action-btn danger" onClick={() => handleRemove(container.ID)} title="Delete Container">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    <span>Delete</span>
                </button>
            </div>
        </div>
    );
}
