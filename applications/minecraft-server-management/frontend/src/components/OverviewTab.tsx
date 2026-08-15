import React from 'react';
import {
  Typography,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import { NodeInfo, NodeServerItem } from '../types';

interface OverviewTabProps {
  activeNode: NodeInfo | null;
  activeServer: NodeServerItem;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ activeNode, activeServer }) => {
  return (
    <Card
      sx={{
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 3,
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#f8fafc', mb: 2 }}>
          Server Instance Information
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
              Instance ID
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {activeServer.id}
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
              Active Node
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {activeNode?.name} ({activeNode?.host}:{activeNode?.daemonPort})
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
              Node Storage Path
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                color: '#34d399',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                p: 1.5,
                borderRadius: 2,
                mt: 0.5,
              }}
            >
              {activeServer.path}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
