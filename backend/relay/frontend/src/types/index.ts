export interface AppNotification {
    id: string;
    message: string;
    type: 'info' | 'success' | 'error';
    timestamp?: string;
}


export interface TerminalInstance {
    id: string;
    ip: string;
    isMinimized: boolean;
}

export interface VncInstance {
    id: string;
    ip: string;
    isMinimized: boolean;
}

export interface SftpInstance {
    id: string;
    ip: string;
    isMinimized: boolean;
}

export interface DynamicAppInstance {
    id: string; // The window ID
    appId: string; // The NetStore app ID
    title: string;
    isMinimized: boolean;
}

export interface ServerDevice {
    ip: string;
    hostname: string;
    mac: string;
    ports: any[];
    os: string;
    lastSeen: string;
    isOnline: boolean;
}
