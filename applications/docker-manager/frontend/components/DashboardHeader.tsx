import React from 'react';

export default function DashboardHeader({ credentials, metrics, refreshData, handlePrune, onOpenRunModal, setConnected, activeTab, setActiveTab }: any) {
    return (
        <>
            <div className="dm-header">
                <div className="dm-header-info">
                    <div className="dm-brand">
                        <img src="/apps/docker-manager/frontend/assets/docker.svg" alt="Docker Logo" className="dm-brand-logo" />
                        <h2>Docker Engine Manager</h2>
                    </div>
                    <div className="dm-status-indicator">
                        <span className="dm-dot" />
                        Connected to <strong>{credentials.username}@{credentials.host}:{credentials.port}</strong>
                    </div>
                </div>

                <div className="dm-header-stats">
                    <div className="dm-stat-badge">
                        <span className="label">Running</span>
                        <span className="value success">{metrics.runningCount || 0}</span>
                    </div>
                    <div className="dm-stat-badge">
                        <span className="label">Stopped</span>
                        <span className="value muted">{metrics.stoppedCount || 0}</span>
                    </div>
                    <div className="dm-stat-badge">
                        <span className="label">Images</span>
                        <span className="value">{metrics.imagesCount || 0}</span>
                    </div>
                    <div className="dm-stat-badge">
                        <span className="label">Volumes</span>
                        <span className="value">{metrics.volumesCount || 0}</span>
                    </div>
                </div>
                
                <div className="dm-actions">
                    <button className="nl-button success" onClick={onOpenRunModal}>
                        🚀 Deploy Container
                    </button>
                    <button className="nl-button danger" onClick={handlePrune} title="Clean unused containers, images & networks">
                        🧹 Prune System
                    </button>
                    <button className="nl-button secondary" onClick={refreshData}>
                        🔄 Refresh
                    </button>
                    <button className="nl-button secondary" onClick={() => setConnected(false)}>
                        🔌 Disconnect
                    </button>
                </div>
            </div>

            <div className="dm-tabs-bar">
                <div className="dm-tabs">
                    <button 
                        className={`dm-tab-btn ${activeTab === 'containers' ? 'active' : ''}`}
                        onClick={() => setActiveTab('containers')}
                    >
                        <span>📦 Containers</span>
                        <span className="dm-tab-badge">{metrics.totalContainers || 0}</span>
                    </button>
                    <button 
                        className={`dm-tab-btn ${activeTab === 'images' ? 'active' : ''}`}
                        onClick={() => setActiveTab('images')}
                    >
                        <span>🖼️ Images</span>
                        <span className="dm-tab-badge">{metrics.imagesCount || 0}</span>
                    </button>
                    <button 
                        className={`dm-tab-btn ${activeTab === 'volumes' ? 'active' : ''}`}
                        onClick={() => setActiveTab('volumes')}
                    >
                        <span>💾 Volumes</span>
                        <span className="dm-tab-badge">{metrics.volumesCount || 0}</span>
                    </button>
                    <button 
                        className={`dm-tab-btn ${activeTab === 'networks' ? 'active' : ''}`}
                        onClick={() => setActiveTab('networks')}
                    >
                        <span>🌐 Networks</span>
                        <span className="dm-tab-badge">{metrics.networksCount || 0}</span>
                    </button>
                    <button 
                        className={`dm-tab-btn ${activeTab === 'compose' ? 'active' : ''}`}
                        onClick={() => setActiveTab('compose')}
                    >
                        <span>⚡ Compose Stacks</span>
                    </button>
                </div>
            </div>
        </>
    );
}


