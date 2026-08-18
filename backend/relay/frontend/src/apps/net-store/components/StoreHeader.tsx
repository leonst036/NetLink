import { Box, Typography, Chip } from '@mui/material';
import { Wrench } from 'lucide-react';
import { type MainTab, type BranchType } from '../types';

export interface StoreHeaderProps {
    activeTab: MainTab;
    selectedCategory: string;
    selectedBranch: BranchType;
    selectedLocalBranch: string;
    totalApps: number;
}

export const StoreHeader = ({
    activeTab,
    selectedCategory,
    selectedBranch,
    selectedLocalBranch,
    totalApps
}: StoreHeaderProps) => {
    // Determine title based on tab and category
    const getSectionTitle = () => {
        if (activeTab === 'discover') return 'Popular Applications';
        if (activeTab === 'installed') return 'Installed Applications';
        if (activeTab === 'updates') return 'Available Updates';
        if (selectedCategory === 'All') return 'All Applications';
        return `${selectedCategory} Apps`;
    };

    return (
        <Box className="netstore-header-row">
            <Typography variant="h5" className="netstore-section-title">
                {getSectionTitle()}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {selectedBranch === 'local-debug' && (
                    <Chip
                        icon={<Wrench size={12} style={{ color: '#facc15' }} />}
                        label={`Docker: ${selectedLocalBranch}`}
                        size="small"
                        sx={{
                            bgcolor: 'rgba(234, 179, 8, 0.15)',
                            color: '#facc15',
                            border: '1px solid rgba(234, 179, 8, 0.3)',
                            fontSize: '0.75rem',
                            fontWeight: 600
                        }}
                    />
                )}
                <Chip
                    label={`${totalApps} Apps`}
                    size="small"
                    variant="outlined"
                />
            </Box>
        </Box>
    );
};

export default StoreHeader;
