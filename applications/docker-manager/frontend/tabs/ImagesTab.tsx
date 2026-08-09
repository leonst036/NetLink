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
                        placeholder="Pull Image (e.g. nginx:latest, redis:alpine)" 
                        value={pullInput}
                        onChange={e => setPullInput(e.target.value)}
                        disabled={pulling}
                    />
                    <button type="submit" className="nl-button" disabled={pulling} style={{ whiteSpace: 'nowrap' }}>
                        {pulling ? 'Pulling...' : 'Pull Image'}
                    </button>
                </form>

                <input
                    className="dm-input dm-search-input"
                    type="text"
                    placeholder="Search images..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="nl-panel dm-table-wrapper">
                <table className="dm-table">
                    <thead>
                        <tr>
                            <th>Repository</th>
                            <th>Tag</th>
                            <th>Image ID</th>
                            <th>Created</th>
                            <th>Size</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredImages.map((img: any, idx: number) => (
                            <tr key={img.ID || idx}>
                                <td><strong>{img.Repository}</strong></td>
                                <td>{img.Tag}</td>
                                <td className="dm-code">{img.ID?.substring(0, 12)}</td>
                                <td>{img.CreatedAt || img.CreatedSince}</td>
                                <td>{img.Size}</td>
                                <td>
                                    <button className="nl-button danger" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => handleRemoveImage(img.ID)}>
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredImages.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
                                    No Docker images found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

