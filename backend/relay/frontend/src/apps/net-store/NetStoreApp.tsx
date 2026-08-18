import { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import './NetStoreApp.css';
import { useWindowStore } from '../../store/useWindowStore';
import AppIcon from '../../components/AppIcon';
import { useAppManager } from './AppManager';
import { type AppItem, type NetStoreAppProps, type MainTab } from './types';
import StoreSidebar from './components/StoreSidebar';
import StoreHeader from './components/StoreHeader';
import FeaturedAppBanner from './components/FeaturedAppBanner';
import AppGrid from './components/AppGrid';
import AppDetailsDialog from './components/AppDetailsDialog';

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

  const [debugConnected, setDebugConnected] = useState<boolean | null>(null);
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

        if (selectedBranch === 'local-debug') {
          setDebugConnected(catalogRes.ok && Array.isArray(catalogData) && catalogData.length > 0);
        } else {
          setDebugConnected(null);
        }

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
        if (selectedBranch === 'local-debug') {
          setDebugConnected(false);
        }
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
          <AppGrid
            apps={filteredApps}
            installedAppIds={installedAppIds}
            installedVersions={installedVersions}
            installingMap={installingMap}
            isPinned={(id) => windowStore.isPinned(id)}
            onSelectApp={setSelectedApp}
            onOpenApp={handleOpenApp}
            onInstall={handleInstall}
            onUninstall={handleUninstall}
            onTogglePin={(app, e) => {
              e.stopPropagation();
              windowStore.togglePinApp({
                appId: app.id,
                title: app.name,
                icon: app.rawIcon,
                color: app.color
              });
            }}
          />
        </Box>
      </Box>

      {/* App Detail Dialog */}
      <AppDetailsDialog
        app={selectedApp}
        isOpen={Boolean(selectedApp)}
        onClose={() => setSelectedApp(null)}
        isInstalled={selectedApp ? installedAppIds.includes(selectedApp.id) : false}
        isPinned={selectedApp ? windowStore.isPinned(selectedApp.id) : false}
        installedVersion={selectedApp ? installedVersions[selectedApp.id] : undefined}
        installProgress={selectedApp ? installingMap[selectedApp.id] : undefined}
        onOpenApp={handleOpenApp}
        onInstall={handleInstall}
        onUninstall={handleUninstall}
        onTogglePin={(app, e) => {
          if (e) e.stopPropagation();
          windowStore.togglePinApp({
            appId: app.id,
            title: app.name,
            icon: app.rawIcon,
            color: app.color
          });
        }}
      />
    </Box>
  );
}