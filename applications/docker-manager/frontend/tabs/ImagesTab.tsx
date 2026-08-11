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
            <div className="dm-filter-bar" style={{ borderRadius: '14px', marginBottom: '20px' }}>
                <form onSubmit={onSubmitPull} style={{ display: 'flex', gap: '10px', flex: 1, maxWidth: '600px' }}>
                    <input 
                        className="dm-input dm-input-bare" 
                        type="text" 
                        placeholder="Pull Docker Image (e.g. nginx:alpine, redis:7, postgres:16)" 
                        value={pullInput}
                        onChange={e => setPullInput(e.target.value)}
                        disabled={pulling}
                    />
                    <button type="submit" className="dm-btn dm-btn-primary" disabled={pulling}>
                        {pulling ? '⏳ Pulling...' : '📥 Pull Image'}
                    </button>
                </form>

                <div className="dm-search-wrapper" style={{ maxWidth: '300px' }}>
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

            <div className="dm-table-container">
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
                                <td><strong style={{ color: 'var(--dm-text-heading)' }}>{img.Repository}</strong></td>
                                <td><span className="dm-chip">{img.Tag || 'latest'}</span></td>
                                <td style={{ fontFamily: 'var(--dm-font-mono)', fontSize: '0.8rem', color: 'var(--dm-cyan)' }}>{img.ID?.substring(0, 12)}</td>
                                <td>{img.CreatedAt || img.CreatedSince || 'N/A'}</td>
                                <td><span className="dm-chip">{img.Size}</span></td>
                                <td style={{ textAlign: 'right' }}>
                                    <button 
                                        className="dm-action-btn danger" 
                                        style={{ display: 'inline-flex' }} 
                                        onClick={() => handleRemoveImage(img.ID)}
                                        title="Remove Docker Image"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        </svg>
                                        <span>Remove</span>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredImages.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--dm-text-muted)', fontStyle: 'italic' }}>
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
