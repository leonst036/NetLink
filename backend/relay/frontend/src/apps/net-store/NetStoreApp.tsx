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
  Network,
  Terminal,
  Monitor,
  Folder,
  ShieldAlert,
  Key,
  Trash2
} from 'lucide-react';
import './NetStoreApp.css';
import { useWindowStore } from '../../store/useWindowStore';

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
  shortDesc: string;
  fullDesc: string;
  features: string[];
  isFeatured?: boolean;
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
  const iconStr = typeof app.icon === 'string' ? app.icon : '';
  const color = app.color || '#38bdf8';
  if (iconStr === 'Network' || app.id === 'net-graph') return <Network size={22} color={color} />;
  if (iconStr === 'ShieldAlert' || app.id === 'port-sentinel') return <ShieldAlert size={22} color={color} />;
  if (iconStr === 'Terminal' || app.id === 'net-terminal') return <Terminal size={22} color={color} />;
  if (iconStr === 'Monitor' || app.id === 'vnc-viewer') return <Monitor size={22} color={color} />;
  if (iconStr === 'Folder' || app.id === 'sftp-client') return <Folder size={22} color={color} />;
  return <Store size={22} color={color} />;
}

export default function NetStoreApp(props: NetStoreAppProps) {
  const [activeTab, setActiveTab] = useState<MainTab>('discover');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);
  const [storeCatalog, setStoreCatalog] = useState<AppItem[]>([]);

  const [selectedBranch, setSelectedBranch] = useState<'NetStore' | 'NetStore-dev'>(() => {
    try {
      const saved = localStorage.getItem('netstore_selected_branch');
      if (saved === 'NetStore' || saved === 'NetStore-dev') return saved;
    } catch (e) {}
    return 'NetStore';
  });

  useEffect(() => {
    try {
      localStorage.setItem('netstore_selected_branch', selectedBranch);
    } catch (e) {}
  }, [selectedBranch]);

  const [githubToken, setGithubToken] = useState<string>(() => {
    try {
      return localStorage.getItem('netlink_github_token') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      if (githubToken) {
        localStorage.setItem('netlink_github_token', githubToken);
      } else {
        localStorage.removeItem('netlink_github_token');
      }
    } catch (e) {}
  }, [githubToken]);

  const [installedVersions, setInstalledVersions] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const url = props.target ? `/api/applications?target=${encodeURIComponent(props.target)}` : '/api/applications';
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch store applications');
        const localData = await res.json();
        
        let githubData = [];
        try {
            const headers: Record<string, string> = {};
            if (githubToken) {
              headers['Authorization'] = `token ${githubToken}`;
            }
            const ghRes = await fetch(`https://raw.githubusercontent.com/leonst036/NetLink/refs/heads/${selectedBranch}/applications/applications.json`, { headers });
            if (ghRes.ok) {
              githubData = await ghRes.json();
            } else {
              console.warn(`Failed to fetch branch ${selectedBranch}`);
            }
        } catch (e) {
            console.warn('Failed to fetch github branch data', e);
        }
        
        const mergedMap = new Map();
        for (const app of githubData) {
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

        const parsedCatalog: AppItem[] = finalData.map((item: any) => ({
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
            shortDesc: item.shortDesc || item.shortDescription || '',
            fullDesc: item.fullDesc || item.fullDescription || '',
            features: item.features || [],
            isFeatured: item.isFeatured
        }));
        
        setStoreCatalog(parsedCatalog);
        setInstalledVersions(versionsMap);
        setInstalledAppIds((prev) => Array.from(new Set([...prev, ...backendInstalledIds])));
      } catch (err: any) {
        console.warn('Store fetch error:', err.message);
      }
    };
    
    fetchApps();
  }, [props.target, selectedBranch, githubToken]);

  // Installed App State
  const [installedAppIds, setInstalledAppIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('netstore_installed_apps');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [installingMap, setInstallingMap] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      localStorage.setItem('netstore_installed_apps', JSON.stringify(installedAppIds));
    } catch (e) {
      console.error('Failed to save installed apps', e);
    }
  }, [installedAppIds]);

  const windowStore = useWindowStore();

  const notifyUser = (message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    window.dispatchEvent(
      new CustomEvent('netlink_notify', {
        detail: { message, type }
      })
    );
  };

  const handleInstall = (app: AppItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (installingMap[app.id]) return;

    setInstallingMap((prev) => ({ ...prev, [app.id]: 15 }));

    const targetId = props.target;
    
    fetch('/api/applications/install', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(props.token ? { 'Authorization': `Bearer ${props.token}` } : {})
      },
      body: JSON.stringify({ appId: app.id, target: targetId, branch: selectedBranch, githubToken })
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

    const targetId = props.target;

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

    if (app.nativeKey) {
      switch (app.nativeKey) {
        case 'graph':
          windowStore.setGraphWindow({ isOpen: true });
          windowStore.bringToFront('graph');
          break;
        case 'terminal':
          windowStore.openTerminal('');
          break;
        case 'vnc':
          windowStore.openVnc('192.168.1.1');
          break;
        case 'sftp':
          windowStore.openSftp('');
          break;
        case 'settings':
          windowStore.setSettingsWindow({ isOpen: true });
          windowStore.bringToFront('settings');
          break;
      }
    } else {
      notifyUser(`Opening ${app.name}...`, 'success');
      windowStore.openDynamicApp(app.id, app.name);
    }
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

  const categories = ['All', 'Monitoring', 'Security', 'Remote Access', 'Utilities', 'Developer Tools', 'System'];

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
      {/* Sidebar (Matches SettingsApp.tsx SidebarPaper) */}
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
              onChange={(e) => setSelectedBranch(e.target.value as 'NetStore' | 'NetStore-dev')}
              label="Store Channel"
              sx={{ fontSize: '0.85rem' }}
            >
              <MenuItem value="NetStore">Stable (NetStore)</MenuItem>
              <MenuItem value="NetStore-dev">Developer (NetStore-dev)</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* GitHub Token Field */}
        <Box sx={{ px: 2, pb: 2 }}>
          <TextField
            size="small"
            type="password"
            label="GitHub Token (Optional)"
            placeholder="ghp_xxxxxxxxxxxx"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            fullWidth
            slotProps={{
              input: {
                startAdornment: <Key size={14} style={{ marginRight: 6, color: '#94a3b8' }} />
              }
            }}
          />
        </Box>

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

      {/* Main Content Area (Matches SettingsApp.tsx main-content-container) */}
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
            <Chip
              label={`${filteredApps.length} Apps`}
              size="small"
              variant="outlined"
            />
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
                          <Chip
                            label={app.category}
                            size="small"
                            variant="outlined"
                            sx={{ mt: 0.5, height: 20, fontSize: '0.675rem' }}
                          />
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

      {/* App Detail Dialog (Matches SettingsApp.tsx Dialogs) */}
      {selectedApp && (
        <Dialog
          open={Boolean(selectedApp)}
          onClose={() => setSelectedApp(null)}
          maxWidth="sm"
          fullWidth
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

          <DialogContent dividers>
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

          <DialogActions sx={{ px: 3, py: 2 }}>
            {installedAppIds.includes(selectedApp.id) && !selectedApp.nativeKey && (
              <>
                <Button
                  color="error"
                  onClick={(e) => {
                    handleUninstall(selectedApp, e);
                    setSelectedApp(null);
                  }}
                >
                  Uninstall
                </Button>
                <Button
                  color="info"
                  variant="outlined"
                  startIcon={<RefreshCw size={16} />}
                  onClick={(e) => {
                    handleInstall(selectedApp, e);
                  }}
                >
                  {installedVersions[selectedApp.id] && selectedApp.version && installedVersions[selectedApp.id] !== selectedApp.version ? 'Update App' : 'Reinstall App'}
                </Button>
              </>
            )}
            <Box sx={{ marginLeft: 'auto', display: 'flex', gap: 1 }}>
              <Button onClick={() => setSelectedApp(null)} color="inherit">
                Close
              </Button>
              {installedAppIds.includes(selectedApp.id) ? (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<ExternalLink size={16} />}
                  onClick={(e) => {
                    handleOpenApp(selectedApp, e);
                    setSelectedApp(null);
                  }}
                >
                  Open App
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<Download size={16} />}
                  onClick={(e) => {
                    handleInstall(selectedApp, e);
                  }}
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
