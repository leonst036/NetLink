import React from 'react';

interface ControlBarProps {
  isLive: boolean;
  setIsLive: (live: boolean) => void;
  refreshRate: number;
  setRefreshRate: (rate: number) => void;
  onRefresh: () => void;
  onClearHistory: () => void;
  onExport: () => void;
}

// Controls bar for toggling live stream and clearing history
export default function ControlBar({
  isLive,
  setIsLive,
  refreshRate,
  setRefreshRate,
  onRefresh,
  onClearHistory,
  onExport
}: ControlBarProps) {
  return (
    <div className="tm-glass-card tm-toolbar">
      <div className="tm-toolbar-left">
        <button
          onClick={() => setIsLive(!isLive)}
          className={`tm-btn ${isLive ? '' : 'tm-btn-primary'}`}
        >
          <span className="material-symbols-outlined">
            {isLive ? 'pause' : 'play_arrow'}
          </span>
          {isLive ? 'Pause Stream' : 'Resume Live'}
        </button>

        <button onClick={onRefresh} className="tm-btn">
          <span className="material-symbols-outlined">refresh</span>
          Refresh Now
        </button>

        <div className="tm-interval-group">
          <span>Interval:</span>
          {[1, 2, 5].map((sec) => (
            <button
              key={sec}
              onClick={() => setRefreshRate(sec)}
              className={`tm-pill-btn ${refreshRate === sec ? 'active' : ''}`}
            >
              {sec}s
            </button>
          ))}
        </div>
      </div>

      <div className="tm-toolbar-right">
        <button onClick={onExport} className="tm-btn">
          <span className="material-symbols-outlined">download</span>
          Export Log
        </button>

        <button onClick={onClearHistory} className="tm-btn tm-btn-danger">
          <span className="material-symbols-outlined">delete</span>
          Clear Graph
        </button>
      </div>
    </div>
  );
}
