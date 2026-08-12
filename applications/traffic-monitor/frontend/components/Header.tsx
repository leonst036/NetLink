import React from 'react';
import { ActiveTab } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isLive: boolean;
}

// Header navigation component
export default function Header({ activeTab, setActiveTab, isLive }: HeaderProps) {
  return (
    <div className="tm-header">
      <div className="tm-brand">
        <div className="tm-brand-icon">
          <span className="material-symbols-outlined">monitoring</span>
        </div>
        <div className="tm-title-group">
          <div className="tm-title-row">
            <h1 className="tm-title">Traffic Monitor</h1>
            <span className="tm-badge-live">
              <span className={isLive ? "tm-pulse-dot" : ""} />
              {isLive ? "LIVE" : "PAUSED"}
            </span>
          </div>
          <p className="tm-subtitle">Traffic monitor for Relay and Local Server.</p>
        </div>
      </div>

      <div className="tm-tabs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`tm-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
        >
          <span className="material-symbols-outlined">layers</span>
          Overview
        </button>

        <button
          onClick={() => setActiveTab('local')}
          className={`tm-tab-btn ${activeTab === 'local' ? 'active' : ''}`}
        >
          <span className="material-symbols-outlined">dns</span>
          Local Server
        </button>

        <button
          onClick={() => setActiveTab('relay')}
          className={`tm-tab-btn ${activeTab === 'relay' ? 'active' : ''}`}
        >
          <span className="material-symbols-outlined">public</span>
          Relay Cloud
        </button>

        <button
          onClick={() => setActiveTab('interfaces')}
          className={`tm-tab-btn ${activeTab === 'interfaces' ? 'active' : ''}`}
        >
          <span className="material-symbols-outlined">memory</span>
          Interfaces
        </button>
      </div>
    </div>
  );
}
