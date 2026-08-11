import React, { useState } from 'react';

export default function RunContainerModal({ onClose, onRun }: { onClose: () => void; onRun: (config: any) => Promise<void> }) {
    const [image, setImage] = useState('');
    const [name, setName] = useState('');
    const [hostPort, setHostPort] = useState('');
    const [containerPort, setContainerPort] = useState('');
    const [envVars, setEnvVars] = useState('');
    const [volumeMount, setVolumeMount] = useState('');
    const [restartPolicy, setRestartPolicy] = useState('unless-stopped');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!image.trim()) return;

        setSubmitting(true);
        setError('');

        try {
            await onRun({
                image: image.trim(),
                name: name.trim(),
                hostPort: hostPort.trim(),
                containerPort: containerPort.trim(),
                envVars: envVars.trim(),
                volumeMount: volumeMount.trim(),
                restartPolicy
            });
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to start container');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="dm-modal-overlay" onClick={onClose}>
            <div className="dm-modal" onClick={e => e.stopPropagation()}>
                <div className="dm-modal-header">
                    <h3 className="dm-modal-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--dm-cyan)" strokeWidth="2.5">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        <span>Deploy Container</span>
                    </h3>
                    <button className="dm-modal-close" onClick={onClose}>&times;</button>
                </div>

                {error && (
                    <div style={{ margin: '16px 24px 0', padding: '12px 16px', background: 'rgba(244,63,94,0.1)', border: '1px solid var(--dm-rose)', borderRadius: '8px', color: 'var(--dm-rose)', fontSize: '0.85rem' }}>
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="dm-modal-body">
                    <div className="dm-form-group">
                        <label>Image Name *</label>
                        <input
                            className="dm-input dm-input-bare"
                            type="text"
                            placeholder="e.g. nginx:alpine, redis:alpine, postgres:16-alpine"
                            value={image}
                            onChange={e => setImage(e.target.value)}
                            required
                            autoFocus
                        />
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--dm-text-muted)', fontWeight: 600 }}>Popular:</span>
                            <button type="button" className="dm-btn dm-btn-secondary dm-btn-sm" onClick={() => setImage('nginx:alpine')}>nginx:alpine</button>
                            <button type="button" className="dm-btn dm-btn-secondary dm-btn-sm" onClick={() => setImage('redis:alpine')}>redis:alpine</button>
                            <button type="button" className="dm-btn dm-btn-secondary dm-btn-sm" onClick={() => setImage('postgres:16-alpine')}>postgres:16</button>
                            <button type="button" className="dm-btn dm-btn-secondary dm-btn-sm" onClick={() => setImage('node:20-alpine')}>node:20</button>
                        </div>
                    </div>

                    <div className="dm-form-group">
                        <label>Container Name (Optional)</label>
                        <input
                            className="dm-input dm-input-bare"
                            type="text"
                            placeholder="e.g. my-web-app"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    <div className="dm-form-row">
                        <div className="dm-form-group">
                            <label>Host Port</label>
                            <input
                                className="dm-input dm-input-bare"
                                type="text"
                                placeholder="e.g. 8080"
                                value={hostPort}
                                onChange={e => setHostPort(e.target.value)}
                            />
                        </div>
                        <div className="dm-form-group">
                            <label>Container Port</label>
                            <input
                                className="dm-input dm-input-bare"
                                type="text"
                                placeholder="e.g. 80"
                                value={containerPort}
                                onChange={e => setContainerPort(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="dm-form-group">
                        <label>Environment Variables (KEY=VALUE per line)</label>
                        <textarea
                            className="dm-input dm-input-bare"
                            rows={3}
                            placeholder="POSTGRES_PASSWORD=mysecret&#10;PORT=3000"
                            value={envVars}
                            onChange={e => setEnvVars(e.target.value)}
                            style={{ fontFamily: 'var(--dm-font-mono)', fontSize: '0.8rem', resize: 'vertical' }}
                        />
                    </div>

                    <div className="dm-form-group">
                        <label>Volume Mount (Host Path : Container Path)</label>
                        <input
                            className="dm-input dm-input-bare"
                            type="text"
                            placeholder="e.g. /data/app:/app/data"
                            value={volumeMount}
                            onChange={e => setVolumeMount(e.target.value)}
                        />
                    </div>

                    <div className="dm-form-group">
                        <label>Restart Policy</label>
                        <select
                            className="dm-select"
                            value={restartPolicy}
                            onChange={e => setRestartPolicy(e.target.value)}
                            style={{ width: '100%' }}
                        >
                            <option value="unless-stopped">unless-stopped (Recommended)</option>
                            <option value="always">always</option>
                            <option value="on-failure">on-failure</option>
                            <option value="no">no</option>
                        </select>
                    </div>

                    <div className="dm-modal-footer" style={{ padding: '16px 0 0', marginTop: '16px' }}>
                        <button type="button" className="dm-btn dm-btn-secondary" onClick={onClose} disabled={submitting}>
                            Cancel
                        </button>
                        <button type="submit" className="dm-btn dm-btn-primary" disabled={submitting}>
                            {submitting ? '⏳ Deploying...' : '🚀 Deploy Container'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
