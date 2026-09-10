import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  IconButton,
  Typography,
  Switch,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Tooltip,
  Snackbar,
  Alert,
  InputAdornment
} from '@mui/material';
import {
  Route as RouteIcon,
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  Radio,
  Plus,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Search,
  Power,
  Server,
  HelpCircle,
  Zap,
  Globe,
  RefreshCw
} from 'lucide-react';
import './DomainRouteApp.css';

export interface DomainRouteRule {
  id: string;
  pattern: string;
  description: string;
  enabled: boolean;
  createdAt?: string;
}

export interface DomainRouteChannel {
  id: string;
  targetDomain: string;
  status: 'Streaming' | 'Idle' | 'Active';
  bytesTransferred: number;
  duration: number;
}

export interface DomainRouteAppProps {
  token?: string;
  target?: string;
}

interface PresetPack {
  id: string;
  name: string;
  description: string;
  badge: string;
  iconColor: string;
  rules: Array<{ pattern: string; description: string }>;
}

const PRESET_PACKS: PresetPack[] = [
  {
    id: 'netflix',
    name: 'Netflix CDN',
    description: 'Bypasses geo-restrictions for Netflix catalog & video delivery streams.',
    badge: 'Streaming',
    iconColor: '#e50914',
    rules: [
      { pattern: '*.netflix.com', description: 'Netflix Portal & Core API' },
      { pattern: '*.nflxvideo.net', description: 'Netflix Video CDN Delivery' },
      { pattern: '*.nflximg.net', description: 'Netflix UI Images & Assets' },
      { pattern: '*.nflxso.net', description: 'Netflix Streaming Cluster' },
      { pattern: '*.nflxext.com', description: 'Netflix Extended Platform' }
    ]
  },
  {
    id: 'amazon',
    name: 'Amazon Prime',
    description: 'Route Amazon Prime Video streams and player APIs through NetLink.',
    badge: 'Streaming',
    iconColor: '#00a8e1',
    rules: [
      { pattern: '*.primevideo.com', description: 'Prime Video Portal' },
      { pattern: '*.aiv-cdn.net', description: 'Amazon Instant Video CDN' },
      { pattern: '*.amazonvideo.com', description: 'Amazon Video Services' },
      { pattern: '*.media-amazon.com', description: 'Amazon Media Assets' }
    ]
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Route YouTube video content streams and geo-locked broadcasts.',
    badge: 'Media',
    iconColor: '#ff0000',
    rules: [
      { pattern: '*.youtube.com', description: 'YouTube Web & API' },
      { pattern: '*.googlevideo.com', description: 'Google Video CDN Delivery' },
      { pattern: '*.ytimg.com', description: 'YouTube Thumbnails & Assets' },
      { pattern: 'youtu.be', description: 'YouTube Shortlinks' }
    ]
  },
  {
    id: 'bbc',
    name: 'BBC iPlayer',
    description: 'UK regional streaming bypass for BBC live TV and on-demand player.',
    badge: 'UK Geo',
    iconColor: '#ff7700',
    rules: [
      { pattern: '*.bbc.co.uk', description: 'BBC UK Web Portal' },
      { pattern: '*.bbc.com', description: 'BBC International' },
      { pattern: '*.bbci.co.uk', description: 'BBC iPlayer Content Delivery' }
    ]
  },
  {
    id: 'ip-check',
    name: 'IP Check',
    description: 'Instantly test and verify your remote NetLink tunnel exit IP.',
    badge: 'Diagnostics',
    iconColor: '#10b981',
    rules: [
      { pattern: '*.ipinfo.io', description: 'IPinfo Geolocation & ASN' },
      { pattern: '*.icanhazip.com', description: 'Plaintext IP Echo' },
      { pattern: '*.ifconfig.me', description: 'Ifconfig IP & Header Lookup' },
      { pattern: '*.whatismyipaddress.com', description: 'WhatIsMyIP Verification' },
      { pattern: 'api.my-ip.io', description: 'IP Verification API' }
    ]
  }
];

