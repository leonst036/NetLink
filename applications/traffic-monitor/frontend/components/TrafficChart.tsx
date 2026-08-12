import React, { useState } from 'react';
import { TrafficHistoryPoint } from '../types';

interface TrafficChartProps {
  history?: TrafficHistoryPoint[];
  showLocal?: boolean;
  showRelay?: boolean;
}

// Utility to format bytes per second to human readable format safely
export function formatSpeed(bytesPerSec?: number): string {
  const num = typeof bytesPerSec === 'number' && !isNaN(bytesPerSec) ? bytesPerSec : 0;
  if (num < 1024) return `${num} B/s`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB/s`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB/s`;
}

// SVG traffic chart showing live bandwidth rate history
export default function TrafficChart({ history = [], showLocal = true, showRelay = true }: TrafficChartProps) {
  const safeHistory = Array.isArray(history) ? history : [];

  // Toggle visibility state for each metric line
  const [visibleLines, setVisibleLines] = useState({
    localRx: true,
    localTx: true,
    relayRx: true,
    relayTx: true,
  });

  const toggleLine = (line: keyof typeof visibleLines) => {
    setVisibleLines((prev) => ({ ...prev, [line]: !prev[line] }));
  };

  if (safeHistory.length === 0) {
    return (
      <div className="tm-glass-card" style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tm-text-muted)', fontSize: '0.85rem' }}>
        Waiting for traffic telemetry stream...
      </div>
    );
  }

  // Calculate maximum value for chart scaling based on visible lines
  let maxSpeed = 1000;
  for (const p of safeHistory) {
    if (showLocal) {
      if (visibleLines.localRx) maxSpeed = Math.max(maxSpeed, p.localRxSpeed || 0);
      if (visibleLines.localTx) maxSpeed = Math.max(maxSpeed, p.localTxSpeed || 0);
    }
    if (showRelay) {
      if (visibleLines.relayRx) maxSpeed = Math.max(maxSpeed, p.relayRxSpeed || 0);
      if (visibleLines.relayTx) maxSpeed = Math.max(maxSpeed, p.relayTxSpeed || 0);
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
    <div className="tm-glass-card">
      <div className="tm-chart-header">
        <h3 className="tm-chart-title">Live Throughput Graph</h3>

        <div className="tm-legend">
          {showLocal && (
            <>
              <div
                className={`tm-legend-item ${!visibleLines.localRx ? 'hidden' : ''}`}
                onClick={() => toggleLine('localRx')}
                title="Toggle Local RX line"
              >
                <span className="tm-legend-dot" style={{ background: 'var(--tm-emerald)' }} />
                <span>Local RX</span>
              </div>
              <div
                className={`tm-legend-item ${!visibleLines.localTx ? 'hidden' : ''}`}
                onClick={() => toggleLine('localTx')}
                title="Toggle Local TX line"
              >
                <span className="tm-legend-dot" style={{ background: 'var(--tm-cyan)' }} />
                <span>Local TX</span>
              </div>
            </>
          )}

          {showRelay && (
            <>
              <div
                className={`tm-legend-item ${!visibleLines.relayRx ? 'hidden' : ''}`}
                onClick={() => toggleLine('relayRx')}
                title="Toggle Relay RX line"
              >
                <span className="tm-legend-dot" style={{ background: 'var(--tm-indigo)' }} />
                <span>Relay RX</span>
              </div>
              <div
                className={`tm-legend-item ${!visibleLines.relayTx ? 'hidden' : ''}`}
                onClick={() => toggleLine('relayTx')}
                title="Toggle Relay TX line"
              >
                <span className="tm-legend-dot" style={{ background: 'var(--tm-amber)' }} />
                <span>Relay TX</span>
              </div>
            </>
          )}

          <div style={{ paddingLeft: '12px', borderLeft: '1px solid var(--tm-border)', color: 'var(--tm-text-muted)' }}>
            Peak: <span className="tm-mono" style={{ color: 'var(--tm-text-heading)' }}>{formatSpeed(maxSpeed)}</span>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
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

          {safeHistory.map((p, idx) => {
            if (idx % Math.ceil(safeHistory.length / 5) !== 0 && idx !== safeHistory.length - 1) return null;
            const x = padding + idx * stepX;
            return (
              <text key={idx} x={x} y={height - 10} textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="monospace">
                {p.timeLabel}
              </text>
            );
          })}

          {showLocal && (
            <>
              {visibleLines.localRx && (
                <path d={localRxPath} fill="none" stroke="var(--tm-emerald)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              )}
              {visibleLines.localTx && (
                <path d={localTxPath} fill="none" stroke="var(--tm-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </>
          )}

          {showRelay && (
            <>
              {visibleLines.relayRx && (
                <path d={relayRxPath} fill="none" stroke="var(--tm-indigo)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              )}
              {visibleLines.relayTx && (
                <path d={relayTxPath} fill="none" stroke="var(--tm-amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

