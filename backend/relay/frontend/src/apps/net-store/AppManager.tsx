import type React from 'react';
import type { AppItem } from './types.ts';
import { useWindowStore } from '../../store/useWindowStore';

export interface AppManagerOptions {
    target?: string;
    token?: string;
    selectedBranch: 'main' | 'dev' | 'local-debug';
    selectedLocalBranch?: string;
    debugStoreUrl?: string;
    installingMap: Record<string, number>;
    setInstallingMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    setInstalledAppIds: React.Dispatch<React.SetStateAction<string[]>>;
    setInstalledVersions: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    notifyUser: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const installApp = async (
    app: AppItem,
    options: AppManagerOptions,
    e?: React.MouseEvent,
    runInBg: boolean = false
) => {
    if (e) e.stopPropagation();
    if (options.installingMap[app.id]) return;

    options.setInstallingMap((prev) => ({ ...prev, [app.id]: 15 }));

    const targetId = options.target || "local-server";
    const isDebug = options.selectedBranch === 'local-debug';
    const effectiveBranch = isDebug ? (options.selectedLocalBranch || 'workspace') : options.selectedBranch;
    const effectiveCustomStoreUrl = isDebug ? options.debugStoreUrl : undefined;

    try {
        const res = await fetch('/api/applications/install', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(options.token ? { 'Authorization': `Bearer ${options.token}` } : {})
            },
            body: JSON.stringify({
                appId: app.id,
                target: targetId,
                branch: effectiveBranch,
                runInBackground: runInBg,
                customStoreUrl: effectiveCustomStoreUrl
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to install application');
        }

        await res.json();

        options.setInstallingMap((prev) => {
            const copy = { ...prev };
            delete copy[app.id];
            return copy;
        });
        options.setInstalledAppIds((prev) => Array.from(new Set([...prev, app.id])));
        options.setInstalledVersions((prev) => ({ ...prev, [app.id]: app.version || 'v1.0.0' }));

        useWindowStore.getState().registerAppMetadata([{
            id: app.id,
            title: app.name,
            icon: app.rawIcon,
            color: app.color
        }]);

        options.notifyUser(`${app.name} installed / updated successfully!`, 'success');
        window.dispatchEvent(new CustomEvent('netlink_apps_updated', { detail: { appId: app.id } }));
    } catch (err: any) {
        console.error(err);
        options.notifyUser(`Failed to install ${app.name}: ${err.message}`, 'warning');
        options.setInstallingMap((prev) => {
            const copy = { ...prev };
            delete copy[app.id];
            return copy;
        });
    }
};

export const uninstallApp = async (
    app: AppItem,
    options: Pick<AppManagerOptions, 'target' | 'token' | 'setInstalledAppIds' | 'setInstalledVersions' | 'notifyUser'>,
    e?: React.MouseEvent
) => {
    if (e) e.stopPropagation();
    if (app.nativeKey) {
        options.notifyUser(`System app ${app.name} cannot be uninstalled.`, 'warning');
        return;
    }

    const targetId = options.target || "local-server";

    try {
        const res = await fetch('/api/applications/uninstall', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(options.token ? { 'Authorization': `Bearer ${options.token}` } : {})
            },
            body: JSON.stringify({ appId: app.id, target: targetId })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to uninstall application');
        }

        await res.json();

        options.setInstalledAppIds((prev) => prev.filter((id) => id !== app.id));
        options.setInstalledVersions((prev) => {
            const copy = { ...prev };
            delete copy[app.id];
            return copy;
        });
        options.notifyUser(`${app.name} was uninstalled.`, 'info');
        window.dispatchEvent(new CustomEvent('netlink_apps_updated', { detail: { appId: app.id } }));
    } catch (err: any) {
        console.error(err);
        options.notifyUser(`Failed to uninstall ${app.name}: ${err.message}`, 'warning');
    }
};

export const useAppManager = (options: AppManagerOptions) => {
    const handleInstall = (app: AppItem, e?: React.MouseEvent, runInBg: boolean = false) => {
        return installApp(app, options, e, runInBg);
    };

    const handleUninstall = (app: AppItem, e?: React.MouseEvent) => {
        return uninstallApp(app, options, e);
    };

    return {
        handleInstall,
        handleUninstall
    };
};