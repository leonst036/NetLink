import type { AppItem, MainTab } from "../types";
import { Card, Box, Chip, Typography, Button } from "@mui/material";
import { Sparkles, ExternalLink, RefreshCw, Download } from "lucide-react";

export interface FeaturedAppBannerProps {
    featuredApp: AppItem | null;
    isInstalled: boolean;
    activeTab?: MainTab;
    searchQuery?: string;
    selectedCategory?: string;
    onOpenApp: (app: AppItem, e?: React.MouseEvent) => void;
    onInstall: (app: AppItem, e?: React.MouseEvent) => void;
    onUninstall: (app: AppItem, e?: React.MouseEvent) => void;
    onSelectDetails: (app: AppItem) => void;
}

export const FeaturedAppBanner = ({
    featuredApp,
    isInstalled,
    activeTab = 'discover',
    searchQuery = '',
    selectedCategory = 'All',
    onOpenApp,
    onInstall,
    onUninstall,
    onSelectDetails,
}: FeaturedAppBannerProps) => {
    if (!featuredApp || activeTab !== 'discover' || Boolean(searchQuery) || selectedCategory !== 'All') {
        return null;
    }

    return (
        <Card className="netstore-hero-card" variant="outlined">
            <Box className="netstore-hero-content">
                <Chip
                    icon={<Sparkles size={12} />}
                    label="Featured App"
                    size="small"
                    color="secondary"
                    sx={{ mb: 1.5, fontWeight: 'bold' }}
                />
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {featuredApp.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {featuredApp.shortDesc}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                    {isInstalled ? (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<ExternalLink size={16} />}
                                onClick={(e) => onOpenApp(featuredApp, e)}
                            >
                                Open Application
                            </Button>
                            {!featuredApp.nativeKey && (
                                <>
                                    <Button
                                        variant="outlined"
                                        color="inherit"
                                        startIcon={<RefreshCw size={16} />}
                                        onClick={(e) => onInstall(featuredApp, e)}
                                    >
                                        Reinstall
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        onClick={(e) => onUninstall(featuredApp, e)}
                                    >
                                        Uninstall
                                    </Button>
                                </>
                            )}
                        </Box>
                    ) : (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<Download size={16} />}
                            onClick={(e) => onInstall(featuredApp, e)}
                        >
                            Install App
                        </Button>
                    )}
                    <Button
                        variant="outlined"
                        color="inherit"
                        onClick={() => onSelectDetails(featuredApp)}
                    >
                        View Details
                    </Button>
                </Box>
            </Box>
        </Card>
    );
};

export default FeaturedAppBanner;