import { Paper, Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem, Chip, Tooltip, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { Store, Search, CheckCircle2, AlertTriangle, RefreshCw, Server, ShoppingBag, LayoutGrid } from 'lucide-react';
import { type MainTab, type BranchType } from '../types'

export interface StoreSidebarProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    selectedBranch: BranchType;
    onBranchChange: (branch: BranchType) => void;
    selectedLocalBranch: string;
    onLocalBranchChange: (branch: string) => void;
    debugStoreUrl: string;
    onDebugStoreUrlChange: (url: string) => void;
    debugConnected: boolean | null;
    debugBranches: string[];
    onRefresh: () => void;
    activeTab: MainTab;
    onTabChange: (tab: MainTab) => void;
    selectedCategory: string;
    onCategoryChange: (category: string) => void;
    installedCount: number;
    updatesCount: number;
    categories: string[];
    netlink_debug?: boolean;
}

const SidebarHeader = () => {
    return (
        <Box className="netstore-sidebar-header">
            <Store size={24} color="#ec4899" />
            <Box>
                <Typography variant="subtitle1" className="netstore-sidebar-title">
                    NetStore
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    Application Market
                </Typography>
            </Box>
        </Box>
    )
}

const SidebarSearch = ({ searchQuery, onSearchChange }: StoreSidebarProps) => {
    return (
        <Box className="netstore-sidebar-search">
            <TextField
                size="small"
                placeholder="Search store..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                fullWidth
                slotProps={{
                    input: {
                        startAdornment: <Search size={16} style={{ marginRight: 8, color: '#94a3b8' }} />
                    }
                }}
            />
        </Box>
    )
}

const SidebarBranchSelector = ({ selectedBranch, onBranchChange }: StoreSidebarProps) => {
    return (
        <Box sx={{ px: 2, pb: 1.5 }}>
            <FormControl fullWidth size="small" variant="outlined">
                <InputLabel id="branch-select-label" sx={{ fontSize: '0.8rem' }}>Store Channel</InputLabel>
                <Select
                    labelId="branch-select-label"
                    value={selectedBranch}
                    onChange={(e) => onBranchChange(e.target.value as BranchType)}
                    label="Store Channel"
                    sx={{ fontSize: '0.85rem' }}
                >
                    <MenuItem value="main">Stable (main)</MenuItem>
                    <MenuItem value="dev">Developer (dev)</MenuItem>
                    <MenuItem value="local-debug">🛠️ Local Debug (Docker)</MenuItem>
                </Select>
            </FormControl>
        </Box>
    )
}

