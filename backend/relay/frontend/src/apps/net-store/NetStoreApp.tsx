import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ShoppingBag,
  RefreshCw,
  Star,
  Download,
  ExternalLink,
  X,
  Trash2,
  Pin,
  PinOff,
} from 'lucide-react';
import './NetStoreApp.css';
import { useWindowStore } from '../../store/useWindowStore';
import AppIcon from '../../components/AppIcon';
import { useAppManager } from './AppManager';
import { type AppItem, type NetStoreAppProps, type MainTab } from './types'
import StoreSidebar from './components/StoreSidebar';
import StoreHeader from './components/StoreHeader';
import FeaturedAppBanner from './components/FeaturedAppBanner';
import AppCard from './components/AppCard';

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

  const [debugConnected] = useState<boolean | null>(null);
  const [debugBranches] = useState<string[]>(['workspace', 'main', 'dev']);
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

  const { handleInstall, handleUninstall } = useAppManager({
    target: props.target,
    token: props.token,
    selectedBranch,
    selectedLocalBranch,
    debugStoreUrl,
    installingMap,
    setInstallingMap,
    setInstalledAppIds,
    setInstalledVersions,
    notifyUser
  });

  const [runInBackground, setRunInBackground] = useState<boolean>(false);

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
      <StoreSidebar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedBranch={selectedBranch}
        onBranchChange={setSelectedBranch}
        selectedLocalBranch={selectedLocalBranch}
        onLocalBranchChange={setSelectedLocalBranch}
        debugStoreUrl={debugStoreUrl}
        onDebugStoreUrlChange={setDebugStoreUrl}
        debugConnected={debugConnected}
        debugBranches={debugBranches}
        onRefresh={() => setRefreshIndex((prev) => prev + 1)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        installedCount={installedCount}
        updatesCount={updatesCount}
        categories={categories}
        netlink_debug={true}
      />

      {/* Main Content Area */}
      <Box className="netstore-main">
        <Box className="netstore-content-max">
          {/* Featured Banner on Discover Tab */}
          <FeaturedAppBanner
            featuredApp={featuredApp}
            isInstalled={featuredApp ? installedAppIds.includes(featuredApp.id) : false}
            activeTab={activeTab}
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
            onOpenApp={handleOpenApp}
            onInstall={handleInstall}
            onUninstall={handleUninstall}
            onSelectDetails={setSelectedApp}
          />

          {/* Section Header */}
          <StoreHeader
            activeTab={activeTab}
            selectedCategory={selectedCategory}
            selectedBranch={selectedBranch}
            selectedLocalBranch={selectedLocalBranch}
            totalApps={filteredApps.length}
          />

          {/* App Cards Grid */}
          {filteredApps.length > 0 ? (
            <Box className="netstore-grid">
              {filteredApps.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  isInstalled={installedAppIds.includes(app.id)}
                  isPinned={windowStore.isPinned(app.id)}
                  installedVersion={installedVersions[app.id]}
                  installProgress={installingMap[app.id]}
                  onSelect={(selected) => setSelectedApp(selected)}
                  onOpenApp={(selected, e) => handleOpenApp(selected, e)}
                  onInstall={(selected, e) => handleInstall(selected, e)}
                  onUninstall={(selected, e) => handleUninstall(selected, e)}
                  onTogglePin={(selected, e) => {
                    e.stopPropagation();
                    windowStore.togglePinApp({ appId: selected.id, title: selected.name, icon: selected.rawIcon, color: selected.color });
                  }}
                />
              ))}
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