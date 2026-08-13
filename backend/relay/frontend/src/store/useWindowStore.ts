import { create } from 'zustand';
import type { DynamicAppInstance, PinnedApp } from '../types';

interface WindowState {
    activeWindow: string | null;
    storeWindow: { isOpen: boolean; isMinimized: boolean; zIndex: number };
    dynamicWindows: DynamicAppInstance[];
    pinnedApps: PinnedApp[];
    maximizedWindows: string[];

    setMaximized: (id: string, isMaximized: boolean) => void;

    setActiveWindow: (id: string | null) => void;
    setStoreWindow: (state: Partial<WindowState['storeWindow']>) => void;

    openDynamicApp: (appId: string, title: string, extraParams?: Record<string, string>) => void;
    closeDynamicApp: (id: string) => void;
    minimizeDynamicApp: (id: string, isMinimized: boolean) => void;

    fetchDockConfig: () => Promise<void>;
    saveDockConfig: (pinnedApps: PinnedApp[]) => Promise<void>;
    pinApp: (app: PinnedApp) => Promise<void>;
    unpinApp: (appId: string) => Promise<void>;
    isPinned: (appId: string) => boolean;
    togglePinApp: (app: PinnedApp) => Promise<void>;

    bringToFront: (id: string) => void;
}

export const useWindowStore = create<WindowState>((set, get) => ({
    activeWindow: 'store',
    storeWindow: { isOpen: false, isMinimized: false, zIndex: 1 },
    dynamicWindows: [],
    pinnedApps: [],
    maximizedWindows: [],

    setMaximized: (id, isMaximized) => set((state) => {
        const currentlyMaximized = state.maximizedWindows.includes(id);
        if (isMaximized && !currentlyMaximized) {
            return { maximizedWindows: [...state.maximizedWindows, id] };
        }
        if (!isMaximized && currentlyMaximized) {
            return { maximizedWindows: state.maximizedWindows.filter(w => w !== id) };
        }
        return state;
    }),

    setActiveWindow: (id) => set({ activeWindow: id }),

    setStoreWindow: (state) => set((prev) => ({ storeWindow: { ...prev.storeWindow, ...state } })),

    openDynamicApp: (appId, title, extraParams = {}) => {
        const existing = get().dynamicWindows.find(w => w.appId === appId);
        if (existing) {
            get().minimizeDynamicApp(existing.id, false);
            get().bringToFront(existing.id);
            return;
        }
        const id = `dynamic-${appId}-${Date.now()}`;
        set((state) => ({ dynamicWindows: [...state.dynamicWindows, { id, appId, title, isMinimized: false, extraParams }], activeWindow: id }));
    },
    closeDynamicApp: (id) => set((state) => ({ dynamicWindows: state.dynamicWindows.filter(t => t.id !== id) })),
    minimizeDynamicApp: (id, isMinimized) => set((state) => ({
        dynamicWindows: state.dynamicWindows.map(t => t.id === id ? { ...t, isMinimized } : t)
    })),

    fetchDockConfig: async () => {
        try {
            const token = localStorage.getItem('netlink_token');
            const res = await fetch('/api/dock', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.pinnedApps) && data.pinnedApps.length > 0) {
                    set({ pinnedApps: data.pinnedApps });
                } else {
                    // Inject default pinned apps if empty
                    const defaultPinned: PinnedApp[] = [
                        { appId: 'net-graph', title: 'Network Graph', color: '#10b981' },
                        { appId: 'net-terminal', title: 'Remote Terminal', color: '#f59e0b' },
                        { appId: 'sftp-client', title: 'SFTP Client', color: '#ec4899' },
                        { appId: 'sys-settings', title: 'System Settings', color: '#94a3b8' },
                        { appId: 'vnc-viewer', title: 'VNC Viewer', color: '#6366f1' }
                    ];
                    set({ pinnedApps: defaultPinned });
                }
            }
        } catch (e) {
            console.warn('Failed to fetch dock config from server:', e);
        }
    },

    saveDockConfig: async (newPinnedApps: PinnedApp[]) => {
        set({ pinnedApps: newPinnedApps });
        try {
            const token = localStorage.getItem('netlink_token');
            await fetch('/api/dock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ pinnedApps: newPinnedApps })
            });
        } catch (e) {
            console.warn('Failed to save dock config to server:', e);
        }
    },

    pinApp: async (app: PinnedApp) => {
        const current = get().pinnedApps;
        if (current.some(p => p.appId === app.appId)) return;
        const updated = [...current, app];
        await get().saveDockConfig(updated);
    },

    unpinApp: async (appId: string) => {
        const current = get().pinnedApps;
        const updated = current.filter(p => p.appId !== appId);
        await get().saveDockConfig(updated);
    },

    isPinned: (appId: string) => {
        return get().pinnedApps.some(p => p.appId === appId);
    },

    togglePinApp: async (app: PinnedApp) => {
        if (get().isPinned(app.appId)) {
            await get().unpinApp(app.appId);
        } else {
            await get().pinApp(app);
        }
    },

    bringToFront: (id) => {
        set({ activeWindow: id });
        if (id === 'store') get().setStoreWindow({ isMinimized: false });
        else if (id.startsWith('dynamic-')) get().minimizeDynamicApp(id, false);
    }
}));

