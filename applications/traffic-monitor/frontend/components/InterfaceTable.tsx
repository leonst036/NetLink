import React from 'react';
import { NetworkInterfaceStats } from '../types';
import { formatSpeed } from './TrafficChart';

interface InterfaceTableProps {
  interfaces?: NetworkInterfaceStats[];
}

// Utility to format total bytes into KB, MB, GB
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Table showing network interface breakdown
export default function InterfaceTable({ interfaces = [] }: InterfaceTableProps) {
  const safeList = Array.isArray(interfaces) ? interfaces : [];

  if (safeList.length === 0) {
    return (
      <div className="glass-panel">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: '20px' }}>memory</span>
          <h3 className="text-sm font-semibold text-slate-200">Network Interfaces Breakdown</h3>
        </div>
        <p className="text-xs text-slate-500 py-3 font-mono">Scanning active network interfaces...</p>
      </div>
    );
  }

  return (
    <div className="glass-panel">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: '20px' }}>memory</span>
        <h3 className="text-sm font-semibold text-slate-200">Network Interfaces Breakdown</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <th className="py-2.5 px-3">Interface</th>
              <th className="py-2.5 px-3">Download (RX) Speed</th>
              <th className="py-2.5 px-3">Upload (TX) Speed</th>
              <th className="py-2.5 px-3">Total Received</th>
              <th className="py-2.5 px-3">Total Transmitted</th>
              <th className="py-2.5 px-3">Packets (RX / TX)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {safeList.map((iface) => (
              <tr key={iface.name} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-3 font-mono font-medium text-cyan-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  {iface.name}
                </td>

                <td className="py-3 px-3 font-mono text-emerald-400 font-semibold">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-emerald-400" style={{ fontSize: '14px' }}>arrow_downward</span>
                    {formatSpeed(iface.rxSpeed || 0)}
                  </div>
                </td>

                <td className="py-3 px-3 font-mono text-cyan-400 font-semibold">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: '14px' }}>arrow_upward</span>
                    {formatSpeed(iface.txSpeed || 0)}
                  </div>
                </td>

                <td className="py-3 px-3 font-mono text-slate-300">
                  {formatBytes(iface.rxBytes || 0)}
                </td>

                <td className="py-3 px-3 font-mono text-slate-300">
                  {formatBytes(iface.txBytes || 0)}
                </td>

                <td className="py-3 px-3 font-mono text-slate-400">
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
