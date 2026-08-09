import React from 'react';

export default function DashboardHeader({ credentials, metrics, refreshData, handlePrune, setConnected }: any) {
    const runningPct = metrics.totalContainers ? Math.round((metrics.runningCount / metrics.totalContainers) * 100) : 0;

    return (
        <header className="stitch-header">
            <div className="stitch-brand">
                <span className="material-symbols-outlined text-primary-container" style={{ fontSize: '24px', color: 'var(--dm-primary-container)' }}>dns</span>
                <span className="stitch-logo">DOCKER_ENGINE_V2</span>
            </div>

            <div className="stitch-header-right">
                <div className="stitch-system-gauges">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: 'var(--dm-font-mono)', color: 'var(--dm-on-surface-variant)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--dm-primary-container)' }}>lan</span>
                        <span>{credentials.username}@{credentials.host}</span>
                    </div>

                    <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }} />

                    <div className="stitch-gauge-item">
                        <div className="stitch-gauge-label">
                            <span>RUNNING</span>
                            <span style={{ color: 'var(--dm-primary-container)' }}>{metrics.runningCount}/{metrics.totalContainers}</span>
                        </div>
                        <div className="stitch-gauge-bar">
                            <div className="stitch-gauge-fill" style={{ width: `${runningPct}%`, background: 'var(--dm-primary-container)' }} />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="stitch-btn-icon-only" onClick={refreshData} title="Refresh Data">
                        <span className="material-symbols-outlined">refresh</span>
                    </button>
                    <button className="stitch-btn-icon-only" onClick={handlePrune} title="Prune System">
                        <span className="material-symbols-outlined">delete_sweep</span>
                    </button>
                    <button className="stitch-btn-icon-only" onClick={() => setConnected(false)} title="Disconnect SSH">
                        <span className="material-symbols-outlined">power_settings_new</span>
                    </button>
                </div>
            </div>
        </header>
    );
}
