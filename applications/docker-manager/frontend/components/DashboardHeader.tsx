import React from 'react';

export default function DashboardHeader({ credentials, metrics, refreshData, handlePrune, onOpenRunModal, setConnected, activeTab, setActiveTab }: any) {
    return (
        <header className="dm-header-container">
            <div className="dm-header-top">
                <div className="dm-brand">
                    <img src="/apps/docker-manager/frontend/assets/docker.svg" alt="Docker Logo" className="dm-brand-logo" />
                    <div>
                        <h1>Docker Engine Manager</h1>
                    </div>
                </div>

                <div className="dm-ssh-pill">
                    <span className="dm-dot-indicator" />
                    <span>{credentials.username}@{credentials.host}:{credentials.port || 22}</span>
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
                
                <div className="dm-header-actions">
                    <button className="dm-btn dm-btn-primary" onClick={onOpenRunModal}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        <span>Deploy Container</span>
                    </button>
                    <button className="dm-btn dm-btn-danger" onClick={handlePrune} title="Clean unused containers, images & networks">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        <span>Prune System</span>
                    </button>
                    <button className="dm-btn dm-btn-secondary" onClick={refreshData} title="Refresh data">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        <span>Refresh</span>
                    </button>
                    <button className="dm-btn dm-btn-secondary" onClick={() => setConnected(false)} title="Disconnect SSH">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                            <line x1="12" y1="2" x2="12" y2="12"></line>
                        </svg>
                        <span>Disconnect</span>
                    </button>
                </div>
            </div>

            <div className="dm-tabs-bar">
                <div className="dm-tabs-group">
                    <button 
                        className={`dm-tab-btn ${activeTab === 'containers' ? 'active' : ''}`}
                        onClick={() => setActiveTab('containers')}
                    >
                        <span>Containers</span>
                        <span className="dm-tab-badge">{metrics.totalContainers || 0}</span>
                    </button>
                    <button 
                        className={`dm-tab-btn ${activeTab === 'images' ? 'active' : ''}`}
                        onClick={() => setActiveTab('images')}
                    >
                        <span>Images</span>
                        <span className="dm-tab-badge">{metrics.imagesCount || 0}</span>
                    </button>
                    <button 
                        className={`dm-tab-btn ${activeTab === 'volumes' ? 'active' : ''}`}
                        onClick={() => setActiveTab('volumes')}
                    >
                        <span>Volumes</span>
                        <span className="dm-tab-badge">{metrics.volumesCount || 0}</span>
                    </button>
                    <button 
                        className={`dm-tab-btn ${activeTab === 'networks' ? 'active' : ''}`}
                        onClick={() => setActiveTab('networks')}
                    >
                        <span>Networks</span>
                        <span className="dm-tab-badge">{metrics.networksCount || 0}</span>
                    </button>
                    <button 
                        className={`dm-tab-btn ${activeTab === 'compose' ? 'active' : ''}`}
                        onClick={() => setActiveTab('compose')}
                    >
                        <span>Compose Stacks</span>
                    </button>
                </div>
            </div>
        </header>
    );
}
