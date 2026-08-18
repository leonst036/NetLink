export interface AppItem {
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
    rawIcon?: string;
    shortDesc: string;
    fullDesc: string;
    features: string[];
    isFeatured?: boolean;
    entrypoint?: string;
    main?: string;
}

export type MainTab = 'discover' | 'all' | 'installed' | 'updates';
export type BranchType = 'main' | 'dev' | 'local-debug';
export interface NetStoreAppProps {
    token?: string;
    target?: string;
}