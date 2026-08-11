import React from 'react';
import { NetworkInterfaceStats } from '../types';
import { formatSpeed } from './TrafficChart';

interface InterfaceTableProps {
  interfaces?: NetworkInterfaceStats[];
}

// Utility to format total bytes into KB, MB, GB
function formatBytes(bytes?: number): string {
  const num = typeof bytes === 'number' && !isNaN(bytes) ? bytes : 0;
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(2)} MB`;
  return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Table showing network interface breakdown
export default function InterfaceTable({ interfaces = [] }: InterfaceTableProps) {
  const safeList = Array.isArray(interfaces) ? interfaces : [];

  if (safeList.length === 0) {
    return (
      <div className="tm-glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--tm-cyan)' }}>memory</span>
          <h3 className="tm-chart-title">Network Interfaces Breakdown</h3>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--tm-text-muted)', fontFamily: 'var(--tm-font-mono)', margin: 0 }}>Scanning network interfaces...</p>
      </div>
    );
  }

  return (
    <div className="tm-glass-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--tm-cyan)' }}>memory</span>
        <h3 className="tm-chart-title">Network Interfaces Breakdown</h3>
      </div>

      <div className="tm-table-wrapper">
        <table className="tm-table">
          <thead>
            <tr>
              <th>Interface</th>
              <th>Download (RX) Speed</th>
              <th>Upload (TX) Speed</th>
              <th>Total Received</th>
              <th>Total Transmitted</th>
              <th>Packets (RX / TX)</th>
            </tr>
          </thead>
          <tbody>
            {safeList.map((iface) => (
              <tr key={iface.name}>
                <td className="tm-mono" style={{ color: 'var(--tm-cyan)', fontWeight: 600 }}>
                  {iface.name}
                </td>

                <td className="tm-mono" style={{ color: 'var(--tm-emerald)', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--tm-emerald)' }}>arrow_downward</span>
                    {formatSpeed(iface.rxSpeed)}
                  </div>
                </td>

                <td className="tm-mono" style={{ color: 'var(--tm-cyan)', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--tm-cyan)' }}>arrow_upward</span>
                    {formatSpeed(iface.txSpeed)}
                  </div>
                </td>

                <td className="tm-mono">{formatBytes(iface.rxBytes)}</td>
                <td className="tm-mono">{formatBytes(iface.txBytes)}</td>

                <td className="tm-mono" style={{ color: 'var(--tm-text-muted)' }}>
                  {(iface.rxPackets || 0).toLocaleString()} / {(iface.txPackets || 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
