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
            <div className="dm-action-bar">
                <form onSubmit={onCreateSubmit} className="dm-form-inline">
                    <input
                        className="dm-input"
                        type="text"
                        placeholder="Network Name (e.g. backend-net, isolated-network)"
                        value={networkName}
                        onChange={e => setNetworkName(e.target.value)}
                        disabled={creating}
                    />
                    <select
                        className="dm-input"
                        value={driver}
                        onChange={e => setDriver(e.target.value)}
                        disabled={creating}
                        style={{ width: '130px' }}
                    >
                        <option value="bridge">bridge</option>
                        <option value="overlay">overlay</option>
                        <option value="macvlan">macvlan</option>
                    </select>
                    <button type="submit" className="nl-button" disabled={creating} style={{ whiteSpace: 'nowrap' }}>
                        {creating ? '⏳ Creating...' : '🌐 Create Network'}
                    </button>
                </form>

                <div className="dm-search-input-wrapper">
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

            <div className="dm-table-wrapper">
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
                                    <td className="dm-code">{net.ID?.substring(0, 12)}</td>
                                    <td>
                                        <strong style={{ color: '#fff' }}>{net.Name}</strong>{' '}
                                        {isDefault && <span className="dm-chip" style={{ fontSize: '0.7rem', opacity: 0.8 }}>System</span>}
                                    </td>
                                    <td><span className="dm-chip dm-chip-primary">{net.Driver || 'bridge'}</span></td>
                                    <td><span className="dm-chip">{net.Scope || 'local'}</span></td>
                                    <td style={{ textAlign: 'right' }}>
                                        {!isDefault ? (
                                            <button
                                                className="dm-action-btn danger"
                                                style={{ display: 'inline-flex' }}
                                                onClick={() => handleRemoveNetwork(net.ID || net.Name)}
                                                title="Remove Docker Network"
                                            >
                                                🗑️ Delete
                                            </button>
                                        ) : (
                                            <span className="dm-terminal-muted" style={{ fontSize: '0.8rem' }}>🔒 Protected</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredNetworks.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--dm-text-muted)' }}>
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

