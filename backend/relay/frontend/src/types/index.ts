export interface AppNotification {
    id: string;
    message: string;
    type: 'info' | 'success' | 'error';
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

export interface ServerDevice {
    ip: string;
    hostname: string;
    mac: string;
    ports: any[];
    os: string;
    lastSeen: string;
    isOnline: boolean;
}
