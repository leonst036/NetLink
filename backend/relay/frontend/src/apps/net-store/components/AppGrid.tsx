import type React from 'react';
import { Box, Typography } from '@mui/material';
import { ShoppingBag } from 'lucide-react';
import { type AppItem } from '../types';
import AppCard from './AppCard';

export interface AppGridProps {
    apps: AppItem[];
    installedAppIds: string[];
    installedVersions: Record<string, string>;
    installingMap: Record<string, number>;
    isPinned: (id: string) => boolean;
    onSelectApp: (app: AppItem) => void;
    onOpenApp: (app: AppItem, e: React.MouseEvent) => void;
    onInstall: (app: AppItem, e: React.MouseEvent) => void;
    onUninstall: (app: AppItem, e: React.MouseEvent) => void;
    onTogglePin: (app: AppItem, e: React.MouseEvent) => void;
}

export const AppGrid = ({
    apps,
    installedAppIds,
    installedVersions,
    installingMap,
    isPinned,
    onSelectApp,
    onOpenApp,
    onInstall,
    onUninstall,
    onTogglePin,
}: AppGridProps) => {
    if (apps.length === 0) {
        return (
            <Box className="netstore-empty">
                <ShoppingBag size={40} />
                <Typography variant="h6">No applications found</Typography>
                <Typography variant="body2" color="text.secondary">
                    Try clearing your search or switching categories.
                </Typography>
            </Box>
        );
    }

    return (
        <Box className="netstore-grid">
            {apps.map((app) => (
                <AppCard
                    key={app.id}
                    app={app}
                    isInstalled={installedAppIds.includes(app.id)}
                    isPinned={isPinned(app.id)}
                    installedVersion={installedVersions[app.id]}
                    installProgress={installingMap[app.id]}
                    onSelect={onSelectApp}
                    onOpenApp={onOpenApp}
                    onInstall={onInstall}
                    onUninstall={onUninstall}
                    onTogglePin={onTogglePin}
                />
            ))}
        </Box>
    );
};

export default AppGrid;