import React, { useState } from 'react';

export default function LogModal({ container, logs, loading, onClose, onRefresh, tail, setTail }: any) {
    const [copied, setCopied] = useState(false);

    if (!container) return null;

    const handleCopy = () => {
        if (logs) {
            navigator.clipboard.writeText(logs);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };
    
    return (
        <div className="dm-modal-backdrop" onClick={onClose}>
            <div className="nl-panel dm-modal dm-modal-lg" onClick={e => e.stopPropagation()}>
                <div className="dm-modal-header">
                    <div>
                        <h3>📜 Logs: {container.Names}</h3>
                        <span className="dm-code-sub">{container.ID?.substring(0, 12)}</span>
                    </div>
                    <div className="dm-modal-actions">
                        <select
                            className="dm-input dm-select-sm"
                            value={tail}
                            onChange={e => setTail(Number(e.target.value))}
                        >
                            <option value={50}>Last 50 lines</option>
                            <option value={100}>Last 100 lines</option>
                            <option value={500}>Last 500 lines</option>
                            <option value={1000}>Last 1000 lines</option>
                        </select>
                        <button className="nl-button secondary" onClick={() => onRefresh(tail)} disabled={loading}>
                            Refresh
                        </button>
                        <button className="nl-button secondary" onClick={handleCopy} disabled={!logs}>
                            {copied ? 'Copied!' : 'Copy'}
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

