import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  TextField,
  Button,
  Card,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip
} from '@mui/material';
import {
  Store,
  ShoppingBag,
  LayoutGrid,
  CheckCircle2,
  RefreshCw,
  Search,
  Star,
  Download,
  ExternalLink,
  X,
  Sparkles,
  Trash2,
  Pin,
  PinOff,
  Wrench,
  AlertTriangle,
  Server
} from 'lucide-react';
import './NetStoreApp.css';
import { useWindowStore } from '../../store/useWindowStore';
import AppIcon from '../../components/AppIcon';

interface AppItem {
  id: string;
  name: string;
  author: string;
  category: 'Utilities' | 'Security' | 'Remote Access' | 'Monitoring' | 'Developer Tools' | 'System';
  rating: number;
  downloads: string;
  size: string;
  version: string;
  nativeKey?: 'graph' | 'terminal' | 'vnc' | 'sftp' | 'settings';
  color: string;
  icon: React.ReactNode;
  rawIcon?: string;
  shortDesc: string;
  fullDesc: string;
  features: string[];
  isFeatured?: boolean;
  entrypoint?: string;
  main?: string;
}

type MainTab = 'discover' | 'all' | 'installed' | 'updates';

interface NetStoreAppProps {
  token?: string;
  target?: string;
}

function getAppIcon(app: any) {
  if (typeof app.icon === 'object' && app.icon !== null) {
    return app.icon;
  }
  const iconStr = typeof app.icon === 'string' ? app.icon : undefined;
  return <AppIcon appId={app.id} icon={iconStr} color={app.color} size={22} />;
}

