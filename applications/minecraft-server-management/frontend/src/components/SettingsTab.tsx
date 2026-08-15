import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
} from '@mui/material';
import { Sliders, CheckCircle2 } from 'lucide-react';
import { NodeInfo, NodeServerItem } from '../types';
import { getNodeServerStats, updateNodeServerResources } from '../api';

interface SettingsTabProps {
  activeNode: NodeInfo | null;
  activeServer: NodeServerItem;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ activeNode, activeServer }) => {
  const [selectedRam, setSelectedRam] = useState<number>(1024);
  const [savingLimits, setSavingLimits] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load current resource limits
  const fetchSettings = useCallback(async () => {
    if (!activeNode || !activeServer) return;
    try {
      const data = await getNodeServerStats(activeNode, activeServer.id);
      if (data && data.memoryLimitMb) {
        setSelectedRam(data.memoryLimitMb);
      }
    } catch {}
  }, [activeNode, activeServer.id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle saving new RAM limit
  const handleSaveResources = async () => {
    if (!activeNode || !activeServer) return;
    setSavingLimits(true);
    setFeedback(null);
    try {
      const res = await updateNodeServerResources(activeNode, activeServer.id, { ramMb: selectedRam });
      if (res.success) {
        setFeedback({ type: 'success', message: `Memory allocation limit updated to ${selectedRam} MB.` });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to update resource limits.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error updating resources.' });
    } finally {
      setSavingLimits(false);
    }
  };

  return (
    <Stack spacing={3}>
      {feedback && (
        <Alert
          severity={feedback.type}
          onClose={() => setFeedback(null)}
          sx={{
            backgroundColor: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: feedback.type === 'success' ? '#34d399' : '#fca5a5',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {feedback.message}
        </Alert>
      )}

      {/* Resource Allocation Tuning Card */}
      <Card
        sx={{
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 3,
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
            <Sliders size={20} color="#34d399" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f8fafc' }}>
              Resource Allocation & Limits
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3 }}>
            Configure maximum heap memory allocation (-Xmx) and compute parameters for this Minecraft instance.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel id="settings-ram-select-label">Memory Allocation (-Xmx)</InputLabel>
              <Select
                labelId="settings-ram-select-label"
                value={selectedRam}
                label="Memory Allocation (-Xmx)"
                onChange={(e) => setSelectedRam(Number(e.target.value))}
              >
                <MenuItem value={1024}>1024 MB (1 GB RAM)</MenuItem>
                <MenuItem value={2048}>2048 MB (2 GB RAM)</MenuItem>
                <MenuItem value={3072}>3072 MB (3 GB RAM)</MenuItem>
                <MenuItem value={4096}>4096 MB (4 GB RAM)</MenuItem>
                <MenuItem value={6144}>6144 MB (6 GB RAM)</MenuItem>
                <MenuItem value={8192}>8192 MB (8 GB RAM)</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="contained"
              disabled={savingLimits}
              startIcon={<CheckCircle2 size={16} />}
              onClick={handleSaveResources}
              sx={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                px: 3,
                py: 1,
                borderRadius: 2,
                '&:hover': { backgroundColor: '#059669' },
              }}
            >
              {savingLimits ? 'Saving...' : 'Save Resource Limits'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};
