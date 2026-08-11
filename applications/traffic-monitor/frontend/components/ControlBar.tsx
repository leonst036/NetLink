import { Play, Pause, RefreshCw, Trash2, Download } from 'lucide-react';

interface ControlBarProps {
  isLive: boolean;
  setIsLive: (live: boolean) => void;
  refreshRate: number; // in seconds
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
    <div className="glass-panel flex flex-wrap items-center justify-between gap-4 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setIsLive(!isLive)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            isLive
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
              : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
          }`}
        >
          {isLive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isLive ? 'Pause Stream' : 'Resume Live'}
        </button>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-slate-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Now
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-400 pl-2 border-l border-slate-800">
          <span>Interval:</span>
          {[1, 2, 5].map((sec) => (
            <button
              key={sec}
              onClick={() => setRefreshRate(sec)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                refreshRate === sec
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-semibold'
                  : 'hover:text-slate-200'
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export Log
        </button>

        <button
          onClick={onClearHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Graph
        </button>
      </div>
    </div>
  );
}
