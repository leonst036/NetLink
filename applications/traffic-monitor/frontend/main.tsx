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

// Persistent fallback interface counters for frontend offline mode
const fallbackInterfaces = [
  { name: "eth0", rxBytes: 35000000, txBytes: 20000000, rxPackets: 14000, txPackets: 11000, baseRxSpeed: 420000, baseTxSpeed: 210000 },
  { name: "wlan0", rxBytes: 10200000, txBytes: 8900000, rxPackets: 4500, txPackets: 3200, baseRxSpeed: 90000, baseTxSpeed: 45000 }
];
let lastFallbackTimestamp = Date.now();

// Main Traffic Monitor App Component
export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isLive, setIsLive] = useState<boolean>(true);
  const [refreshRate, setRefreshRate] = useState<number>(1);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  const [localStats, setLocalStats] = useState<LocalTrafficStats | null>(null);
  const [relayStats, setRelayStats] = useState<RelayTrafficStats | null>(null);
  const [history, setHistory] = useState<TrafficHistoryPoint[]>([]);

  // Fetch telemetry stats from local server and cloud relay backends
  const fetchTelemetry = useCallback(async () => {
    let currentLocal: LocalTrafficStats | null = null;
    let currentRelay: RelayTrafficStats | null = null;
    let localOk = false;
    let relayOk = false;

    try {
      const resLocal = await fetch('/api/traffic-monitor/stats');
      if (resLocal.ok) {
        const data = await resLocal.json();
        if (data && typeof data.rxSpeed === 'number') {
          currentLocal = data;
          localOk = true;
        } else {
          throw new Error('Invalid stats format');
        }
      } else {
        throw new Error(`HTTP ${resLocal.status}`);
      }
    } catch {
      // Offline fallback: set speeds to 0 and preserve static interface byte counters
      const now = Date.now();
      const updatedInterfaces = fallbackInterfaces.map((iface) => ({
        name: iface.name,
        rxBytes: iface.rxBytes,
        txBytes: iface.txBytes,
        rxPackets: iface.rxPackets,
        txPackets: iface.txPackets,
        rxSpeed: 0,
        txSpeed: 0,
      }));

      currentLocal = {
        timestamp: now,
        totalRxBytes: fallbackInterfaces.reduce((sum, i) => sum + i.rxBytes, 0),
        totalTxBytes: fallbackInterfaces.reduce((sum, i) => sum + i.txBytes, 0),
        rxSpeed: 0,
        txSpeed: 0,
        activeConnections: 0,
        latencyMs: 0,
        interfaces: updatedInterfaces
      };
    }
    setLocalStats(currentLocal);

    try {
      const resRelay = await fetch('/api/traffic-monitor/relay-stats');
      if (resRelay.ok) {
        const data = await resRelay.json();
        if (data && typeof data.rxSpeed === 'number') {
          currentRelay = data;
          relayOk = true;
        } else {
          throw new Error('Invalid relay stats format');
        }
      } else {
        throw new Error(`HTTP ${resRelay.status}`);
      }
    } catch {
      // Offline fallback: set relay speeds and connections to 0
      currentRelay = {
        timestamp: Date.now(),
        relayRxBytes: 0,
        relayTxBytes: 0,
        rxSpeed: 0,
        txSpeed: 0,
        activeSockets: 0,
        activeTunnels: 0,
        latencyMs: 0,
        uptimeSeconds: 0
      };
    }
    setRelayStats(currentRelay);

    // Update connection offline state
    setIsOffline(!localOk && !relayOk);

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
  }, []);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

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
    <div className="tm-container">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} isLive={isLive} isOffline={isOffline} />

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
      <div className="tm-grid">
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <TrafficChart history={history} showLocal={true} showRelay={true} />
          <InterfaceTable interfaces={localStats?.interfaces} />
        </div>
      )}

      {activeTab === 'local' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="tm-grid">
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="tm-grid">
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <InterfaceTable interfaces={localStats?.interfaces} />
        </div>
      )}
    </div>
  );
}
