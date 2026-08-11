import React from 'react';
import { TrafficHistoryPoint } from '../types';

interface TrafficChartProps {
  history?: TrafficHistoryPoint[];
  showLocal?: boolean;
  showRelay?: boolean;
}

// Utility to format bytes per second to human readable format
export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
}

// SVG traffic chart showing live bandwidth rate history
export default function TrafficChart({ history = [], showLocal = true, showRelay = true }: TrafficChartProps) {
  const safeHistory = Array.isArray(history) ? history : [];

  if (safeHistory.length === 0) {
    return (
      <div className="glass-panel h-64 flex items-center justify-center text-slate-500 text-sm">
        Waiting for traffic data stream...
      </div>
    );
  }

  // Calculate maximum value for chart scaling
  let maxSpeed = 1000;
  for (const p of safeHistory) {
    if (showLocal) {
      maxSpeed = Math.max(maxSpeed, p.localRxSpeed || 0, p.localTxSpeed || 0);
    }
    if (showRelay) {
      maxSpeed = Math.max(maxSpeed, p.relayRxSpeed || 0, p.relayTxSpeed || 0);
    }
  }

  const width = 800;
  const height = 240;
  const padding = 35;

  const pointsCount = safeHistory.length;
  const stepX = (width - padding * 2) / Math.max(pointsCount - 1, 1);

  // Generate SVG path string from values array
  const createPath = (getVal: (p: TrafficHistoryPoint) => number) => {
    return safeHistory
      .map((p, index) => {
        const x = padding + index * stepX;
        const val = getVal(p);
        const y = height - padding - (val / maxSpeed) * (height - padding * 2);
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const localRxPath = createPath((p) => p.localRxSpeed || 0);
  const localTxPath = createPath((p) => p.localTxSpeed || 0);
  const relayRxPath = createPath((p) => p.relayRxSpeed || 0);
  const relayTxPath = createPath((p) => p.relayTxSpeed || 0);

  return (
    <div className="glass-panel">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Live Throughput Graph</h3>

        <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
          {showLocal && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-400 rounded-full" />
                <span className="text-slate-300">Local RX</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-cyan-400 rounded-full" />
                <span className="text-slate-300">Local TX</span>
              </div>
            </>
          )}

          {showRelay && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-indigo-400 rounded-full" />
                <span className="text-slate-300">Relay RX</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-amber-400 rounded-full" />
                <span className="text-slate-300">Relay TX</span>
              </div>
            </>
          )}

          <div className="text-slate-400 border-l border-slate-700 pl-3">
            Peak: <span className="text-slate-200 font-mono">{formatSpeed(maxSpeed)}</span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {/* Y Axis Grid Lines */}
          {[0, 0.33, 0.66, 1].map((ratio, idx) => {
            const y = height - padding - ratio * (height - padding * 2);
            const labelVal = maxSpeed * ratio;
            return (
              <g key={idx}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="4,4" />
                <text x={padding - 6} y={y + 3} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
                  {formatSpeed(labelVal)}
                </text>
              </g>
            );
          })}

          {/* Time Labels X Axis */}
          {safeHistory.map((p, idx) => {
            if (idx % Math.ceil(safeHistory.length / 5) !== 0 && idx !== safeHistory.length - 1) return null;
            const x = padding + idx * stepX;
            return (
              <text key={idx} x={x} y={height - 10} textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="monospace">
                {p.timeLabel}
              </text>
            );
          })}

          {/* Paths for Local Server */}
          {showLocal && (
            <>
              <path d={localRxPath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d={localTxPath} fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}

          {/* Paths for Relay Cloud */}
          {showRelay && (
            <>
              <path d={relayRxPath} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d={relayTxPath} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
