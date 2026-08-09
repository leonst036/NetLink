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
        <div className="dm-modal-backdrop" onClick={onClose}>
            <div className="dm-modal dm-modal-lg" onClick={e => e.stopPropagation()}>
                <div className="dm-modal-header">
                    <div>
                        <h3>📜 Container Logs: {container.Names}</h3>
                        <span className="dm-code-sub">{container.ID?.substring(0, 12)}</span>
                    </div>
                    <div className="dm-modal-actions">
                        <input
                            className="dm-input dm-select-sm"
                            type="text"
                            placeholder="Filter logs..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ width: '160px' }}
                        />
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
                        <button 
                            className={`nl-button ${autoScroll ? 'primary' : 'secondary'}`} 
                            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                            onClick={() => setAutoScroll(!autoScroll)}
                            title="Toggle Auto Scroll to bottom"
                        >
                            {autoScroll ? '⬇️ Auto' : '⏸️ Scroll'}
                        </button>
                        <button className="nl-button secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => onRefresh(tail)} disabled={loading}>
                            🔄 Refresh
                        </button>
                        <button className="nl-button secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={handleCopy} disabled={!logs}>
                            {copied ? '✓ Copied' : '📋 Copy'}
                        </button>
                        <button className="nl-button secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={handleDownload} disabled={!logs}>
                            💾 Download
                        </button>
                        <button className="dm-modal-close" onClick={onClose}>&times;</button>
                    </div>
                </div>
                <div className="dm-log-terminal" ref={terminalRef}>
                    {loading ? (
                        <div className="dm-terminal-muted">Fetching container logs...</div>
                    ) : filteredLogs ? (
                        filteredLogs
                    ) : (
                        <div className="dm-terminal-muted">No log output matching filter.</div>
                    )}
                </div>
            </div>
        </div>
    );
}


