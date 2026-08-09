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
            <div className="nl-panel dm-modal dm-modal-lg" onClick={e => e.stopPropagation()}>
                <div className="dm-modal-header">
                    <div>
                        <h3>Inspect: {container.Names}</h3>
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
                        <button className="nl-button secondary" onClick={handleCopy} disabled={!inspectData}>
                            {copied ? 'Copied!' : 'Copy JSON'}
                        </button>
                        <button className="dm-modal-close" onClick={onClose}>&times;</button>
                    </div>
                </div>

                <div className="dm-modal-body">
                    {loading ? (
                        <div className="dm-loading-spinner">Loading container inspection...</div>
                    ) : !data ? (
                        <div className="dm-error">No inspect data available.</div>
                    ) : activeView === 'summary' ? (
                        <div className="dm-inspect-summary">
                            <div className="dm-inspect-section">
                                <h4>General Information</h4>
                                <div className="dm-inspect-grid">
                                    <div><strong>Container ID:</strong> <code>{data.Id}</code></div>
                                    <div><strong>Created:</strong> {data.Created}</div>
                                    <div><strong>Image:</strong> {data.Config?.Image} ({data.Image?.substring(0, 12)})</div>
                                    <div><strong>State:</strong> <span className={`dm-badge ${data.State?.Running ? 'running' : 'stopped'}`}>{data.State?.Status || (data.State?.Running ? 'running' : 'stopped')}</span></div>
                                    <div><strong>Restart Policy:</strong> {data.HostConfig?.RestartPolicy?.Name || 'N/A'}</div>
                                    <div><strong>IP Address:</strong> {data.NetworkSettings?.IPAddress || data.NetworkSettings?.Networks?.bridge?.IPAddress || 'None'}</div>
                                </div>
                            </div>

                            {data.Config?.Env && data.Config.Env.length > 0 && (
                                <div className="dm-inspect-section">
                                    <h4>Environment Variables ({data.Config.Env.length})</h4>
                                    <div className="dm-env-list">
                                        {data.Config.Env.map((env: string, idx: number) => (
                                            <div key={idx} className="dm-env-item">
                                                <code>{env}</code>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {data.Mounts && data.Mounts.length > 0 && (
                                <div className="dm-inspect-section">
                                    <h4>Volume Mounts ({data.Mounts.length})</h4>
                                    <table className="dm-table dm-table-sm">
                                        <thead>
                                            <tr>
                                                <th>Type</th>
                                                <th>Source (Host)</th>
                                                <th>Destination (Container)</th>
                                                <th>Mode</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.Mounts.map((m: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td>{m.Type}</td>
                                                    <td className="dm-code">{m.Source}</td>
                                                    <td className="dm-code">{m.Destination}</td>
                                                    <td>{m.Mode || (m.RW ? 'rw' : 'ro')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <pre className="dm-json-terminal">
                            {formattedJson}
                        </pre>
                    )}
                </div>
            </div>
        </div>
    );
}
