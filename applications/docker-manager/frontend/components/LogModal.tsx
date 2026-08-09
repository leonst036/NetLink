import React from 'react';

export default function LogModal({ container, logs, loading, onClose, onRefresh }: any) {
    if (!container) return null;
    
    return (
        <div className="dm-modal-backdrop" onClick={onClose}>
            <div className="nl-panel dm-modal" onClick={e => e.stopPropagation()}>
                <div className="dm-modal-header">
                    <h3>Logs: {container.Names}</h3>
                    <div>
                        <button className="nl-button secondary" style={{ marginRight: '8px', padding: '4px 12px' }} onClick={onRefresh}>
                            Refresh
                        </button>
                        <button className="dm-modal-close" onClick={onClose}>&times;</button>
                    </div>
                </div>
                <div className="dm-log-terminal">
                    {loading ? 'Fetching logs...' : (logs || 'No log output available.')}
                </div>
            </div>
        </div>
    );
}
