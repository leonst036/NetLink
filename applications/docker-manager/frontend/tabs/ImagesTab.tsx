import React, { useState } from 'react';

export default function ImagesTab({ images, handlePull, handleRemoveImage }: any) {
    const [pullInput, setPullInput] = useState('');
    const [pulling, setPulling] = useState(false);
    const [search, setSearch] = useState('');

    const onSubmitPull = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pullInput.trim()) return;
        setPulling(true);
        try {
            await handlePull(pullInput.trim());
            setPullInput('');
        } finally {
            setPulling(false);
        }
    };

    const filteredImages = images.filter((img: any) =>
        (img.Repository || '').toLowerCase().includes(search.toLowerCase()) ||
        (img.Tag || '').toLowerCase().includes(search.toLowerCase()) ||
        (img.ID || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="dm-action-bar">
                <form onSubmit={onSubmitPull} className="dm-form-inline">
                    <input 
                        className="dm-input" 
                        type="text" 
                        placeholder="Pull Docker Image (e.g. nginx:alpine, redis:7, postgres:16)" 
                        value={pullInput}
                        onChange={e => setPullInput(e.target.value)}
                        disabled={pulling}
                    />
                    <button type="submit" className="nl-button" disabled={pulling} style={{ whiteSpace: 'nowrap' }}>
                        {pulling ? '⏳ Pulling Image...' : '📥 Pull Image'}
                    </button>
                </form>

                <div className="dm-search-input-wrapper">
                    <span className="dm-search-icon">🔍</span>
                    <input
                        className="dm-input"
                        type="text"
                        placeholder="Search images..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="dm-table-wrapper">
                <table className="dm-table">
                    <thead>
                        <tr>
                            <th>Repository</th>
                            <th>Tag</th>
                            <th>Image ID</th>
                            <th>Created</th>
                            <th>Size</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredImages.map((img: any, idx: number) => (
                            <tr key={img.ID || idx}>
                                <td><strong style={{ color: '#fff' }}>{img.Repository}</strong></td>
                                <td><span className="dm-chip dm-chip-primary">{img.Tag || 'latest'}</span></td>
                                <td className="dm-code">{img.ID?.substring(0, 12)}</td>
                                <td>{img.CreatedAt || img.CreatedSince || 'N/A'}</td>
                                <td><span className="dm-chip">{img.Size}</span></td>
                                <td style={{ textAlign: 'right' }}>
                                    <button 
                                        className="dm-action-btn danger" 
                                        style={{ display: 'inline-flex' }} 
                                        onClick={() => handleRemoveImage(img.ID)}
                                        title="Remove Docker Image"
                                    >
                                        🗑️ Remove
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredImages.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--dm-text-muted)' }}>
                                    No Docker images found matching criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}