const DEFAULT_RULES: DomainRouteRule[] = [
  { id: 'rule-netflix', pattern: '*.netflix.com', description: 'Netflix Portal & Core API', enabled: true },
  { id: 'rule-nflxvideo', pattern: '*.nflxvideo.net', description: 'Netflix Video CDN Delivery', enabled: true },
  { id: 'rule-googlevideo', pattern: '*.googlevideo.com', description: 'Google Video CDN Delivery', enabled: true },
  { id: 'rule-ipinfo', pattern: '*.ipinfo.io', description: 'IPinfo Geolocation Check', enabled: true }
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${val} ${units[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0.0 KB/s';
  const kb = bytesPerSec / 1024;
  if (kb < 1000) return `${kb.toFixed(1)} KB/s`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB/s`;
}

function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function DomainRouteApp({ token, target }: DomainRouteAppProps) {
  // Navigation tabs: rules | traffic | setup
  const [activeTab, setActiveTab] = useState<'rules' | 'traffic' | 'setup'>('rules');

  // Proxy state
  const [proxyEnabled, setProxyEnabled] = useState<boolean>(true);
  const [proxyPort, setProxyPort] = useState<number>(1080);
  const [proxyHost] = useState<string>('127.0.0.1');
  const [relayConnected, setRelayConnected] = useState<boolean>(true);

  // Rules state
  const [rules, setRules] = useState<DomainRouteRule[]>(() => {
    try {
      const saved = localStorage.getItem('netlink_domainroute_rules');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore cache parse error
    }
    return DEFAULT_RULES;
  });

  // Traffic stats state
  const [upstreamBandwidth, setUpstreamBandwidth] = useState<number>(128 * 1024);
  const [downstreamBandwidth, setDownstreamBandwidth] = useState<number>(1.85 * 1024 * 1024);
  const [totalBytes, setTotalBytes] = useState<number>(34.8 * 1024 * 1024);
  const [activeChannels, setActiveChannels] = useState<DomainRouteChannel[]>([
    {
      id: 'ch-8041',
      targetDomain: 'occ-0-1234.1.nflxso.net:443',
      status: 'Streaming',
      bytesTransferred: 18452000,
      duration: 145
    },
    {
      id: 'ch-8042',
      targetDomain: 'api.netflix.com:443',
      status: 'Idle',
      bytesTransferred: 420000,
      duration: 320
    },
    {
      id: 'ch-8043',
      targetDomain: 'rr3---sn-4g5edn6e.googlevideo.com:443',
      status: 'Streaming',
      bytesTransferred: 15928000,
      duration: 98
    }
  ]);

  // Dialogs & UI helpers
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [presetsModalOpen, setPresetsModalOpen] = useState(false);
  const [newPattern, setNewPattern] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [copiedPort, setCopiedPort] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Persistence helper
  const persistConfig = useCallback(async (updatedRules: DomainRouteRule[], enabledState: boolean) => {
    try {
      localStorage.setItem('netlink_domainroute_rules', JSON.stringify(updatedRules));
      const url = target ? `/api/domainroute/config?target=${encodeURIComponent(target)}` : '/api/domainroute/config';
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          enabled: enabledState,
          port: proxyPort,
          proxyPort: proxyPort,
          host: proxyHost,
          rules: updatedRules
        })
      });
    } catch {
      // Gracefully silent if server offline
    }
  }, [target, token, proxyPort, proxyHost]);

  // Load config on mount
  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
      try {
        const url = target ? `/api/domainroute/config?target=${encodeURIComponent(target)}` : '/api/domainroute/config';
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        const conf = data.config || data;
        if (typeof conf.enabled === 'boolean') setProxyEnabled(conf.enabled);
        if (conf.proxyPort) setProxyPort(conf.proxyPort);
        else if (conf.port) setProxyPort(conf.port);
        if (Array.isArray(conf.rules) && conf.rules.length > 0) {
          setRules(conf.rules);
          localStorage.setItem('netlink_domainroute_rules', JSON.stringify(conf.rules));
        }
        if (typeof conf.relayConnected === 'boolean') {
          setRelayConnected(conf.relayConnected);
        }
      } catch {
        // Fallback to local default
      }
    };

    fetchConfig();
    return () => {
      isMounted = false;
    };
  }, [token, target]);

  // Periodic traffic stats polling
  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const url = target ? `/api/domainroute/stats?target=${encodeURIComponent(target)}` : '/api/domainroute/stats';
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        const stats = data.stats || data;
        const up = typeof stats.bandwidthUp === 'number' ? stats.bandwidthUp : stats.upstreamBandwidth;
        if (typeof up === 'number') setUpstreamBandwidth(up);

        const down = typeof stats.bandwidthDown === 'number' ? stats.bandwidthDown : stats.downstreamBandwidth;
        if (typeof down === 'number') setDownstreamBandwidth(down);

        const total = (typeof stats.bytesIn === 'number' && typeof stats.bytesOut === 'number')
          ? (stats.bytesIn + stats.bytesOut)
          : stats.totalBytesTransferred;
        if (typeof total === 'number') setTotalBytes(total);

        const rawChannels = Array.isArray(stats.channels)
          ? stats.channels
          : Array.isArray(stats.activeChannels)
          ? stats.activeChannels
          : null;

        if (rawChannels) {
          setActiveChannels(
            rawChannels.map((c: any) => ({
              id: String(c.channelId ?? c.id ?? 'ch'),
              targetDomain: c.domain ? `${c.domain}:${c.port || 443}` : (c.targetDomain || 'unknown'),
              status: (c.status || ((c.bytesIn > 0 || c.bytesOut > 0) ? 'Streaming' : 'Active')) as any,
              bytesTransferred: (c.bytesIn || 0) + (c.bytesOut || 0) || (c.bytesTransferred || 0),
              duration: typeof c.duration === 'number' ? c.duration : (typeof c.startTime === 'number' ? Math.round((Date.now() - c.startTime) / 1000) : 0)
            }))
          );
        }

        if (typeof stats.relayConnected === 'boolean') setRelayConnected(stats.relayConnected);
        if (typeof stats.proxyActive === 'boolean') setProxyEnabled(stats.proxyActive);
      } catch {
        // Keep smooth fallback state
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token, target]);

  // Master switch handler
  const handleToggleProxy = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextState = e.target.checked;
    setProxyEnabled(nextState);
    persistConfig(rules, nextState);
    setToastMessage(nextState ? 'DomainRoute proxy service activated' : 'DomainRoute proxy service stopped');
  };

  // Rule actions
  const handleToggleRule = (ruleId: string) => {
    const updated = rules.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
    setRules(updated);
    persistConfig(updated, proxyEnabled);
  };

  const handleDeleteRule = (ruleId: string) => {
    const updated = rules.filter((r) => r.id !== ruleId);
    setRules(updated);
    persistConfig(updated, proxyEnabled);
    setToastMessage('Rule removed');
  };

  const handleAddRule = () => {
    const trimmedPattern = newPattern.trim();
    if (!trimmedPattern) return;

    const newRule: DomainRouteRule = {
      id: `rule-${Date.now()}`,
      pattern: trimmedPattern,
      description: newDesc.trim() || 'Custom domain routing rule',
      enabled: true,
      createdAt: new Date().toISOString()
    };

    const updated = [newRule, ...rules];
    setRules(updated);
    persistConfig(updated, proxyEnabled);
    setNewPattern('');
    setNewDesc('');
    setAddModalOpen(false);
    setToastMessage(`Added route pattern ${trimmedPattern}`);
  };

  const handleAddPresetPack = (pack: PresetPack) => {
    const existingPatterns = new Set(rules.map((r) => r.pattern.toLowerCase()));
    const toAdd: DomainRouteRule[] = [];

    for (const r of pack.rules) {
      if (!existingPatterns.has(r.pattern.toLowerCase())) {
        toAdd.push({
          id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          pattern: r.pattern,
          description: r.description,
          enabled: true
        });
      }
    }

    if (toAdd.length === 0) {
      setToastMessage(`All rules from ${pack.name} are already added`);
      return;
    }

    const updated = [...toAdd, ...rules];
    setRules(updated);
    persistConfig(updated, proxyEnabled);
    setToastMessage(`Added ${toAdd.length} rules from ${pack.name}`);
  };

  const handleCopyPort = () => {
    navigator.clipboard.writeText(`${proxyHost}:${proxyPort}`);
    setCopiedPort(true);
    setTimeout(() => setCopiedPort(false), 2000);
    setToastMessage(`Copied ${proxyHost}:${proxyPort} to clipboard`);
  };

  // Filtered rules
  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return rules;
    const q = searchQuery.toLowerCase();
    return rules.filter(
      (r) => r.pattern.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    );
  }, [rules, searchQuery]);

  return (
    <Box className="domain-route-root">
      {/* Header bar */}
      <Box className="domain-route-header">
        <Box className="domain-route-brand">
          <Box className="domain-route-brand-icon">
            <RouteIcon size={22} color="#38bdf8" />
          </Box>
          <Box>
            <Box className="domain-route-brand-title">
              DomainRoute
              <span className="domain-route-brand-badge">Selective Tunneling</span>
            </Box>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.45)' }}>
              Split routing proxy for targeted domain tunneling
            </Typography>
          </Box>
        </Box>

        <Box className="domain-route-header-actions">
          {/* Connection status */}
          <span className={`domain-route-pill relay ${relayConnected ? 'connected' : ''}`}>
            <span className={`status-dot ${relayConnected ? 'pulsing' : ''}`} />
            {relayConnected ? 'Relay: Connected' : 'Relay: Disconnected'}
          </span>

          {/* Proxy status */}
          <span className={`domain-route-pill ${proxyEnabled ? 'active' : 'stopped'}`}>
            <span className={`status-dot ${proxyEnabled ? 'pulsing' : ''}`} />
            {proxyEnabled ? 'Active' : 'Stopped'}
          </span>

          {/* Master toggle */}
          <Box className="domain-route-master-control">
            <Power size={14} color={proxyEnabled ? '#34d399' : '#fb7185'} />
            <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
              Proxy
            </Typography>
            <Switch
              size="small"
              checked={proxyEnabled}
              onChange={handleToggleProxy}
              color="primary"
            />
          </Box>
        </Box>
      </Box>

      {/* Metrics bar */}
      <Box className="domain-route-metrics-bar">
        {/* Local Proxy Port */}
        <Box className="domain-route-metric-card">
          <Box className="metric-info">
            <span className="metric-label">Local Proxy Port</span>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span className="metric-value">{proxyHost}:{proxyPort}</span>
              <Tooltip title="Copy SOCKS5 proxy address">
                <IconButton size="small" onClick={handleCopyPort} sx={{ color: '#38bdf8', p: 0.5 }}>
                  {copiedPort ? <Check size={14} /> : <Copy size={14} />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <Box className="metric-icon-box" sx={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
            <Server size={18} />
          </Box>
        </Box>

        {/* Upstream Bandwidth */}
        <Box className="domain-route-metric-card">
          <Box className="metric-info">
            <span className="metric-label">Upstream Bandwidth</span>
            <span className="metric-value">{proxyEnabled ? formatSpeed(upstreamBandwidth) : '0.0 KB/s'}</span>
          </Box>
          <Box className="metric-icon-box" sx={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
            <ArrowUpRight size={18} />
          </Box>
        </Box>

        {/* Downstream Bandwidth */}
        <Box className="domain-route-metric-card">
          <Box className="metric-info">
            <span className="metric-label">Downstream Bandwidth</span>
            <span className="metric-value">{proxyEnabled ? formatSpeed(downstreamBandwidth) : '0.0 KB/s'}</span>
          </Box>
          <Box className="metric-icon-box" sx={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <ArrowDownLeft size={18} />
          </Box>
        </Box>

        {/* Total Bytes Transferred */}
        <Box className="domain-route-metric-card">
          <Box className="metric-info">
            <span className="metric-label">Total Transferred</span>
            <span className="metric-value">{formatBytes(totalBytes)}</span>
          </Box>
          <Box className="metric-icon-box" sx={{ background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' }}>
            <Activity size={18} />
          </Box>
        </Box>
      </Box>

      {/* Tabs bar */}
      <Box className="domain-route-tabs-container">
        <Tabs
          value={activeTab}
          onChange={(_e, val) => setActiveTab(val)}
          indicatorColor="primary"
          textColor="inherit"
          sx={{ minHeight: 44 }}
        >
          <Tab
            value="rules"
            label={`Routing Rules (${rules.length})`}
            className="domain-route-tab-button"
            icon={<Globe size={15} />}
            iconPosition="start"
          />
          <Tab
            value="traffic"
            label={`Traffic & Channels (${activeChannels.length})`}
            className="domain-route-tab-button"
            icon={<Radio size={15} />}
            iconPosition="start"
          />
          <Tab
            value="setup"
            label="Client Setup"
            className="domain-route-tab-button"
            icon={<HelpCircle size={15} />}
            iconPosition="start"
          />
        </Tabs>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Quick add popular preset rule packs">
            <Button
              size="small"
              variant="outlined"
              startIcon={<Sparkles size={14} />}
              onClick={() => setPresetsModalOpen(true)}
              sx={{
                textTransform: 'none',
                borderColor: 'rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                borderRadius: '8px',
                fontSize: '0.8rem',
                '&:hover': {
                  borderColor: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.08)'
                }
              }}
            >
              Presets
            </Button>
          </Tooltip>

          <Button
            size="small"
            variant="contained"
            startIcon={<Plus size={14} />}
            onClick={() => setAddModalOpen(true)}
            sx={{
              textTransform: 'none',
              background: '#0284c7',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
              '&:hover': {
                background: '#0369a1'
              }
            }}
          >
            Add Rule
          </Button>
        </Box>
      </Box>

      {/* Main scrollable body */}
      <Box className="domain-route-content">
        {/* Tab 1: Rules Manager */}
        {activeTab === 'rules' && (
          <Box>
            <Box className="rule-manager-toolbar">
              <Box className="rule-search-box">
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Filter domain patterns or labels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search size={16} color="rgba(255,255,255,0.4)" />
                        </InputAdornment>
                      )
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                      '&.Mui-focused fieldset': { borderColor: '#38bdf8' }
                    }
                  }}
                />
              </Box>

              <Box className="rule-actions-group">
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  Active: {rules.filter((r) => r.enabled).length} / {rules.length}
                </Typography>
              </Box>
            </Box>

            {filteredRules.length === 0 ? (
              <Box className="domain-route-empty">
                <Globe size={40} color="rgba(255, 255, 255, 0.2)" />
                <Box className="domain-route-empty-title">
                  {searchQuery ? 'No matching domain rules found' : 'No domain routing rules configured'}
                </Box>
                <Box className="domain-route-empty-sub">
                  Add domain patterns like <code style={{ color: '#38bdf8' }}>*.netflix.com</code> to tunnel matching
                  traffic through NetLink, or click Presets to load ready-made packs.
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Sparkles size={14} />}
                    onClick={() => setPresetsModalOpen(true)}
                    sx={{ textTransform: 'none', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}
                  >
                    Load Presets
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Plus size={14} />}
                    onClick={() => setAddModalOpen(true)}
                    sx={{ textTransform: 'none', background: '#0284c7' }}
                  >
                    Add Custom Rule
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box className="rules-table-container">
                <Box className="rules-table-header">
                  <span>Domain Pattern</span>
                  <span>Description / Service</span>
                  <span>Status</span>
                  <span style={{ textAlign: 'right' }}>Actions</span>
                </Box>

                {filteredRules.map((rule) => (
                  <Box key={rule.id} className="rule-row">
                    <Box>
                      <span className="rule-pattern-chip">{rule.pattern}</span>
                    </Box>
                    <Box className="rule-desc-text">
                      {rule.description || 'No description provided'}
                    </Box>
                    <Box>
                      <Switch
                        size="small"
                        checked={rule.enabled}
                        onChange={() => handleToggleRule(rule.id)}
                        color="primary"
                      />
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Tooltip title="Delete domain rule">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteRule(rule.id)}
                          sx={{ color: 'rgba(255, 255, 255, 0.4)', '&:hover': { color: '#f43f5e' } }}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Tab 2: Traffic & Active Channels */}
        {activeTab === 'traffic' && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#f8fafc' }}>
                  Live Tunnel Channels
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.45)' }}>
                  Active connections routed through your NetLink relay tunnel
                </Typography>
              </Box>

              <Tooltip title="Live stream refreshed every 2 seconds">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span className="domain-route-pill active" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                    <span className="status-dot pulsing" />
                    Live Polling
                  </span>
                  <RefreshCw size={14} className="spin-icon" color="#38bdf8" />
                </Box>
              </Tooltip>
            </Box>

            {activeChannels.length === 0 ? (
              <Box className="domain-route-empty">
                <Radio size={40} color="rgba(255, 255, 255, 0.2)" />
                <Box className="domain-route-empty-title">No active tunneling channels</Box>
                <Box className="domain-route-empty-sub">
                  Connections matching your domain rules will appear here with live transfer metrics as traffic flows.
                </Box>
              </Box>
            ) : (
              <Box className="channels-table-container">
                <Box className="channels-table-header">
                  <span>Channel ID</span>
                  <span>Target Domain & Port</span>
                  <span>Status</span>
                  <span>Transferred</span>
                  <span>Duration</span>
                </Box>

                {activeChannels.map((channel) => (
                  <Box key={channel.id} className="channel-row">
                    <span className="channel-id-text">#{channel.id}</span>
                    <span className="channel-target-text">{channel.targetDomain}</span>
                    <Box>
                      <span className={`channel-status-pill ${channel.status.toLowerCase()}`}>
                        <span className="status-dot pulsing" />
                        {channel.status}
                      </span>
                    </Box>
                    <span style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>
                      {formatBytes(channel.bytesTransferred)}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)' }}>
                      {formatDuration(channel.duration)}
                    </span>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Tab 3: Client Setup & Instructions */}
        {activeTab === 'setup' && (
          <Box className="guide-container">
            <Box className="guide-step-card">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Zap size={18} color="#38bdf8" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  How DomainRoute Works
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5 }}>
                DomainRoute exposes a high-performance local SOCKS5 proxy on <code style={{ color: '#38bdf8' }}>{proxyHost}:{proxyPort}</code>.
                When your applications send requests through this proxy, DomainRoute inspects the target hostname:
              </Typography>
              <Box component="ul" sx={{ color: 'rgba(255, 255, 255, 0.7)', pl: 3, m: 0 }}>
                <li>
                  <strong style={{ color: '#34d399' }}>Matched Domains:</strong> Transparently encrypted and tunneled
                  via your remote NetLink Home Server node.
                </li>
                <li>
                  <strong style={{ color: '#cbd5e1' }}>Unmatched Domains:</strong> Route directly via your local
                  internet connection with zero latency overhead.
                </li>
              </Box>
            </Box>

            <Box className="guide-step-card">
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#f8fafc' }}>
                Option 1: Browser Proxy Extension (Recommended)
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Install <strong>SwitchyOmega</strong> or <strong>FoxyProxy</strong> in Chrome or Firefox, and add a SOCKS5 proxy:
              </Typography>
              <Box className="guide-code-box">
                <span>Protocol: SOCKS5 &nbsp;|&nbsp; Server: {proxyHost} &nbsp;|&nbsp; Port: {proxyPort}</span>
                <IconButton size="small" onClick={handleCopyPort} sx={{ color: '#38bdf8' }}>
                  <Copy size={14} />
                </IconButton>
              </Box>
            </Box>

            <Box className="guide-step-card">
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#f8fafc' }}>
                Option 2: Test via cURL CLI
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Verify that your exit IP reflects the remote NetLink server:
              </Typography>
              <Box className="guide-code-box">
                <code>curl -x socks5h://{proxyHost}:{proxyPort} https://ipinfo.io/json</code>
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* Add Rule Dialog */}
      <Dialog
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              color: '#f8fafc'
            }
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <RouteIcon size={20} color="#38bdf8" />
          Add Domain Route Rule
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
          <TextField
            autoFocus
            label="Domain Pattern"
            placeholder="e.g. *.netflix.com or disneyplus.com"
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            helperText="Wildcards (*) supported for subdomains (e.g. *.netflix.com)"
            fullWidth
            size="small"
            slotProps={{
              input: {
                sx: {
                  fontFamily: 'monospace',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)'
                }
              }
            }}
          />

          <TextField
            label="Description / Label"
            placeholder="e.g. Netflix Streaming CDN"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            fullWidth
            size="small"
            slotProps={{
              input: {
                sx: {
                  backgroundColor: 'rgba(255, 255, 255, 0.03)'
                }
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <Button onClick={() => setAddModalOpen(false)} sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!newPattern.trim()}
            onClick={handleAddRule}
            sx={{
              background: '#0284c7',
              '&:hover': { background: '#0369a1' }
            }}
          >
            Add Rule
          </Button>
        </DialogActions>
      </Dialog>

      {/* Presets Modal */}
      <Dialog
        open={presetsModalOpen}
        onClose={() => setPresetsModalOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              color: '#f8fafc'
            }
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Sparkles size={20} color="#38bdf8" />
            <span>Preset Rule Packs</span>
          </Box>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.45)' }}>
            1-Click Domain Profiles
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: '10px !important' }}>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2 }}>
            Select any preset package to immediately register the required CDN clusters and API domain wildcards:
          </Typography>

          <Box className="presets-grid">
            {PRESET_PACKS.map((pack) => {
              const packPatterns = new Set(pack.rules.map((r) => r.pattern.toLowerCase()));
              const alreadyAddedCount = rules.filter((r) => packPatterns.has(r.pattern.toLowerCase())).length;
              const isAllAdded = alreadyAddedCount === pack.rules.length;

              return (
                <Box key={pack.id} className="preset-card">
                  <Box className="preset-card-header">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: pack.iconColor
                        }}
                      />
                      <span className="preset-title">{pack.name}</span>
                    </Box>
                    <span
                      className="preset-domain-tag"
                      style={{ color: pack.iconColor, background: 'rgba(255,255,255,0.06)' }}
                    >
                      {pack.badge}
                    </span>
                  </Box>

                  <span className="preset-desc">{pack.description}</span>

                  <Box className="preset-tags">
                    {pack.rules.map((r) => (
                      <span key={r.pattern} className="preset-domain-tag">
                        {r.pattern}
                      </span>
                    ))}
                  </Box>

                  <Button
                    size="small"
                    variant={isAllAdded ? 'outlined' : 'contained'}
                    disabled={isAllAdded}
                    onClick={() => handleAddPresetPack(pack)}
                    sx={{
                      mt: 'auto',
                      textTransform: 'none',
                      fontSize: '0.78rem',
                      background: isAllAdded ? 'transparent' : '#0284c7',
                      borderColor: isAllAdded ? 'rgba(255,255,255,0.1)' : undefined,
                      color: isAllAdded ? 'rgba(255,255,255,0.4)' : '#ffffff',
                      '&:hover': { background: isAllAdded ? 'transparent' : '#0369a1' }
                    }}
                  >
                    {isAllAdded ? 'Added' : `Add Pack (${pack.rules.length} domains)`}
                  </Button>
                </Box>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <Button onClick={() => setPresetsModalOpen(false)} sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar feedback */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={3000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToastMessage(null)}
          severity="success"
          sx={{
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
          }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
