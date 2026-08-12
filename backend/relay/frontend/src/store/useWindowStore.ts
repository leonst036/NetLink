import { create } from 'zustand';
import type { TerminalInstance, VncInstance, SftpInstance, DynamicAppInstance, PinnedApp } from '../types';

interface WindowState {
    activeWindow: string | null;
    graphWindow: { isOpen: boolean; isMinimized: boolean; zIndex: number };
    settingsWindow: { isOpen: boolean; isMinimized: boolean; zIndex: number };
    storeWindow: { isOpen: boolean; isMinimized: boolean; zIndex: number };
    terminals: TerminalInstance[];
    vncWindows: VncInstance[];
    sftpWindows: SftpInstance[];
    dynamicWindows: DynamicAppInstance[];
    pinnedApps: PinnedApp[];
    maximizedWindows: string[];

    setMaximized: (id: string, isMaximized: boolean) => void;

    setActiveWindow: (id: string | null) => void;
    setGraphWindow: (state: Partial<WindowState['graphWindow']>) => void;
    setSettingsWindow: (state: Partial<WindowState['settingsWindow']>) => void;
    setStoreWindow: (state: Partial<WindowState['storeWindow']>) => void;

    openTerminal: (ip: string) => void;
    closeTerminal: (id: string) => void;
    minimizeTerminal: (id: string, isMinimized: boolean) => void;

    openVnc: (ip: string) => void;
    closeVnc: (id: string) => void;
    minimizeVnc: (id: string, isMinimized: boolean) => void;

    openSftp: (ip: string) => void;
    closeSftp: (id: string) => void;
    minimizeSftp: (id: string, isMinimized: boolean) => void;

    openDynamicApp: (appId: string, title: string) => void;
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
    activeWindow: 'graph',
    graphWindow: { isOpen: true, isMinimized: false, zIndex: 1 },
    settingsWindow: { isOpen: false, isMinimized: false, zIndex: 1 },
    storeWindow: { isOpen: false, isMinimized: false, zIndex: 1 },
    terminals: [],
    vncWindows: [],
    sftpWindows: [],
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

    setGraphWindow: (state) => set((prev) => ({ graphWindow: { ...prev.graphWindow, ...state } })),
    setSettingsWindow: (state) => set((prev) => ({ settingsWindow: { ...prev.settingsWindow, ...state } })),
    setStoreWindow: (state) => set((prev) => ({ storeWindow: { ...prev.storeWindow, ...state } })),

    openTerminal: (ip) => {
        const id = `terminal-${Date.now()}`;
        set((state) => ({ terminals: [...state.terminals, { id, ip, isMinimized: false }], activeWindow: id }));
    },
    closeTerminal: (id) => set((state) => ({ terminals: state.terminals.filter(t => t.id !== id) })),
    minimizeTerminal: (id, isMinimized) => set((state) => ({
        terminals: state.terminals.map(t => t.id === id ? { ...t, isMinimized } : t)
    })),

    openVnc: (ip) => {
        const id = `vnc-${ip}-${Date.now()}`;
        set((state) => ({ vncWindows: [...state.vncWindows, { id, ip, isMinimized: false }], activeWindow: id }));
    },
    closeVnc: (id) => set((state) => ({ vncWindows: state.vncWindows.filter(t => t.id !== id) })),
    minimizeVnc: (id, isMinimized) => set((state) => ({
        vncWindows: state.vncWindows.map(t => t.id === id ? { ...t, isMinimized } : t)
    })),

    openSftp: (ip) => {
        const id = `sftp-${ip}-${Date.now()}`;
        set((state) => ({ sftpWindows: [...state.sftpWindows, { id, ip, isMinimized: false }], activeWindow: id }));
    },
    closeSftp: (id) => set((state) => ({ sftpWindows: state.sftpWindows.filter(t => t.id !== id) })),
    minimizeSftp: (id, isMinimized) => set((state) => ({
        sftpWindows: state.sftpWindows.map(t => t.id === id ? { ...t, isMinimized } : t)
    })),

    openDynamicApp: (appId, title) => {
        const existing = get().dynamicWindows.find(w => w.appId === appId);
        if (existing) {
            get().minimizeDynamicApp(existing.id, false);
            get().bringToFront(existing.id);
            return;
        }
        const id = `dynamic-${appId}-${Date.now()}`;
        set((state) => ({ dynamicWindows: [...state.dynamicWindows, { id, appId, title, isMinimized: false }], activeWindow: id }));
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
                if (Array.isArray(data.pinnedApps)) {
                    set({ pinnedApps: data.pinnedApps });
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
        if (id === 'graph') get().setGraphWindow({ isMinimized: false });
        else if (id === 'settings') get().setSettingsWindow({ isMinimized: false });
        else if (id === 'store') get().setStoreWindow({ isMinimized: false });
        else if (id.startsWith('terminal-')) get().minimizeTerminal(id, false);
        else if (id.startsWith('vnc-')) get().minimizeVnc(id, false);
        else if (id.startsWith('sftp-')) get().minimizeSftp(id, false);
        else if (id.startsWith('dynamic-')) get().minimizeDynamicApp(id, false);
    }
}));

