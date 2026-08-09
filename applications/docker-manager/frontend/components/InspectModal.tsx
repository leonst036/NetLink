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
        <div className="dm-modal-backdrop" onClick={onClose}>
            <div className="dm-modal dm-modal-lg" onClick={e => e.stopPropagation()}>
                <div className="dm-modal-header">
                    <div>
                        <h3>🔍 Inspection: {container.Names}</h3>
                        <span className="dm-code-sub">{container.ID}</span>
                    </div>
                    <div className="dm-modal-actions">
                        <div className="dm-pill-switch">
                            <button
                                className={activeView === 'summary' ? 'active' : ''}
                                onClick={() => setActiveView('summary')}
                            >
                                Summary
                            </button>
                            <button
                                className={activeView === 'raw' ? 'active' : ''}
                                onClick={() => setActiveView('raw')}
                            >
                                Raw JSON
                            </button>
                        </div>
                        <button className="nl-button secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={handleCopy} disabled={!inspectData}>
                            {copied ? '✓ Copied' : '📋 Copy JSON'}
                        </button>
                        <button className="dm-modal-close" onClick={onClose}>&times;</button>
                    </div>
                </div>

                <div className="dm-modal-body">
                    {loading ? (
                        <div className="dm-terminal-muted" style={{ padding: '40px', textAlign: 'center' }}>
                            ⏳ Fetching container metadata...
                        </div>
                    ) : !data ? (
                        <div className="dm-error">⚠️ No inspection data returned from daemon.</div>
                    ) : activeView === 'summary' ? (
                        <div className="dm-inspect-summary">
                            <div className="dm-inspect-section">
                                <h4>General Information</h4>
                                <div className="dm-inspect-grid">
                                    <div><strong>Container ID:</strong> <code className="dm-code">{data.Id?.substring(0, 16)}</code></div>
                                    <div><strong>Created:</strong> {data.Created ? new Date(data.Created).toLocaleString() : 'N/A'}</div>
                                    <div><strong>Image:</strong> {data.Config?.Image}</div>
                                    <div>
                                        <strong>State:</strong>{' '}
                                        <span className={`dm-badge ${data.State?.Running ? 'running' : 'stopped'}`}>
                                            <span className="dm-badge-dot" />
                                            {data.State?.Status || (data.State?.Running ? 'running' : 'stopped')}
                                        </span>
                                    </div>
                                    <div><strong>Restart Policy:</strong> <span className="dm-chip">{data.HostConfig?.RestartPolicy?.Name || 'no'}</span></div>
                                    <div><strong>IP Address:</strong> <span className="dm-chip dm-chip-primary">{data.NetworkSettings?.IPAddress || data.NetworkSettings?.Networks?.bridge?.IPAddress || 'None'}</span></div>
                                </div>
                            </div>

                            {data.Config?.Env && data.Config.Env.length > 0 && (
                                <div className="dm-inspect-section">
                                    <h4>Environment Variables ({data.Config.Env.length})</h4>
                                    <div className="dm-env-list">
                                        {data.Config.Env.map((env: string, idx: number) => (
                                            <div key={idx} className="dm-env-item">
                                                <code style={{ color: '#93c5fd' }}>{env}</code>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {data.Mounts && data.Mounts.length > 0 && (
                                <div className="dm-inspect-section">
                                    <h4>Volume Mounts ({data.Mounts.length})</h4>
                                    <div className="dm-table-wrapper">
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
                                                        <td className="dm-code">{m.Source}</td>
                                                        <td className="dm-code">{m.Destination}</td>
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
                        <div className="dm-log-terminal">
                            <pre style={{ margin: 0, color: '#a7f3d0' }}>
                                {formattedJson}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

