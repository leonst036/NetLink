import { NetworkInterfaceStats } from '../types';
import { formatSpeed } from './TrafficChart';
import { ArrowDown, ArrowUp, Cpu } from 'lucide-react';

interface InterfaceTableProps {
  interfaces: NetworkInterfaceStats[];
}

// Utility to format total bytes into KB, MB, GB
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Table showing network interface breakdown
export default function InterfaceTable({ interfaces }: InterfaceTableProps) {
  return (
    <div className="glass-panel">
      <div className="flex items-center gap-2 mb-4">
        <Cpu className="w-4 h-4 text-cyan-400" />
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
            {interfaces.map((iface) => (
              <tr key={iface.name} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-3 font-mono font-medium text-cyan-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  {iface.name}
                </td>

                <td className="py-3 px-3 font-mono text-emerald-400 font-semibold">
                  <div className="flex items-center gap-1">
                    <ArrowDown className="w-3 h-3 text-emerald-400" />
                    {formatSpeed(iface.rxSpeed)}
                  </div>
                </td>

                <td className="py-3 px-3 font-mono text-cyan-400 font-semibold">
                  <div className="flex items-center gap-1">
                    <ArrowUp className="w-3 h-3 text-cyan-400" />
                    {formatSpeed(iface.txSpeed)}
                  </div>
                </td>

                <td className="py-3 px-3 font-mono text-slate-300">
                  {formatBytes(iface.rxBytes)}
                </td>

                <td className="py-3 px-3 font-mono text-slate-300">
                  {formatBytes(iface.txBytes)}
                </td>

                <td className="py-3 px-3 font-mono text-slate-400">
                  {iface.rxPackets.toLocaleString()} / {iface.txPackets.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
