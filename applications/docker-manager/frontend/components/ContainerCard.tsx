import React, { useState } from 'react';

export default function ContainerCard({ container, stats, handleAction, handleViewLogs, handleInspect, handleExec, handleRemove }: any) {
    const [copied, setCopied] = useState(false);
    const state = (container.State || 'unknown').toLowerCase();
    const isRunning = state === 'running';
    const cStats = stats[container.ID] || stats[container.ID?.substring(0, 12)] || stats[container.Names] || {};

    const getIcon = () => {
        const name = (container.Names || '').toLowerCase();
        const img = (container.Image || '').toLowerCase();
        if (name.includes('db') || name.includes('postgres') || name.includes('mysql') || img.includes('postgres') || img.includes('mysql')) return 'database';
        if (name.includes('redis') || img.includes('redis') || name.includes('cache')) return 'memory';
        if (name.includes('web') || name.includes('nginx') || img.includes('nginx')) return 'web';
        return 'dns';
    };

    const handleCopyId = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (container.ID) {
            navigator.clipboard.writeText(container.ID);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };
    
    return (
        <div className={`glass-card stitch-card ${!isRunning ? 'opacity-70' : ''}`}>
            <div className="stitch-card-top">
                <div className="stitch-card-info">
                    <div className="stitch-card-icon">
                        <span className="material-symbols-outlined">{getIcon()}</span>
                    </div>
                    <div>
                        <h3 className="stitch-card-title">{container.Names?.replace(/^\//, '')}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={`stitch-card-status ${isRunning ? 'running' : 'stopped'}`}>
                                <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 status-pulse' : 'bg-rose-500'}`} style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: isRunning ? 'var(--dm-emerald)' : 'var(--dm-rose)' }} />
                                {container.State}
                            </span>
                            <span style={{ fontFamily: 'var(--dm-font-mono)', fontSize: '11px', color: 'var(--dm-on-surface-variant)', cursor: 'pointer' }} onClick={handleCopyId} title="Copy Container ID">
                                {copied ? '✓ Copied' : container.ID?.substring(0, 12)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="stitch-card-stats-box">
                <div>CPU: <span>{cStats.CPUPerc || (isRunning ? '0.10%' : '0.00%')}</span></div>
                <div>RAM: <span>{cStats.MemUsage || (isRunning ? '128MB' : '0MB')}</span></div>
                <div style={{ gridColumn: 'span 2' }}>
                    Image: <span style={{ color: 'var(--dm-primary-container)' }}>{container.Image}</span>
                </div>
                {container.Ports && (
                    <div style={{ gridColumn: 'span 2' }}>
                        Ports: <span style={{ color: 'var(--dm-primary-container)' }}>{container.Ports}</span>
                    </div>
                )}
            </div>

            <div className="stitch-card-actions">
                {isRunning ? (
                    <button className="stitch-btn-action" onClick={() => handleAction('stop', container.ID)} style={{ background: 'rgba(244,63,94,0.12)', borderColor: 'rgba(244,63,94,0.3)', color: 'var(--dm-rose)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>stop</span> Stop
                    </button>
                ) : (
                    <button className="stitch-btn-action" onClick={() => handleAction('start', container.ID)} style={{ background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)', color: 'var(--dm-emerald)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>play_arrow</span> Start
                    </button>
                )}

                <button className="stitch-btn-action" onClick={() => handleAction('restart', container.ID)}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span> Restart
                </button>

                <button className="stitch-btn-icon-only" onClick={() => handleViewLogs(container)} title="Logs">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>segment</span>
                </button>
                
                {isRunning && (
                    <button className="stitch-btn-icon-only" onClick={() => handleExec(container)} title="Exec Terminal">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>terminal</span>
                    </button>
                )}

                <button className="stitch-btn-icon-only" onClick={() => handleInspect(container)} title="Inspect">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>info</span>
                </button>

                <button className="stitch-btn-icon-only" onClick={() => handleRemove(container.ID)} title="Delete" style={{ color: 'var(--dm-rose)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                </button>
            </div>
        </div>
    );
}
