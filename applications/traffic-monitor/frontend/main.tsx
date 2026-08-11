import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import MetricCard from './components/MetricCard';
import TrafficChart, { formatSpeed } from './components/TrafficChart';
import InterfaceTable from './components/InterfaceTable';
import ControlBar from './components/ControlBar';
import { LocalTrafficStats, RelayTrafficStats, TrafficHistoryPoint, ActiveTab } from './types';
import { ArrowDown, ArrowUp, HardDrive, Wifi, Server, Globe, Zap } from 'lucide-react';
import './styles.css';

// Format total byte volume
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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
      return updated.slice(-30); // Keep last 30 data points
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
          value={localStats ? formatSpeed(localStats.rxSpeed) : '0 B/s'}
          subtitle={`Total: ${localStats ? formatBytes(localStats.totalRxBytes) : '0 B'}`}
          icon={ArrowDown}
          colorTheme="emerald"
        />

        <MetricCard
          title="Local Upload Rate"
          value={localStats ? formatSpeed(localStats.txSpeed) : '0 B/s'}
          subtitle={`Total: ${localStats ? formatBytes(localStats.totalTxBytes) : '0 B'}`}
          icon={ArrowUp}
          colorTheme="cyan"
        />

        <MetricCard
          title="Relay Cloud Bandwidth"
          value={relayStats ? formatSpeed(relayStats.rxSpeed + relayStats.txSpeed) : '0 B/s'}
          subtitle={`Sockets: ${relayStats?.activeSockets || 0} active`}
          icon={Globe}
          colorTheme="indigo"
        />

        <MetricCard
          title="Local Edge Latency"
          value={localStats ? `${localStats.latencyMs} ms` : '0 ms'}
          subtitle={`Relay: ${relayStats ? `${relayStats.latencyMs} ms` : '0 ms'}`}
          icon={Zap}
          colorTheme="amber"
        />
      </div>

      {/* Main Tab Content Views */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6">
          <TrafficChart history={history} showLocal={true} showRelay={true} />
          {localStats && <InterfaceTable interfaces={localStats.interfaces} />}
        </div>
      )}

      {activeTab === 'local' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
            <MetricCard
              title="Active TCP Sockets"
              value={`${localStats?.activeConnections || 0}`}
              subtitle="Local server open sockets"
              icon={Wifi}
              colorTheme="cyan"
            />
            <MetricCard
              title="Total Data In"
              value={localStats ? formatBytes(localStats.totalRxBytes) : '0 B'}
              subtitle="Local Interface RX counter"
              icon={HardDrive}
              colorTheme="emerald"
            />
            <MetricCard
              title="Total Data Out"
              value={localStats ? formatBytes(localStats.totalTxBytes) : '0 B'}
              subtitle="Local Interface TX counter"
              icon={Server}
              colorTheme="indigo"
            />
          </div>
          <TrafficChart history={history} showLocal={true} showRelay={false} />
          {localStats && <InterfaceTable interfaces={localStats.interfaces} />}
        </div>
      )}

      {activeTab === 'relay' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
            <MetricCard
              title="Relay RX Volume"
              value={relayStats ? formatBytes(relayStats.relayRxBytes) : '0 B'}
              subtitle="Cloud relay data received"
              icon={Globe}
              colorTheme="indigo"
            />
            <MetricCard
              title="Relay TX Volume"
              value={relayStats ? formatBytes(relayStats.relayTxBytes) : '0 B'}
              subtitle="Cloud relay data sent"
              icon={ArrowUp}
              colorTheme="amber"
            />
            <MetricCard
              title="Relay Tunnels"
              value={`${relayStats?.activeTunnels || 0}`}
              subtitle="Active encrypted WebSocket tunnels"
              icon={Zap}
              colorTheme="emerald"
            />
          </div>
          <TrafficChart history={history} showLocal={false} showRelay={true} />
        </div>
      )}

      {activeTab === 'interfaces' && (
        <div className="flex flex-col gap-6">
          {localStats && <InterfaceTable interfaces={localStats.interfaces} />}
        </div>
      )}
    </div>
  );
}
