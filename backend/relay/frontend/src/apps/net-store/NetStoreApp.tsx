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
  IconButton
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
  Network,
  Terminal,
  Monitor,
  Folder,
  Settings,
  ShieldAlert,
  Lock,
  Activity,
  Cpu,
  Zap,
  Database,
  FileText,
  X,
  Sparkles
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

const STORE_CATALOG: AppItem[] = [
  {
    id: 'net-graph',
    name: 'Network Topology Explorer',
    author: 'NetLink Core',
    category: 'Monitoring',
    rating: 4.9,
    downloads: '12.4k',
    size: '1.2 MB',
    version: 'v2.4.0',
    nativeKey: 'graph',
    color: '#38bdf8',
    icon: <Network size={22} color="#38bdf8" />,
    shortDesc: 'Interactive network visualization map with node inspection, live ping monitors, and auto-discovery.',
    fullDesc: 'The Network Topology Explorer provides full visibility into your connected subnet infrastructure. View live node statuses, auto-detect active gateway IP addresses, inspect node detail cards, and initiate remote terminal or VNC sessions directly from the graph canvas.',
    features: [
      'Real-time interactive canvas with pan and zoom',
      'Auto-discovery of active network nodes',
      'Direct terminal, VNC, and SFTP session launcher',
      'WebSocket live status streaming'
    ],
    isFeatured: true
  },
  {
    id: 'port-sentinel',
    name: 'Port Sentinel Scanner',
    author: 'SecurityLab',
    category: 'Security',
    rating: 4.9,
    downloads: '8.7k',
    size: '3.4 MB',
    version: 'v1.8.2',
    color: '#f43f5e',
    icon: <ShieldAlert size={22} color="#f43f5e" />,
    shortDesc: 'Ultra-fast stealth TCP/UDP port scanner and service banner auditor for target hosts.',
    fullDesc: 'Port Sentinel allows network administrators and security engineers to audit open ports across internal and external subnets. It supports multi-threaded SYN scanning, service version detection, OS fingerprinting, and automated vulnerability check reporting.',
    features: [
      'High-speed multi-threaded SYN & UDP scan engine',
      'Service banner grabbing and version detection',
      'CVE vulnerability correlation',
      'Exportable PDF & JSON security audit reports'
    ],
    isFeatured: true
  },
  {
    id: 'net-terminal',
    name: 'NetLink Terminal',
    author: 'NetLink Core',
    category: 'Remote Access',
    rating: 4.8,
    downloads: '18.9k',
    size: '850 KB',
    version: 'v3.1.0',
    nativeKey: 'terminal',
    color: '#a78bfa',
    icon: <Terminal size={22} color="#a78bfa" />,
    shortDesc: 'Full xterm-compatible SSH and remote shell terminal with multi-tab session management.',
    fullDesc: 'Powerful, full-featured web terminal engine supporting ANSI colors, custom shortcuts, session logging, and direct SSH relay bridging to target nodes without third-party plugins.',
    features: [
      'Full xterm.js emulation engine',
      'Multi-tab concurrent session support',
      'Custom color schemes and font sizing',
      'Session history & command completion'
    ]
  },
  {
    id: 'vnc-viewer',
    name: 'VNC Remote Desktop',
    author: 'NetLink Core',
    category: 'Remote Access',
    rating: 4.7,
    downloads: '9.2k',
    size: '2.1 MB',
    version: 'v1.5.0',
    nativeKey: 'vnc',
    color: '#10b981',
    icon: <Monitor size={22} color="#10b981" />,
    shortDesc: 'High-performance graphical remote desktop control via web VNC protocol with scaling.',
    fullDesc: 'Access graphical Linux and Windows remote desktops directly inside your browser window. Features RFB protocol compression, automatic desktop resolution scaling, and seamless clipboard synchronization.',
    features: [
      'Ultra-low latency HTML5 VNC client',
      'Seamless remote clipboard copy & paste',
      'Fullscreen and dynamic window scaling',
      'Encrypted password storage'
    ]
  },
  {
    id: 'sftp-client',
    name: 'File Manager & SFTP',
    author: 'NetLink Core',
    category: 'Utilities',
    rating: 4.6,
    downloads: '15.1k',
    size: '1.8 MB',
    version: 'v2.0.4',
    nativeKey: 'sftp',
    color: '#fb923c',
    icon: <Folder size={22} color="#fb923c" />,
    shortDesc: 'Remote file browser supporting SFTP file transfer, code editing, and permission controls.',
    fullDesc: 'Dual-pane remote file browser enabling fast drag-and-drop file transfers between your local desktop and target servers. Includes built-in code editor with syntax highlighting.',
    features: [
      'Dual-pane remote filesystem navigation',
      'Integrated syntax-highlighted code editor',
      'Batch file upload and download queues',
      'Linux file permissions (chmod/chown) manager'
    ]
  },
];

