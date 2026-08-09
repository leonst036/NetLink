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
            <div className="dm-action-bar">
                <form onSubmit={onCreateSubmit} className="dm-form-inline">
                    <input
                        className="dm-input"
                        type="text"
                        placeholder="New Volume Name (e.g. redis-data, pg-storage)"
                        value={volName}
                        onChange={e => setVolName(e.target.value)}
                        disabled={creating}
                    />
                    <button type="submit" className="nl-button" disabled={creating} style={{ whiteSpace: 'nowrap' }}>
                        {creating ? '⏳ Creating...' : '➕ Create Volume'}
                    </button>
                </form>

                <div className="dm-search-input-wrapper">
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

            <div className="dm-table-wrapper">
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
                                <td><span className="dm-chip dm-chip-primary">{vol.Driver || 'local'}</span></td>
                                <td className="dm-code"><strong style={{ color: '#fff' }}>{vol.Name}</strong></td>
                                <td style={{ textAlign: 'right' }}>
                                    <button 
                                        className="dm-action-btn danger" 
                                        style={{ display: 'inline-flex' }} 
                                        onClick={() => handleRemoveVolume(vol.Name)}
                                        title="Remove Docker Volume"
                                    >
                                        🗑️ Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredVolumes.length === 0 && (
                            <tr>
                                <td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: 'var(--dm-text-muted)' }}>
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