const SidebarDebugControls = ({
    netlink_debug = false,
    selectedBranch,
    debugConnected,
    onRefresh,
    selectedLocalBranch,
    onLocalBranchChange,
    debugBranches,
    debugStoreUrl,
    onDebugStoreUrlChange,
}: StoreSidebarProps) => {
    if (!netlink_debug) return null;

    if (selectedBranch !== 'local-debug') return null;

    return (
        <Box sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Status Bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'rgba(255, 255, 255, 0.03)', p: 1, borderRadius: 1, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                {debugConnected === true ? (
                    <Chip
                        size="small"
                        icon={<CheckCircle2 size={12} style={{ color: '#10b981' }} />}
                        label="Docker Online"
                        sx={{ bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '0.75rem', fontWeight: 600, height: 24, border: '1px solid rgba(16, 185, 129, 0.25)' }}
                    />
                ) : (
                    <Tooltip title="Start Docker debug server: ./start-debug.sh in NetLink-NetStore" arrow>
                        <Chip
                            size="small"
                            icon={<AlertTriangle size={12} style={{ color: '#f43f5e' }} />}
                            label="Docker Offline"
                            sx={{ bgcolor: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', fontSize: '0.75rem', fontWeight: 600, height: 24, border: '1px solid rgba(244, 63, 94, 0.25)' }}
                        />
                    </Tooltip>
                )}
                <IconButton size="small" onClick={onRefresh} sx={{ color: '#94a3b8', p: 0.5 }}>
                    <RefreshCw size={14} />
                </IconButton>
            </Box>

            {/* Local Branch Select */}
            <FormControl fullWidth size="small" variant="outlined">
                <InputLabel id="local-branch-label" sx={{ fontSize: '0.8rem' }}>Local Branch</InputLabel>
                <Select
                    labelId="local-branch-label"
                    value={selectedLocalBranch}
                    onChange={(e) => onLocalBranchChange(e.target.value)}
                    label="Local Branch"
                    sx={{ fontSize: '0.82rem' }}
                >
                    {debugBranches.map((b) => (
                        <MenuItem key={b} value={b} sx={{ fontSize: '0.85rem' }}>
                            {b === 'workspace' ? '📁 workspace (live)' : `🌿 ${b}`}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {/* Docker Server URL */}
            <TextField
                size="small"
                label="Docker Store URL"
                value={debugStoreUrl}
                onChange={(e) => onDebugStoreUrlChange(e.target.value)}
                fullWidth
                slotProps={{
                    input: {
                        sx: { fontSize: '0.8rem' },
                        startAdornment: <Server size={13} style={{ marginRight: 6, color: '#94a3b8' }} />
                    }
                }}
            />
        </Box>
    )
}

const SidebarMenuList = ({
    activeTab,
    onTabChange,
    onCategoryChange,
    installedCount,
    updatesCount,
}: StoreSidebarProps) => {
    const tabs = [
        { id: 'discover', label: 'Discover', icon: <ShoppingBag size={18} /> },
        { id: 'all', label: 'All Applications', icon: <LayoutGrid size={18} /> },
        { id: 'installed', label: `Installed (${installedCount})`, icon: <CheckCircle2 size={18} /> },
        { id: 'updates', label: `Updates (${updatesCount})`, icon: <RefreshCw size={18} /> },
    ];

    return (
        <List className="netstore-sidebar-list">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <ListItem key={tab.id} disablePadding className="netstore-tab-item">
                        <ListItemButton
                            className="netstore-tab-button"
                            selected={isActive}
                            onClick={() => {
                                onTabChange(tab.id as MainTab);
                                if (tab.id !== 'all') onCategoryChange('All');
                            }}
                        >
                            <ListItemIcon className="netstore-tab-icon" sx={{ color: isActive ? 'primary.main' : 'inherit' }}>
                                {tab.icon}
                            </ListItemIcon>
                            <ListItemText
                                primary={tab.label}
                                slotProps={{
                                    primary: {
                                        variant: 'body2',
                                        sx: {
                                            fontWeight: isActive ? 'bold' : 'normal',
                                            color: isActive ? 'primary.main' : 'inherit'
                                        }
                                    }
                                }}
                            />
                        </ListItemButton>
                    </ListItem>
                );
            })}
        </List>
    );
};

const SidebarCategoryFilter = ({
    categories,
    selectedCategory,
    onCategoryChange,
    activeTab,
    onTabChange,
}: StoreSidebarProps) => {
    return (
        <>
            <Typography className="netstore-sidebar-section-label">
                Categories
            </Typography>
            <List className="netstore-sidebar-list" sx={{ pt: 0 }}>
                {categories.map((cat) => {
                    const isActive = selectedCategory === cat;
                    return (
                        <ListItem key={cat} disablePadding className="netstore-tab-item">
                            <ListItemButton
                                className="netstore-tab-button"
                                selected={isActive}
                                onClick={() => {
                                    onCategoryChange(cat);
                                    if (activeTab === 'discover') onTabChange('all');
                                }}
                            >
                                <ListItemText
                                    primary={cat}
                                    slotProps={{
                                        primary: {
                                            variant: 'body2',
                                            sx: {
                                                fontSize: '0.825rem',
                                                fontWeight: isActive ? 'bold' : 'normal',
                                                color: isActive ? 'primary.main' : 'text.secondary'
                                            }
                                        }
                                    }}
                                />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>
        </>
    );
};

{/*Export Sidebar with all components*/ }

export const StoreSidebar = (props: StoreSidebarProps) => {
    return (
        <Paper className="netstore-sidebar" elevation={0}>
            <SidebarHeader />
            <SidebarSearch {...props} />
            <SidebarBranchSelector {...props} />
            <SidebarDebugControls {...props} />
            <SidebarMenuList {...props} />
            <SidebarCategoryFilter {...props} />
        </Paper>
    );
};

export default StoreSidebar;
