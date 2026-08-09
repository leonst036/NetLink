import React, { useState, useRef, useEffect } from 'react';

export default function LogModal({ container, logs, loading, onClose, onRefresh, tail, setTail }: any) {
    const [copied, setCopied] = useState(false);
    const [search, setSearch] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    const terminalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (autoScroll && terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    if (!container) return null;

    const handleCopy = () => {
        if (logs) {
            navigator.clipboard.writeText(logs);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDownload = () => {
        if (!logs) return;
        const blob = new Blob([logs], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `container-${container.Names?.replace(/^\//, '') || 'logs'}.log`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const filteredLogs = search 
        ? (logs || '').split('\n').filter((l: string) => l.toLowerCase().includes(search.toLowerCase())).join('\n')
        : (logs || '');

    return (
        <div className="dm-modal-overlay" onClick={onClose}>
            <div className="dm-modal dm-modal-lg" onClick={e => e.stopPropagation()}>
                <div className="dm-modal-header">
                    <div>
                        <h3 className="dm-modal-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--dm-cyan)" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            <span>Logs: {container.Names}</span>
                        </h3>
                        <span className="dm-code-sub">{container.ID?.substring(0, 12)}</span>
                    </div>

                    <button className="dm-modal-close" onClick={onClose}>&times;</button>
                </div>

                <div className="dm-filter-bar" style={{ padding: '10px 24px' }}>
                    <div className="dm-search-wrapper" style={{ maxWidth: '240px' }}>
                        <span className="dm-search-icon">🔍</span>
                        <input
                            className="dm-input"
                            type="text"
                            placeholder="Filter logs..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select
                            className="dm-select"
                            value={tail}
                            onChange={e => setTail(Number(e.target.value))}
                        >
                            <option value={50}>Last 50 lines</option>
                            <option value={100}>Last 100 lines</option>
                            <option value={500}>Last 500 lines</option>
                            <option value={1000}>Last 1000 lines</option>
                        </select>

                        <button 
                            className={`dm-btn ${autoScroll ? 'dm-btn-primary' : 'dm-btn-secondary'} dm-btn-sm`}
                            onClick={() => setAutoScroll(!autoScroll)}
                            title="Toggle Auto Scroll"
                        >
                            {autoScroll ? '⬇️ Auto Scroll' : '⏸️ Scroll Off'}
                        </button>

                        <button className="dm-btn dm-btn-secondary dm-btn-sm" onClick={() => onRefresh(tail)} disabled={loading}>
                            🔄 Refresh
                        </button>
                        <button className="dm-btn dm-btn-secondary dm-btn-sm" onClick={handleCopy} disabled={!logs}>
                            {copied ? '✓ Copied' : '📋 Copy'}
                        </button>
                        <button className="dm-btn dm-btn-secondary dm-btn-sm" onClick={handleDownload} disabled={!logs}>
                            💾 Download
                        </button>
                    </div>
                </div>

                <div className="dm-modal-body" style={{ padding: '16px 24px' }}>
                    <div className="dm-terminal">
                        <div className="dm-terminal-toolbar">
                            <span className="dm-terminal-title">docker logs --tail {tail} {container.ID?.substring(0, 12)}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--dm-text-dim)' }}>
                                {filteredLogs ? `${filteredLogs.split('\n').length} lines` : '0 lines'}
                            </span>
                        </div>
                        <div className="dm-terminal-output" ref={terminalRef}>
                            {loading ? (
                                <div style={{ color: 'var(--dm-text-muted)', fontStyle: 'italic' }}>Fetching container logs...</div>
                            ) : filteredLogs ? (
                                filteredLogs
                            ) : (
                                <div style={{ color: 'var(--dm-text-muted)', fontStyle: 'italic' }}>No log output matching filter.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
