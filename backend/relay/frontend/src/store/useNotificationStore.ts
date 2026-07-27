import { create } from 'zustand';
import type { AppNotification } from '../types';

interface NotificationState {
    notifications: AppNotification[];
    addNotification: (message: string, type?: AppNotification['type']) => void;
    removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    addNotification: (message, type = 'info') => {
        const id = Date.now().toString() + Math.random().toString();
        set((state) => ({ notifications: [...state.notifications, { id, message, type }] }));
        setTimeout(() => {
            set((state) => ({ notifications: state.notifications.filter(n => n.id !== id) }));
        }, 5000);
    },
    removeNotification: (id) => set((state) => ({ notifications: state.notifications.filter(n => n.id !== id) }))
}));
