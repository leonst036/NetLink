import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import MetricCard from './components/MetricCard';
import TrafficChart, { formatSpeed } from './components/TrafficChart';
import InterfaceTable from './components/InterfaceTable';
import ControlBar from './components/ControlBar';
import { LocalTrafficStats, RelayTrafficStats, TrafficHistoryPoint, ActiveTab } from './types';

// Format total byte volume safely
function formatBytes(bytes?: number): string {
  const num = typeof bytes === 'number' && !isNaN(bytes) ? bytes : 0;
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(2)} MB`;
  return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Main Traffic Monitor App Component
export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isLive, setIsLive] = useState<boolean>(true);
  const [refreshRate, setRefreshRate] = useState<number>(1);

  const [localStats, setLocalStats] = useState<LocalTrafficStats | null>(null);
  const [relayStats, setRelayStats] = useState<RelayTrafficStats | null>(null);
  const [history, setHistory] = useState<TrafficHistoryPoint[]>([]);

  // Fetch telemetry stats from local server and cloud relay backends
  const fetchTelemetry = useCallback(async () => {
    let currentLocal: LocalTrafficStats | null = localStats;
    let currentRelay: RelayTrafficStats | null = relayStats;

    try {
      const resLocal = await fetch('/api/traffic-monitor/stats');
      if (resLocal.ok) {
        currentLocal = await resLocal.json();
        setLocalStats(currentLocal);
      }
    } catch {
      // Fallback mock local stats if server unreachable
      currentLocal = {
        timestamp: Date.now(),
        totalRxBytes: 45200000 + Math.floor(Math.random() * 100000),
        totalTxBytes: 28900000 + Math.floor(Math.random() * 80000),
        rxSpeed: Math.floor(Math.random() * 500000) + 100000,
        txSpeed: Math.floor(Math.random() * 300000) + 50000,
        activeConnections: Math.floor(Math.random() * 12) + 4,
        latencyMs: Math.floor(Math.random() * 6) + 2,
        interfaces: [
          { name: "eth0", rxBytes: 35000000, txBytes: 20000000, rxPackets: 14000, txPackets: 11000, rxSpeed: 420000, txSpeed: 210000 },
          { name: "wlan0", rxBytes: 10200000, txBytes: 8900000, rxPackets: 4500, txPackets: 3200, rxSpeed: 90000, txSpeed: 45000 }
        ]
      };
      setLocalStats(currentLocal);
    }

    try {
      const resRelay = await fetch('/api/traffic-monitor/relay-stats');
      if (resRelay.ok) {
        currentRelay = await resRelay.json();
        setRelayStats(currentRelay);
      }
    } catch {
      // Fallback mock relay stats if server unreachable
      currentRelay = {
        timestamp: Date.now(),
        relayRxBytes: 120500000 + Math.floor(Math.random() * 200000),
        relayTxBytes: 84000000 + Math.floor(Math.random() * 150000),
        rxSpeed: Math.floor(Math.random() * 800000) + 200000,
        txSpeed: Math.floor(Math.random() * 600000) + 150000,
        activeSockets: Math.floor(Math.random() * 10) + 3,
        activeTunnels: 2,
        latencyMs: Math.floor(Math.random() * 20) + 10,
        uptimeSeconds: 3600
      };
      setRelayStats(currentRelay);
    }

    // Append to live history
    const now = new Date();
    const timeLabel = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    const newPoint: TrafficHistoryPoint = {
      timeLabel,
      timestamp: Date.now(),
      localRxSpeed: currentLocal?.rxSpeed || 0,
      localTxSpeed: currentLocal?.txSpeed || 0,
      relayRxSpeed: currentRelay?.rxSpeed || 0,
      relayTxSpeed: currentRelay?.txSpeed || 0,
    };

    setHistory((prev) => {
      const updated = [...prev, newPoint];
      return updated.slice(-30);
    });
  }, [localStats, relayStats]);

  useEffect(() => {
    fetchTelemetry();
  }, []);

  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => {
      fetchTelemetry();
    }, refreshRate * 1000);
    return () => clearInterval(timer);
  }, [isLive, refreshRate, fetchTelemetry]);

  // Export history log as JSON file
  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(history, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `traffic-monitor-log-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  return (
    <div className="traffic-monitor-container">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} isLive={isLive} />

      <ControlBar
        isLive={isLive}
        setIsLive={setIsLive}
        refreshRate={refreshRate}
        setRefreshRate={setRefreshRate}
        onRefresh={fetchTelemetry}
        onClearHistory={handleClearHistory}
        onExport={handleExport}
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Local Download Rate"
          value={formatSpeed(localStats?.rxSpeed)}
          subtitle={`Total: ${formatBytes(localStats?.totalRxBytes)}`}
          iconName="arrow_downward"
          colorTheme="emerald"
        />

        <MetricCard
          title="Local Upload Rate"
          value={formatSpeed(localStats?.txSpeed)}
          subtitle={`Total: ${formatBytes(localStats?.totalTxBytes)}`}
          iconName="arrow_upward"
          colorTheme="cyan"
        />

        <MetricCard
          title="Relay Cloud Bandwidth"
          value={formatSpeed((relayStats?.rxSpeed || 0) + (relayStats?.txSpeed || 0))}
          subtitle={`Sockets: ${relayStats?.activeSockets || 0} active`}
          iconName="public"
          colorTheme="indigo"
        />

        <MetricCard
          title="Local Edge Latency"
          value={`${localStats?.latencyMs ?? 0} ms`}
          subtitle={`Relay: ${relayStats?.latencyMs ?? 0} ms`}
          iconName="bolt"
          colorTheme="amber"
        />
      </div>

      {/* Main Tab Content Views */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6">
          <TrafficChart history={history} showLocal={true} showRelay={true} />
          <InterfaceTable interfaces={localStats?.interfaces} />
        </div>
      )}

      {activeTab === 'local' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
            <MetricCard
              title="Active TCP Sockets"
              value={`${localStats?.activeConnections || 0}`}
              subtitle="Local server open sockets"
              iconName="wifi"
              colorTheme="cyan"
            />
            <MetricCard
              title="Total Data In"
              value={formatBytes(localStats?.totalRxBytes)}
              subtitle="Local Interface RX counter"
              iconName="hard_drive"
              colorTheme="emerald"
            />
            <MetricCard
              title="Total Data Out"
              value={formatBytes(localStats?.totalTxBytes)}
              subtitle="Local Interface TX counter"
              iconName="dns"
              colorTheme="indigo"
            />
          </div>
          <TrafficChart history={history} showLocal={true} showRelay={false} />
          <InterfaceTable interfaces={localStats?.interfaces} />
        </div>
      )}

      {activeTab === 'relay' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
            <MetricCard
              title="Relay RX Volume"
              value={formatBytes(relayStats?.relayRxBytes)}
              subtitle="Cloud relay data received"
              iconName="public"
              colorTheme="indigo"
            />
            <MetricCard
              title="Relay TX Volume"
              value={formatBytes(relayStats?.relayTxBytes)}
              subtitle="Cloud relay data sent"
              iconName="arrow_upward"
              colorTheme="amber"
            />
            <MetricCard
              title="Relay Tunnels"
              value={`${relayStats?.activeTunnels || 0}`}
              subtitle="Active encrypted WebSocket tunnels"
              iconName="bolt"
              colorTheme="emerald"
            />
          </div>
          <TrafficChart history={history} showLocal={false} showRelay={true} />
        </div>
      )}

      {activeTab === 'interfaces' && (
        <div className="flex flex-col gap-6">
          <InterfaceTable interfaces={localStats?.interfaces} />
        </div>
      )}
    </div>
  );
}
