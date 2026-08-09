import React from 'react';

export default function VolumesTab({ volumes, handleRemoveVolume }: any) {
    return (
        <div className="nl-panel dm-table-wrapper">
            <table className="dm-table">
                <thead>
                    <tr>
                        <th>Driver</th>
                        <th>Volume Name</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {volumes.map((vol: any, idx: number) => (
                        <tr key={vol.Name || idx}>
                            <td>{vol.Driver || 'local'}</td>
                            <td className="dm-code">{vol.Name}</td>
                            <td>
                                <button className="nl-button danger" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => handleRemoveVolume(vol.Name)}>
                                    Remove
                                </button>
                            </td>
                        </tr>
                    ))}
                    {volumes.length === 0 && (
                        <tr>
                            <td colSpan={3} style={{ textAlign: 'center', padding: '32px' }}>
                                No Docker volumes found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
