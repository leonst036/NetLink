import React from 'react';

export default function DashboardHeader({ credentials, refreshData, handlePrune, setConnected, activeTab, setActiveTab }: any) {
    return (
        <>
            <div className="dm-header">
                <div className="dm-header-info">
                    <h2>Docker Engine Manager</h2>
                    <div className="dm-status-indicator">
                        <span className="dm-dot" />
                        Connected to {credentials.username}@{credentials.host}:{credentials.port}
                    </div>
                </div>
                
                <div className="dm-actions">
                    <button className="nl-button danger" onClick={handlePrune} title="Clean unused containers, images & networks">
                        Prune System
                    </button>
                    <button className="nl-button secondary" onClick={refreshData}>
                        Refresh
                    </button>
                    <button className="nl-button secondary" onClick={() => setConnected(false)}>
                        Disconnect
                    </button>
                </div>
            </div>

            <div className="dm-tabs-bar">
                <div className="dm-tabs">
                    <button 
                        className={`dm-tab-btn ${activeTab === 'containers' ? 'active' : ''}`}
                        onClick={() => setActiveTab('containers')}
                    >
                        Containers
                    </button>
                    <button 
                        className={`dm-tab-btn ${activeTab === 'images' ? 'active' : ''}`}
                        onClick={() => setActiveTab('images')}
                    >
                        Images
                    </button>
                    <button 
                        className={`dm-tab-btn ${activeTab === 'volumes' ? 'active' : ''}`}
                        onClick={() => setActiveTab('volumes')}
                    >
                        Volumes
                    </button>
                </div>
            </div>
        </>
    );
}
