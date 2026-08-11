import React, { useState } from 'react';

export default function NetworksTab({ networks, handleRemoveNetwork, handleCreateNetwork }: any) {
    const [networkName, setNetworkName] = useState('');
    const [driver, setDriver] = useState('bridge');
    const [creating, setCreating] = useState(false);
    const [search, setSearch] = useState('');

    const onCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!networkName.trim()) return;
        setCreating(true);
        try {
            await handleCreateNetwork(networkName.trim(), driver);
            setNetworkName('');
        } finally {
            setCreating(false);
        }
    };

    const filteredNetworks = networks.filter((net: any) =>
        (net.Name || '').toLowerCase().includes(search.toLowerCase()) ||
        (net.Driver || '').toLowerCase().includes(search.toLowerCase()) ||
        (net.ID || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="dm-filter-bar" style={{ borderRadius: '14px', marginBottom: '20px' }}>
                <form onSubmit={onCreateSubmit} style={{ display: 'flex', gap: '10px', flex: 1, maxWidth: '600px' }}>
                    <input
                        className="dm-input dm-input-bare"
                        type="text"
                        placeholder="Network Name (e.g. backend-net, isolated-network)"
                        value={networkName}
                        onChange={e => setNetworkName(e.target.value)}
                        disabled={creating}
                    />
                    <select
                        className="dm-select"
                        value={driver}
                        onChange={e => setDriver(e.target.value)}
                        disabled={creating}
                        style={{ width: '120px' }}
                    >
                        <option value="bridge">bridge</option>
                        <option value="overlay">overlay</option>
                        <option value="macvlan">macvlan</option>
                    </select>
                    <button type="submit" className="dm-btn dm-btn-primary" disabled={creating}>
                        {creating ? '⏳ Creating...' : '🌐 Create Network'}
                    </button>
                </form>

                <div className="dm-search-wrapper" style={{ maxWidth: '300px' }}>
                    <span className="dm-search-icon">🔍</span>
                    <input
                        className="dm-input"
                        type="text"
                        placeholder="Search networks..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="dm-table-container">
                <table className="dm-table">
                    <thead>
                        <tr>
                            <th>Network ID</th>
                            <th>Name</th>
                            <th>Driver</th>
                            <th>Scope</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredNetworks.map((net: any, idx: number) => {
                            const isDefault = ['bridge', 'host', 'none'].includes(net.Name);
                            return (
                                <tr key={net.ID || idx}>
                                    <td style={{ fontFamily: 'var(--dm-font-mono)', fontSize: '0.8rem', color: 'var(--dm-cyan)' }}>{net.ID?.substring(0, 12)}</td>
                                    <td>
                                        <strong style={{ color: 'var(--dm-text-heading)' }}>{net.Name}</strong>{' '}
                                        {isDefault && <span className="dm-chip" style={{ fontSize: '0.7rem', opacity: 0.7 }}>System</span>}
                                    </td>
                                    <td><span className="dm-chip">{net.Driver || 'bridge'}</span></td>
                                    <td><span className="dm-chip">{net.Scope || 'local'}</span></td>
                                    <td style={{ textAlign: 'right' }}>
                                        {!isDefault ? (
                                            <button
                                                className="dm-action-btn danger"
                                                style={{ display: 'inline-flex' }}
                                                onClick={() => handleRemoveNetwork(net.ID || net.Name)}
                                                title="Remove Docker Network"
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                </svg>
                                                <span>Delete</span>
                                            </button>
                                        ) : (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--dm-text-dim)', fontStyle: 'italic' }}>Protected</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredNetworks.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--dm-text-muted)', fontStyle: 'italic' }}>
                                    No Docker networks found matching criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
