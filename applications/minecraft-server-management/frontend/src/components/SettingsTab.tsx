import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Alert,
  Box,
} from '@mui/material';
import { Sliders, CheckCircle2 } from 'lucide-react';
import { NodeInfo, NodeServerItem } from '../types';
import { getNodeServerStats, updateNodeServerResources } from '../api';

interface SettingsTabProps {
  activeNode: NodeInfo | null;
  activeServer: NodeServerItem;
}

const RAM_PRESETS = [
  { label: '1 GB', value: 1024 },
  { label: '2 GB', value: 2048 },
  { label: '3 GB', value: 3072 },
  { label: '4 GB', value: 4096 },
  { label: '6 GB', value: 6144 },
  { label: '8 GB', value: 8192 },
  { label: '12 GB', value: 12288 },
  { label: '16 GB', value: 16384 },
];

export const SettingsTab: React.FC<SettingsTabProps> = ({ activeNode, activeServer }) => {
  const [ramInput, setRamInput] = useState<string>('1024');
  const [savingLimits, setSavingLimits] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load current resource limits
  const fetchSettings = useCallback(async () => {
    if (!activeNode || !activeServer) return;
    try {
      const data = await getNodeServerStats(activeNode, activeServer.id);
      if (data && data.memoryLimitMb) {
        setRamInput(data.memoryLimitMb.toString());
      }
    } catch {}
  }, [activeNode, activeServer.id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle saving custom RAM limit
  const handleSaveResources = async () => {
    if (!activeNode || !activeServer) return;
    const ramNumber = parseInt(ramInput, 10);
    if (isNaN(ramNumber) || ramNumber < 256) {
      setFeedback({ type: 'error', message: 'Please enter a valid memory limit (at least 256 MB).' });
      return;
    }

    setSavingLimits(true);
    setFeedback(null);
    try {
      const res = await updateNodeServerResources(activeNode, activeServer.id, { ramMb: ramNumber });
      if (res.success) {
        setFeedback({ type: 'success', message: `Memory allocation limit updated to ${ramNumber} MB.` });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to update resource limits.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error updating resources.' });
    } finally {
      setSavingLimits(false);
    }
  };

  const parsedRam = parseInt(ramInput, 10);

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
            Configure maximum heap memory allocation (-Xmx) for this Minecraft instance. Enter any custom megabyte value or choose a preset.
          </Typography>

          {/* Custom Numeric Input Field */}
          <Stack spacing={2} sx={{ maxWidth: 480 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Custom Memory Limit"
                placeholder="2048"
                value={ramInput}
                onChange={(e) => setRamInput(e.target.value)}
                InputProps={{
                  endAdornment: <InputAdornment position="end">MB</InputAdornment>,
                }}
                inputProps={{
                  min: 256,
                  max: 65536,
                  step: 128,
                }}
              />

              <Button
                variant="contained"
                disabled={savingLimits || !ramInput}
                startIcon={<CheckCircle2 size={16} />}
                onClick={handleSaveResources}
                sx={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  px: 3,
                  py: 1,
                  whiteSpace: 'nowrap',
                  borderRadius: 2,
                  '&:hover': { backgroundColor: '#059669' },
                }}
              >
                {savingLimits ? 'Saving...' : 'Save Limits'}
              </Button>
            </Stack>

            {/* Quick Preset Chips */}
            <Box>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>
                Quick Presets:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {RAM_PRESETS.map((preset) => {
                  const isSelected = parsedRam === preset.value;
                  return (
                    <Chip
                      key={preset.value}
                      label={`${preset.label} (${preset.value} MB)`}
                      size="small"
                      clickable
                      onClick={() => setRamInput(preset.value.toString())}
                      sx={{
                        backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                        color: isSelected ? '#34d399' : '#cbd5e1',
                        border: isSelected ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                        fontWeight: isSelected ? 700 : 400,
                        '&:hover': {
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          borderColor: '#34d399',
                        },
                      }}
                    />
                  );
                })}
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};