export default function NetStoreApp(props: NetStoreAppProps) {
  const [activeTab, setActiveTab] = useState<MainTab>('discover');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);
  const [storeCatalog, setStoreCatalog] = useState<AppItem[]>([]);

  // Branch aus URL-Query, Fallback auf localStorage oder 'main'
  const [selectedBranch, setSelectedBranch] = useState<'main' | 'dev' | 'local-debug'>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const branchParam = urlParams.get('branch');
      if (branchParam === 'main' || branchParam === 'dev' || branchParam === 'local-debug') {
        return branchParam;
      }
      const saved = localStorage.getItem('netstore_selected_branch');
      if (saved === 'main' || saved === 'dev' || saved === 'local-debug') return saved;
    } catch (e) { }
    return 'main';
  });

  // Synchronisation in localStorage und URL-Query (?branch=xxxx)
  useEffect(() => {
    try {
      localStorage.setItem('netstore_selected_branch', selectedBranch);

      const url = new URL(window.location.href);
      if (url.searchParams.get('branch') !== selectedBranch) {
        url.searchParams.set('branch', selectedBranch);
        window.history.replaceState({}, '', url.toString());
      }
    } catch (e) { }
  }, [selectedBranch]);

  const [debugStoreUrl, setDebugStoreUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('netstore_debug_url') || 'http://localhost:4540';
    } catch {
      return 'http://localhost:4540';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('netstore_debug_url', debugStoreUrl);
    } catch (e) { }
  }, [debugStoreUrl]);

  const [debugConnected, setDebugConnected] = useState<boolean | null>(null);
  const [debugBranches, setDebugBranches] = useState<string[]>(['workspace', 'main', 'dev']);
  const [selectedLocalBranch, setSelectedLocalBranch] = useState<string>(() => {
    try {
      return localStorage.getItem('netstore_local_branch') || 'workspace';
    } catch {
      return 'workspace';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('netstore_local_branch', selectedLocalBranch);
    } catch (e) { }
  }, [selectedLocalBranch]);

  const [installedVersions, setInstalledVersions] = useState<Record<string, string>>({});
  const [refreshIndex, setRefreshIndex] = useState<number>(0);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const url = props.target ? `/api/applications?target=${encodeURIComponent(props.target)}` : '/api/applications';
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch store applications');
        const localData = await res.json();

        const catalogUrl = `/api/netstore/catalog?branch=${encodeURIComponent(selectedBranch)}`;
        const catalogRes = await fetch(catalogUrl);
        const catalogData = catalogRes.ok ? await catalogRes.json() : [];

        const mergedMap = new Map();
        for (const app of (Array.isArray(catalogData) ? catalogData : [])) {
          mergedMap.set(app.id, { ...app, installed: false });
        }

        const backendInstalledIds: string[] = [];
        const versionsMap: Record<string, string> = {};
        for (const app of (Array.isArray(localData) ? localData : [])) {
          const isInstalled = app.installed !== false;
          if (isInstalled) {
            backendInstalledIds.push(app.id);
            versionsMap[app.id] = app.version || 'v1.0.0';
          }
          const existing = mergedMap.get(app.id) || {};
          mergedMap.set(app.id, { ...existing, ...app, installed: isInstalled });
        }

        const finalData = Array.from(mergedMap.values());

        useWindowStore.getState().registerAppMetadata(finalData.map((item: any) => ({
          id: item.id,
          title: item.name,
          icon: typeof item.icon === 'string' ? item.icon : undefined,
          color: item.color
        })));

        const parsedCatalog: AppItem[] = finalData.map((item: any) => {
          const rawIcon = typeof item.icon === 'string' ? item.icon : undefined;
          return {
            id: item.id || `app-${Math.random()}`,
            name: item.name || 'Unnamed App',
            author: item.author || 'Community',
            category: item.category || 'Utilities',
            rating: item.rating || 5.0,
            downloads: item.downloads || '1.0k',
            size: item.size || '1 MB',
            version: item.version || 'v1.0.0',
            nativeKey: item.nativeKey,
            color: item.color || '#38bdf8',
            icon: getAppIcon(item),
            rawIcon: rawIcon,
            shortDesc: item.shortDesc || item.shortDescription || '',
            fullDesc: item.fullDesc || item.fullDescription || '',
            features: item.features || [],
            isFeatured: item.isFeatured
          };
        });

        setStoreCatalog(parsedCatalog);
        setInstalledVersions(versionsMap);
        setInstalledAppIds(backendInstalledIds);
      } catch (err: any) {
        console.warn('Store fetch error:', err.message);
      }
    };

    fetchApps();
  }, [props.target, selectedBranch, selectedLocalBranch, debugStoreUrl, refreshIndex]);

  // Installed App State
  const [installedAppIds, setInstalledAppIds] = useState<string[]>([]);
  const [installingMap, setInstallingMap] = useState<Record<string, number>>({});

  const windowStore = useWindowStore();

  const notifyUser = (message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    window.dispatchEvent(
      new CustomEvent('netlink_notify', {
        detail: { message, type }
      })
    );
  };

  const [runInBackground, setRunInBackground] = useState<boolean>(false);

  const handleInstall = (app: AppItem, e?: React.MouseEvent, runInBg: boolean = false) => {
    if (e) e.stopPropagation();
    if (installingMap[app.id]) return;

    setInstallingMap((prev) => ({ ...prev, [app.id]: 15 }));

    const targetId = props.target || "local-server";
    const isDebug = selectedBranch === 'local-debug';
    const effectiveBranch = isDebug ? (selectedLocalBranch || 'workspace') : selectedBranch;
    const effectiveCustomStoreUrl = isDebug ? debugStoreUrl : undefined;

    fetch('/api/applications/install', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(props.token ? { 'Authorization': `Bearer ${props.token}` } : {})
      },
      body: JSON.stringify({
        appId: app.id,
        target: targetId,
        branch: effectiveBranch,
        runInBackground: runInBg,
        customStoreUrl: effectiveCustomStoreUrl
      })
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to install application');
        }
        return res.json();
      })
      .then(() => {
        setInstallingMap((prev) => {
          const copy = { ...prev };
          delete copy[app.id];
          return copy;
        });
        setInstalledAppIds((prev) => Array.from(new Set([...prev, app.id])));
        setInstalledVersions((prev) => ({ ...prev, [app.id]: app.version || 'v1.0.0' }));
        windowStore.registerAppMetadata([{
          id: app.id,
          title: app.name,
          icon: app.rawIcon,
          color: app.color
        }]);
        notifyUser(`${app.name} installed / updated successfully!`, 'success');
        window.dispatchEvent(new CustomEvent('netlink_apps_updated', { detail: { appId: app.id } }));
      })
      .catch((err) => {
        console.error(err);
        notifyUser(`Failed to install ${app.name}: ${err.message}`, 'warning');
        setInstallingMap((prev) => {
          const copy = { ...prev };
          delete copy[app.id];
          return copy;
        });
      });
  };

  const handleUninstall = (app: AppItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (app.nativeKey) {
      notifyUser(`System app ${app.name} cannot be uninstalled.`, 'warning');
      return;
    }

    const targetId = props.target || "local-server";

    fetch('/api/applications/uninstall', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(props.token ? { 'Authorization': `Bearer ${props.token}` } : {})
      },
      body: JSON.stringify({ appId: app.id, target: targetId })
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to uninstall application');
        }
        return res.json();
      })
      .then(() => {
        setInstalledAppIds((prev) => prev.filter((id) => id !== app.id));
        setInstalledVersions((prev) => {
          const copy = { ...prev };
          delete copy[app.id];
          return copy;
        });
        notifyUser(`${app.name} was uninstalled.`, 'info');
        window.dispatchEvent(new CustomEvent('netlink_apps_updated', { detail: { appId: app.id } }));
      })
      .catch((err) => {
        console.error(err);
        notifyUser(`Failed to uninstall ${app.name}: ${err.message}`, 'warning');
      });
  };

  const handleOpenApp = (app: AppItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    notifyUser(`Opening ${app.name}...`, 'success');
    const entry = app.entrypoint || ((app as any).main ? ((app as any).main.startsWith('frontend/') ? (app as any).main : `frontend/${(app as any).main}`) : undefined);
    windowStore.openDynamicApp(app.id, app.name, entry ? { entrypoint: entry } : undefined, app.rawIcon, app.color);
  };

  const installedCount = storeCatalog.filter(app => installedAppIds.includes(app.id)).length;
  const updatesCount = storeCatalog.filter(app => {
    if (!installedAppIds.includes(app.id)) return false;
    const installedVer = installedVersions[app.id];
    return Boolean(installedVer && app.version && installedVer !== app.version);
  }).length;

  const tabs = [
    { id: 'discover', label: 'Discover', icon: <ShoppingBag size={18} /> },
    { id: 'all', label: 'All Applications', icon: <LayoutGrid size={18} /> },
    { id: 'installed', label: `Installed (${installedCount})`, icon: <CheckCircle2 size={18} /> },
    { id: 'updates', label: `Updates (${updatesCount})`, icon: <RefreshCw size={18} /> },
  ];

  const categories = ['All', 'Monitoring', 'Security', 'Remote Access', 'Utilities', 'Developer Tools', 'System', 'Gaming'];

  const filteredApps = storeCatalog.filter((app) => {
    if (activeTab === 'installed' && !installedAppIds.includes(app.id)) return false;
    if (activeTab === 'updates') {
      if (!installedAppIds.includes(app.id)) return false;
      const installedVer = installedVersions[app.id];
      if (updatesCount > 0 && installedVer && app.version && installedVer === app.version) return false;
    }

    if (selectedCategory !== 'All' && app.category !== selectedCategory) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        app.name.toLowerCase().includes(q) ||
        app.shortDesc.toLowerCase().includes(q) ||
        app.author.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const featuredApp = storeCatalog.find((app) => app.isFeatured) || storeCatalog[0];

  return (
    <Box className="netstore-root">
      {/* Sidebar */}
      <Paper className="netstore-sidebar" elevation={0}>
        <Box className="netstore-sidebar-header">
          <Store size={24} color="#ec4899" />
          <Box>
            <Typography variant="subtitle1" className="netstore-sidebar-title">
              NetStore
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Application Market
            </Typography>
          </Box>
        </Box>

        {/* Search */}
        <Box className="netstore-sidebar-search">
          <TextField
            size="small"
            placeholder="Search store..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            slotProps={{
              input: {
                startAdornment: <Search size={16} style={{ marginRight: 8, color: '#94a3b8' }} />
              }
            }}
          />
        </Box>

        {/* Branch Selector */}
        <Box sx={{ px: 2, pb: 1.5 }}>
          <FormControl fullWidth size="small" variant="outlined">
            <InputLabel id="branch-select-label" sx={{ fontSize: '0.8rem' }}>Store Channel</InputLabel>
            <Select
              labelId="branch-select-label"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value as 'main' | 'dev' | 'local-debug')}
              label="Store Channel"
              sx={{ fontSize: '0.85rem' }}
            >
              <MenuItem value="main">Stable (main)</MenuItem>
              <MenuItem value="dev">Developer (dev)</MenuItem>
              <MenuItem value="local-debug">🛠️ Local Debug (Docker)</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Debug Controls */}
        {selectedBranch === 'local-debug' && (
          <Box sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Status Bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'rgba(255, 255, 255, 0.03)', p: 1, borderRadius: 1, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              {debugConnected === true ? (
                <Chip
                  size="small"
                  icon={<CheckCircle2 size={12} style={{ color: '#10b981' }} />}
                  label="Docker Online"
                  sx={{ bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '0.75rem', fontWeight: 600, height: 24, border: '1px solid rgba(16, 185, 129, 0.25)' }}
                />
              ) : (
                <Tooltip title="Start Docker debug server: ./start-debug.sh in NetLink-NetStore" arrow>
                  <Chip
                    size="small"
                    icon={<AlertTriangle size={12} style={{ color: '#f43f5e' }} />}
                    label="Docker Offline"
                    sx={{ bgcolor: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', fontSize: '0.75rem', fontWeight: 600, height: 24, border: '1px solid rgba(244, 63, 94, 0.25)' }}
                  />
                </Tooltip>
              )}
              <IconButton size="small" onClick={() => setRefreshIndex(prev => prev + 1)} sx={{ color: '#94a3b8', p: 0.5 }}>
                <RefreshCw size={14} />
              </IconButton>
            </Box>

            {/* Local Branch Select */}
            <FormControl fullWidth size="small" variant="outlined">
              <InputLabel id="local-branch-label" sx={{ fontSize: '0.8rem' }}>Local Branch</InputLabel>
              <Select
                labelId="local-branch-label"
                value={selectedLocalBranch}
                onChange={(e) => setSelectedLocalBranch(e.target.value)}
                label="Local Branch"
                sx={{ fontSize: '0.82rem' }}
              >
                {debugBranches.map(b => (
                  <MenuItem key={b} value={b} sx={{ fontSize: '0.85rem' }}>
                    {b === 'workspace' ? '📁 workspace (live)' : `🌿 ${b}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Docker Server URL */}
            <TextField
              size="small"
              label="Docker Store URL"
              value={debugStoreUrl}
              onChange={(e) => setDebugStoreUrl(e.target.value)}
              fullWidth
              slotProps={{
                input: {
                  sx: { fontSize: '0.8rem' },
                  startAdornment: <Server size={13} style={{ marginRight: 6, color: '#94a3b8' }} />
                }
              }}
            />
          </Box>
        )}

        {/* Sidebar Menu List */}
        <List className="netstore-sidebar-list">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <ListItem key={tab.id} disablePadding className="netstore-tab-item">
                <ListItemButton
                  className="netstore-tab-button"
                  selected={isActive}
                  onClick={() => {
                    setActiveTab(tab.id as MainTab);
                    if (tab.id !== 'all') setSelectedCategory('All');
                  }}
                >
                  <ListItemIcon className="netstore-tab-icon" sx={{ color: isActive ? 'primary.main' : 'inherit' }}>
                    {tab.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={tab.label}
                    slotProps={{
                      primary: {
                        variant: 'body2',
                        sx: {
                          fontWeight: isActive ? 'bold' : 'normal',
                          color: isActive ? 'primary.main' : 'inherit'
                        }
                      }
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        {/* Category Filters */}
        <Typography className="netstore-sidebar-section-label">
          Categories
        </Typography>
        <List className="netstore-sidebar-list" sx={{ pt: 0 }}>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <ListItem key={cat} disablePadding className="netstore-tab-item">
                <ListItemButton
                  className="netstore-tab-button"
                  selected={isActive}
                  onClick={() => {
                    setSelectedCategory(cat);
                    if (activeTab === 'discover') setActiveTab('all');
                  }}
                >
                  <ListItemText
                    primary={cat}
                    slotProps={{
                      primary: {
                        variant: 'body2',
                        sx: {
                          fontSize: '0.825rem',
                          fontWeight: isActive ? 'bold' : 'normal',
                          color: isActive ? 'primary.main' : 'text.secondary'
                        }
                      }
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Paper>

      {/* Main Content Area */}
      <Box className="netstore-main">
        <Box className="netstore-content-max">
          {/* Featured Banner on Discover Tab */}
          {activeTab === 'discover' && !searchQuery && selectedCategory === 'All' && featuredApp && (
            <Card className="netstore-hero-card" variant="outlined">
              <Box className="netstore-hero-content">
                <Chip
                  icon={<Sparkles size={12} />}
                  label="Featured App"
                  size="small"
                  color="secondary"
                  sx={{ mb: 1.5, fontWeight: 'bold' }}
                />
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {featuredApp.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {featuredApp.shortDesc}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  {installedAppIds.includes(featuredApp.id) ? (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        color="success"
                        startIcon={<ExternalLink size={16} />}
                        onClick={(e) => handleOpenApp(featuredApp, e)}
                      >
                        Open Application
                      </Button>
                      {!featuredApp.nativeKey && (
                        <>
                          <Button
                            variant="outlined"
                            color="inherit"
                            startIcon={<RefreshCw size={16} />}
                            onClick={(e) => handleInstall(featuredApp, e)}
                          >
                            Reinstall
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            onClick={(e) => handleUninstall(featuredApp, e)}
                          >
                            Uninstall
                          </Button>
                        </>
                      )}
                    </Box>
                  ) : (
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<Download size={16} />}
                      onClick={(e) => handleInstall(featuredApp, e)}
                    >
                      Install App
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => setSelectedApp(featuredApp)}
                  >
                    View Details
                  </Button>
                </Box>
              </Box>
            </Card>
          )}

          {/* Section Header */}
          <Box className="netstore-header-row">
            <Typography variant="h5" className="netstore-section-title">
              {activeTab === 'discover'
                ? 'Popular Applications'
                : activeTab === 'installed'
                  ? 'Installed Applications'
                  : activeTab === 'updates'
                    ? 'Available Updates'
                    : selectedCategory === 'All'
                      ? 'All Applications'
                      : `${selectedCategory} Apps`}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {selectedBranch === 'local-debug' && (
                <Chip
                  icon={<Wrench size={12} style={{ color: '#facc15' }} />}
                  label={`Docker: ${selectedLocalBranch}`}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(234, 179, 8, 0.15)',
                    color: '#facc15',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}
                />
              )}
              <Chip
                label={`${filteredApps.length} Apps`}
                size="small"
                variant="outlined"
              />
            </Box>
          </Box>

          {/* App Cards Grid */}
          {filteredApps.length > 0 ? (
            <Box className="netstore-grid">
              {filteredApps.map((app) => {
                const isInstalled = installedAppIds.includes(app.id);
                const progress = installingMap[app.id];

                return (
                  <Card
                    key={app.id}
                    className="netstore-app-card"
                    variant="outlined"
                    onClick={() => setSelectedApp(app)}
                  >
                    <Box className="netstore-card-body">
                      <Box className="netstore-card-header">
                        <Box className="netstore-icon-box">
                          {app.icon}
                        </Box>
                        <Box className="netstore-card-meta">
                          <Typography className="netstore-app-name">
                            {app.name}
                          </Typography>
                          <Typography className="netstore-app-author">
                            {app.author}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                            <Chip
                              label={app.category}
                              size="small"
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.675rem' }}
                            />
                            <Chip
                              label={app.size}
                              size="small"
                              variant="outlined"
                              color="info"
                              sx={{ height: 20, fontSize: '0.675rem', opacity: 0.85 }}
                            />
                          </Box>
                        </Box>
                      </Box>

                      <Typography className="netstore-card-desc">
                        {app.shortDesc}
                      </Typography>

                      {progress !== undefined && (
                        <Box sx={{ width: '100%', mt: 1 }}>
                          <LinearProgress variant="determinate" value={progress} color="secondary" />
                        </Box>
                      )}

                      <Box className="netstore-card-actions">
                        <Box className="netstore-rating">
                          <Star size={12} fill="#fbbf24" color="#fbbf24" /> {app.rating}
                        </Box>

                        {progress !== undefined ? (
                          <Button size="small" variant="outlined" disabled startIcon={<RefreshCw size={14} className="spin-icon" />}>
                            Installing...
                          </Button>
                        ) : isInstalled ? (
                          app.nativeKey ? (
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              startIcon={<ExternalLink size={14} />}
                              onClick={(e) => handleOpenApp(app, e)}
                            >
                              Open
                            </Button>
                          ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Tooltip title={windowStore.isPinned(app.id) ? "Unpin from Dock" : "Pin to Dock"} arrow placement="top">
                                <IconButton
                                  size="small"
                                  color={windowStore.isPinned(app.id) ? "secondary" : "default"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    windowStore.togglePinApp({ appId: app.id, title: app.name, icon: app.rawIcon, color: app.color });
                                  }}
                                  sx={{ padding: '4px' }}
                                >
                                  {windowStore.isPinned(app.id) ? <PinOff size={15} /> : <Pin size={15} />}
                                </IconButton>
                              </Tooltip>

                              <Tooltip title="Uninstall App" arrow placement="top">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={(e) => handleUninstall(app, e)}
                                  sx={{ padding: '4px' }}
                                >
                                  <Trash2 size={15} />
                                </IconButton>
                              </Tooltip>

                              <Tooltip title={installedVersions[app.id] && app.version && installedVersions[app.id] !== app.version ? "Update App" : "Reinstall App"} arrow placement="top">
                                <IconButton
                                  size="small"
                                  color={installedVersions[app.id] && app.version && installedVersions[app.id] !== app.version ? "info" : "default"}
                                  onClick={(e) => handleInstall(app, e)}
                                  sx={{ padding: '4px' }}
                                >
                                  <RefreshCw size={15} />
                                </IconButton>
                              </Tooltip>

                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                startIcon={<ExternalLink size={14} />}
                                onClick={(e) => handleOpenApp(app, e)}
                                sx={{ ml: 0.5 }}
                              >
                                Open
                              </Button>
                            </Box>
                          )
                        ) : (
                          <Button
                            size="small"
                            variant="contained"
                            color="secondary"
                            startIcon={<Download size={14} />}
                            onClick={(e) => handleInstall(app, e)}
                          >
                            Install
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </Card>
                );
              })}
            </Box>
          ) : (
            <Box className="netstore-empty">
              <ShoppingBag size={40} />
              <Typography variant="h6">No applications found</Typography>
              <Typography variant="body2" color="text.secondary">
                Try clearing your search or switching categories.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* App Detail Dialog */}
      {selectedApp && (
        <Dialog
          open={Boolean(selectedApp)}
          onClose={() => {
            setSelectedApp(null);
            setRunInBackground(false);
          }}
          maxWidth="sm"
          fullWidth
          slotProps={{
            paper: {
              className: 'netstore-dialog-paper',
              sx: {
                backgroundColor: '#0f172a',
                backgroundImage: 'none',
                color: '#fff',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
              }
            }
          }}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box className="netstore-icon-box" sx={{ width: 40, height: 40 }}>
                {selectedApp.icon}
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  {selectedApp.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedApp.author}
                </Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={() => setSelectedApp(null)}>
              <X size={18} />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
            {/* Meta Row */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, p: 1.5, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.05)' }}>
              <Box sx={{ flex: 1, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Rating</Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  <Star size={12} fill="#fbbf24" color="#fbbf24" /> {selectedApp.rating}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Downloads</Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{selectedApp.downloads}</Typography>
              </Box>
              <Box sx={{ flex: 1, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Size</Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{selectedApp.size}</Typography>
              </Box>
              <Box sx={{ flex: 1, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Version</Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{selectedApp.version}</Typography>
              </Box>
            </Box>

            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              About
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.6 }}>
              {selectedApp.fullDesc}
            </Typography>

            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              Features
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
              {selectedApp.features.map((feat, i) => (
                <Typography key={i} component="li" variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  {feat}
                </Typography>
              ))}
            </Box>
          </DialogContent>

          <DialogActions className="netstore-dialog-actions" sx={{ px: 3, py: 2, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 1.5, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Button
                size="small"
                color={windowStore.isPinned(selectedApp.id) ? "secondary" : "inherit"}
                variant="outlined"
                startIcon={windowStore.isPinned(selectedApp.id) ? <PinOff size={16} /> : <Pin size={16} />}
                onClick={(e) => {
                  e.stopPropagation();
                  windowStore.togglePinApp({ appId: selectedApp.id, title: selectedApp.name, icon: selectedApp.rawIcon, color: selectedApp.color });
                }}
                sx={{ whiteSpace: 'nowrap' }}
              >
                {windowStore.isPinned(selectedApp.id) ? 'Unpin' : 'Pin to Dock'}
              </Button>
              {installedAppIds.includes(selectedApp.id) && !selectedApp.nativeKey && (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<Trash2 size={16} />}
                    onClick={(e) => {
                      handleUninstall(selectedApp, e);
                      setSelectedApp(null);
                    }}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    Uninstall
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="info"
                    startIcon={<RefreshCw size={16} />}
                    onClick={(e) => {
                      handleInstall(selectedApp, e);
                    }}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {installedVersions[selectedApp.id] && selectedApp.version && installedVersions[selectedApp.id] !== selectedApp.version ? 'Update App' : 'Reinstall App'}
                  </Button>
                </>
              )}
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', ml: 'auto' }}>
              {!installedAppIds.includes(selectedApp.id) && (
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                  <input
                    type="checkbox"
                    id="runInBackground"
                    checked={runInBackground}
                    onChange={(e) => setRunInBackground(e.target.checked)}
                    style={{ marginRight: '8px', cursor: 'pointer', accentColor: '#38bdf8' }}
                  />
                  <label htmlFor="runInBackground" style={{ fontSize: '0.85rem', color: '#94a3b8', cursor: 'pointer', userSelect: 'none' }}>
                    Run in background
                  </label>
                </Box>
              )}
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                onClick={() => {
                  setSelectedApp(null);
                  setRunInBackground(false);
                }}
                sx={{ whiteSpace: 'nowrap', borderColor: 'rgba(255,255,255,0.2)' }}
              >
                Close
              </Button>
              {installedAppIds.includes(selectedApp.id) ? (
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<ExternalLink size={16} />}
                  onClick={(e) => {
                    handleOpenApp(selectedApp, e);
                    setSelectedApp(null);
                    setRunInBackground(false);
                  }}
                  sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}
                >
                  Open App
                </Button>
              ) : (
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  startIcon={<Download size={16} />}
                  onClick={(e) => {
                    handleInstall(selectedApp, e, runInBackground);
                  }}
                  sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}
                >
                  Install
                </Button>
              )}
            </Box>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}