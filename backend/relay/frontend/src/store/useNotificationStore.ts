import { create } from 'zustand';
import type { AppNotification } from '../types';

interface NotificationState {
    notifications: AppNotification[];
    history: AppNotification[];
    addNotification: (message: string, type?: AppNotification['type']) => void;
    removeNotification: (id: string) => void;
    clearHistory: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    history: [],
    addNotification: (message, type = 'info') => {
        const id = Date.now().toString() + Math.random().toString();
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const item: AppNotification = { id, message, type, timestamp };

        set((state) => ({
            notifications: [...state.notifications, item],
            history: [item, ...state.history].slice(0, 30)
        }));

        setTimeout(() => {
            set((state) => ({ notifications: state.notifications.filter(n => n.id !== id) }));
        }, 5000);
    },
    removeNotification: (id) => set((state) => ({ notifications: state.notifications.filter(n => n.id !== id) })),
    clearHistory: () => set({ history: [] })
}));

