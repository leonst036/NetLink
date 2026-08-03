import { create } from 'zustand';
import type { TerminalInstance, VncInstance, SftpInstance } from '../types';

interface WindowState {
    activeWindow: string | null;
    graphWindow: { isOpen: boolean; isMinimized: boolean; zIndex: number };
    settingsWindow: { isOpen: boolean; isMinimized: boolean; zIndex: number };
    terminals: TerminalInstance[];
    vncWindows: VncInstance[];
    sftpWindows: SftpInstance[];

    setActiveWindow: (id: string | null) => void;
    setGraphWindow: (state: Partial<WindowState['graphWindow']>) => void;
    setSettingsWindow: (state: Partial<WindowState['settingsWindow']>) => void;

    openTerminal: (ip: string) => void;
    closeTerminal: (id: string) => void;
    minimizeTerminal: (id: string, isMinimized: boolean) => void;

    openVnc: (ip: string) => void;
    closeVnc: (id: string) => void;
    minimizeVnc: (id: string, isMinimized: boolean) => void;

    openSftp: (ip: string) => void;
    closeSftp: (id: string) => void;
    minimizeSftp: (id: string, isMinimized: boolean) => void;

    bringToFront: (id: string) => void;
}

export const useWindowStore = create<WindowState>((set, get) => ({
    activeWindow: 'graph',
    graphWindow: { isOpen: true, isMinimized: false, zIndex: 1 },
    settingsWindow: { isOpen: false, isMinimized: false, zIndex: 1 },
    terminals: [],
    vncWindows: [],
    sftpWindows: [],

    setActiveWindow: (id) => set({ activeWindow: id }),

    setGraphWindow: (state) => set((prev) => ({ graphWindow: { ...prev.graphWindow, ...state } })),
    setSettingsWindow: (state) => set((prev) => ({ settingsWindow: { ...prev.settingsWindow, ...state } })),

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

    bringToFront: (id) => {
        set({ activeWindow: id });
        if (id === 'graph') get().setGraphWindow({ isMinimized: false });
        else if (id === 'settings') get().setSettingsWindow({ isMinimized: false });
        else if (id.startsWith('terminal-')) get().minimizeTerminal(id, false);
        else if (id.startsWith('vnc-')) get().minimizeVnc(id, false);
        else if (id.startsWith('sftp-')) get().minimizeSftp(id, false);
    }
}));
