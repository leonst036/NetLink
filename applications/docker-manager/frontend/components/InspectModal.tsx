import React, { useState } from 'react';

export default function InspectModal({ container, inspectData, loading, onClose }: any) {
    const [copied, setCopied] = useState(false);
    const [activeView, setActiveView] = useState<'summary' | 'raw'>('summary');

    if (!container) return null;

    const formattedJson = inspectData ? JSON.stringify(inspectData, null, 2) : '';

    const handleCopy = () => {
        if (formattedJson) {
            navigator.clipboard.writeText(formattedJson);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const data = Array.isArray(inspectData) ? inspectData[0] : inspectData;

    return (
        <div className="dm-modal-overlay" onClick={onClose}>
            <div className="dm-modal dm-modal-lg" onClick={e => e.stopPropagation()}>
                <div className="dm-modal-header">
                    <div>
                        <h3 className="dm-modal-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--dm-cyan)" strokeWidth="2">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <span>Inspect: {container.Names}</span>
                        </h3>
                        <span className="dm-code-sub">{container.ID}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px' }}>
                            <button
                                className={`dm-btn dm-btn-sm ${activeView === 'summary' ? 'dm-btn-primary' : 'dm-btn-secondary'}`}
                                onClick={() => setActiveView('summary')}
                            >
                                Summary
                            </button>
                            <button
                                className={`dm-btn dm-btn-sm ${activeView === 'raw' ? 'dm-btn-primary' : 'dm-btn-secondary'}`}
                                onClick={() => setActiveView('raw')}
                            >
                                Raw JSON
                            </button>
                        </div>

                        <button className="dm-btn dm-btn-secondary dm-btn-sm" onClick={handleCopy} disabled={!inspectData}>
                            {copied ? '✓ Copied' : '📋 Copy JSON'}
                        </button>
                        <button className="dm-modal-close" onClick={onClose}>&times;</button>
                    </div>
                </div>

                <div className="dm-modal-body">
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--dm-text-muted)', fontStyle: 'italic' }}>
                            ⏳ Fetching container metadata...
                        </div>
                    ) : !data ? (
                        <div style={{ padding: '16px', background: 'rgba(244,63,94,0.1)', border: '1px solid var(--dm-rose)', borderRadius: '8px', color: 'var(--dm-rose)' }}>
                            ⚠️ No inspection data returned from daemon.
                        </div>
                    ) : activeView === 'summary' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--dm-border-subtle)' }}>
                                <h4 style={{ margin: '0 0 14px 0', fontSize: '0.9rem', color: 'var(--dm-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    General Information
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '0.85rem' }}>
                                    <div><span style={{ color: 'var(--dm-text-muted)' }}>Container ID:</span> <code style={{ fontFamily: 'var(--dm-font-mono)', color: 'var(--dm-cyan)' }}>{data.Id?.substring(0, 16)}</code></div>
                                    <div><span style={{ color: 'var(--dm-text-muted)' }}>Created:</span> {data.Created ? new Date(data.Created).toLocaleString() : 'N/A'}</div>
                                    <div><span style={{ color: 'var(--dm-text-muted)' }}>Image:</span> {data.Config?.Image}</div>
                                    <div>
                                        <span style={{ color: 'var(--dm-text-muted)' }}>State:</span>{' '}
                                        <span className={`dm-badge ${data.State?.Running ? 'running' : 'stopped'}`}>
                                            {data.State?.Status || (data.State?.Running ? 'running' : 'stopped')}
                                        </span>
                                    </div>
                                    <div><span style={{ color: 'var(--dm-text-muted)' }}>Restart Policy:</span> <span className="dm-chip">{data.HostConfig?.RestartPolicy?.Name || 'no'}</span></div>
                                    <div><span style={{ color: 'var(--dm-text-muted)' }}>IP Address:</span> <span className="dm-chip">{data.NetworkSettings?.IPAddress || data.NetworkSettings?.Networks?.bridge?.IPAddress || 'None'}</span></div>
                                </div>
                            </div>

                            {data.Config?.Env && data.Config.Env.length > 0 && (
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--dm-border-subtle)' }}>
                                    <h4 style={{ margin: '0 0 14px 0', fontSize: '0.9rem', color: 'var(--dm-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Environment Variables ({data.Config.Env.length})
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                                        {data.Config.Env.map((env: string, idx: number) => (
                                            <div key={idx} style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontFamily: 'var(--dm-font-mono)', fontSize: '0.8rem', color: 'var(--dm-text-body)' }}>
                                                {env}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {data.Mounts && data.Mounts.length > 0 && (
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--dm-border-subtle)' }}>
                                    <h4 style={{ margin: '0 0 14px 0', fontSize: '0.9rem', color: 'var(--dm-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Volume Mounts ({data.Mounts.length})
                                    </h4>
                                    <div className="dm-table-container">
                                        <table className="dm-table">
                                            <thead>
                                                <tr>
                                                    <th>Type</th>
                                                    <th>Host Path</th>
                                                    <th>Container Path</th>
                                                    <th>Mode</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.Mounts.map((m: any, idx: number) => (
                                                    <tr key={idx}>
                                                        <td><span className="dm-chip">{m.Type}</span></td>
                                                        <td style={{ fontFamily: 'var(--dm-font-mono)', fontSize: '0.8rem' }}>{m.Source}</td>
                                                        <td style={{ fontFamily: 'var(--dm-font-mono)', fontSize: '0.8rem' }}>{m.Destination}</td>
                                                        <td>{m.Mode || (m.RW ? 'rw' : 'ro')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="dm-terminal">
                            <div className="dm-terminal-output">
                                <pre style={{ margin: 0, color: 'var(--dm-emerald)' }}>
                                    {formattedJson}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
