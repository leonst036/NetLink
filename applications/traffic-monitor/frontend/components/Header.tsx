import React from 'react';
import { ActiveTab } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isLive: boolean;
}

// Header component with navigation tabs and status
export default function Header({ activeTab, setActiveTab, isLive }: HeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400 flex items-center justify-center">
          <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>monitoring</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100 tracking-wide">Traffic Monitor</h1>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className={isLive ? "pulse-dot" : "w-2 h-2 rounded-full bg-slate-500"} />
              {isLive ? "LIVE" : "PAUSED"}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Real-time bandwidth and network telemetry for Local Server & Relay</p>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'overview'
              ? 'bg-cyan-500 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>layers</span>
          Overview
        </button>

        <button
          onClick={() => setActiveTab('local')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'local'
              ? 'bg-cyan-500 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>dns</span>
          Local Server
        </button>

        <button
          onClick={() => setActiveTab('relay')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'relay'
              ? 'bg-cyan-500 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>public</span>
          Relay Cloud
        </button>

        <button
          onClick={() => setActiveTab('interfaces')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'interfaces'
              ? 'bg-cyan-500 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>memory</span>
          Interfaces
        </button>
      </div>
    </div>
  );
}
