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
        <div className="dm-modal-backdrop" onClick={onClose}>
            <div className="nl-panel dm-modal dm-modal-md" onClick={e => e.stopPropagation()}>
                <div className="dm-modal-header">
                    <h3>🚀 Deploy New Container</h3>
                    <button className="dm-modal-close" onClick={onClose}>&times;</button>
                </div>

                {error && <div className="dm-error">{error}</div>}

                <form onSubmit={handleSubmit} className="dm-form">
                    <div className="dm-form-group">
                        <label>Image Name *</label>
                        <input
                            className="dm-input"
                            type="text"
                            placeholder="e.g. nginx:alpine, redis:7, postgres:16"
                            value={image}
                            onChange={e => setImage(e.target.value)}
                            required
                        />
                    </div>

                    <div className="dm-form-group">
                        <label>Container Name (Optional)</label>
                        <input
                            className="dm-input"
                            type="text"
                            placeholder="e.g. web-server"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    <div className="dm-form-row">
                        <div className="dm-form-group">
                            <label>Host Port</label>
                            <input
                                className="dm-input"
                                type="text"
                                placeholder="8080"
                                value={hostPort}
                                onChange={e => setHostPort(e.target.value)}
                            />
                        </div>
                        <div className="dm-form-group">
                            <label>Container Port</label>
                            <input
                                className="dm-input"
                                type="text"
                                placeholder="80"
                                value={containerPort}
                                onChange={e => setContainerPort(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="dm-form-group">
                        <label>Environment Variables (Key=Value per line)</label>
                        <textarea
                            className="dm-input dm-textarea"
                            rows={3}
                            placeholder="POSTGRES_PASSWORD=mysecret&#10;PORT=3000"
                            value={envVars}
                            onChange={e => setEnvVars(e.target.value)}
                        />
                    </div>

                    <div className="dm-form-group">
                        <label>Volume Mount (Host Path : Container Path)</label>
                        <input
                            className="dm-input"
                            type="text"
                            placeholder="e.g. /data/app:/app/data"
                            value={volumeMount}
                            onChange={e => setVolumeMount(e.target.value)}
                        />
                    </div>

                    <div className="dm-form-group">
                        <label>Restart Policy</label>
                        <select
                            className="dm-input"
                            value={restartPolicy}
                            onChange={e => setRestartPolicy(e.target.value)}
                        >
                            <option value="unless-stopped">unless-stopped</option>
                            <option value="always">always</option>
                            <option value="on-failure">on-failure</option>
                            <option value="no">no</option>
                        </select>
                    </div>

                    <div className="dm-modal-footer">
                        <button type="button" className="nl-button secondary" onClick={onClose} disabled={submitting}>
                            Cancel
                        </button>
                        <button type="submit" className="nl-button success" disabled={submitting}>
                            {submitting ? 'Deploying...' : 'Deploy Container'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
