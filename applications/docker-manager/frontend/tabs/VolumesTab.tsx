import React, { useState } from 'react';

export default function VolumesTab({ volumes, handleCreateVolume, handleRemoveVolume }: any) {
    const [volName, setVolName] = useState('');
    const [creating, setCreating] = useState(false);
    const [search, setSearch] = useState('');

    const onCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!volName.trim()) return;
        setCreating(true);
        try {
            await handleCreateVolume(volName.trim());
            setVolName('');
        } finally {
            setCreating(false);
        }
    };

    const filteredVolumes = volumes.filter((vol: any) =>
        (vol.Name || '').toLowerCase().includes(search.toLowerCase()) ||
        (vol.Driver || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="dm-filter-bar" style={{ borderRadius: '14px', marginBottom: '20px' }}>
                <form onSubmit={onCreateSubmit} style={{ display: 'flex', gap: '10px', flex: 1, maxWidth: '600px' }}>
                    <input
                        className="dm-input dm-input-bare"
                        type="text"
                        placeholder="New Volume Name (e.g. redis-data, pg-storage)"
                        value={volName}
                        onChange={e => setVolName(e.target.value)}
                        disabled={creating}
                    />
                    <button type="submit" className="dm-btn dm-btn-primary" disabled={creating}>
                        {creating ? '⏳ Creating...' : '➕ Create Volume'}
                    </button>
                </form>

                <div className="dm-search-wrapper" style={{ maxWidth: '300px' }}>
                    <span className="dm-search-icon">🔍</span>
                    <input
                        className="dm-input"
                        type="text"
                        placeholder="Search volumes..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="dm-table-container">
                <table className="dm-table">
                    <thead>
                        <tr>
                            <th>Driver</th>
                            <th>Volume Name</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredVolumes.map((vol: any, idx: number) => (
                            <tr key={vol.Name || idx}>
                                <td><span className="dm-chip">{vol.Driver || 'local'}</span></td>
                                <td style={{ fontFamily: 'var(--dm-font-mono)', fontSize: '0.88rem', color: 'var(--dm-text-heading)' }}>{vol.Name}</td>
                                <td style={{ textAlign: 'right' }}>
                                    <button 
                                        className="dm-action-btn danger" 
                                        style={{ display: 'inline-flex' }} 
                                        onClick={() => handleRemoveVolume(vol.Name)}
                                        title="Remove Docker Volume"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        </svg>
                                        <span>Delete</span>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredVolumes.length === 0 && (
                            <tr>
                                <td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: 'var(--dm-text-muted)', fontStyle: 'italic' }}>
                                    No Docker volumes found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