type MainTab = 'discover' | 'all' | 'installed' | 'updates';

interface NetStoreAppProps {
  token?: string;
}

export default function NetStoreApp(_props: NetStoreAppProps) {
  const [activeTab, setActiveTab] = useState<MainTab>('discover');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);

  // Installed App State with localStorage persistence
  const [installedAppIds, setInstalledAppIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('netstore_installed_apps');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load installed apps', e);
    }
    return ['net-graph', 'net-terminal', 'vnc-viewer', 'sftp-client', 'sys-settings'];
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

    let progress = 15;
    const interval = setInterval(() => {
      progress += 35;
      if (progress >= 100) {
        clearInterval(interval);
        setInstallingMap((prev) => {
          const copy = { ...prev };
          delete copy[app.id];
          return copy;
        });
        setInstalledAppIds((prev) => [...prev, app.id]);
        notifyUser(`${app.name} has been installed!`, 'success');
      } else {
        setInstallingMap((prev) => ({ ...prev, [app.id]: progress }));
      }
    }, 350);
  };

  const handleUninstall = (app: AppItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (app.nativeKey) {
      notifyUser(`System app ${app.name} cannot be uninstalled.`, 'warning');
      return;
    }
    setInstalledAppIds((prev) => prev.filter((id) => id !== app.id));
    notifyUser(`${app.name} was uninstalled.`, 'info');
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
      notifyUser(`Opening ${app.name}...`, 'info');
    } else {
      notifyUser(`Opening ${app.name}...`, 'info');
    }
  };

  const tabs = [
    { id: 'discover', label: 'Discover', icon: <ShoppingBag size={18} /> },
    { id: 'all', label: 'All Applications', icon: <LayoutGrid size={18} /> },
    { id: 'installed', label: `Installed (${installedAppIds.length})`, icon: <CheckCircle2 size={18} /> },
    { id: 'updates', label: 'Updates (2)', icon: <RefreshCw size={18} /> },
  ];

  const categories = ['All', 'Monitoring', 'Security', 'Remote Access', 'Utilities', 'Developer Tools', 'System'];

  const filteredApps = STORE_CATALOG.filter((app) => {
    if (activeTab === 'installed' && !installedAppIds.includes(app.id)) return false;
    if (activeTab === 'updates' && app.id !== 'wireshark-web' && app.id !== 'net-graph') return false;

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

  const featuredApp = STORE_CATALOG[0];

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
          {activeTab === 'discover' && !searchQuery && selectedCategory === 'All' && (
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
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<ExternalLink size={16} />}
                      onClick={(e) => handleOpenApp(featuredApp, e)}
                    >
                      Open Application
                    </Button>
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
                          <Button size="small" variant="outlined" disabled>
                            Installing...
                          </Button>
                        ) : isInstalled ? (
                          activeTab === 'updates' ? (
                            <Button
                              size="small"
                              variant="contained"
                              color="info"
                              onClick={(e) => {
                                e.stopPropagation();
                                notifyUser(`Updated ${app.name}!`, 'success');
                              }}
                            >
                              Update
                            </Button>
                          ) : (
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              startIcon={<ExternalLink size={14} />}
                              onClick={(e) => handleOpenApp(app, e)}
                            >
                              Open
                            </Button>
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
              <Button
                color="error"
                onClick={(e) => {
                  handleUninstall(selectedApp, e);
                  setSelectedApp(null);
                }}
              >
                Uninstall
              </Button>
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
