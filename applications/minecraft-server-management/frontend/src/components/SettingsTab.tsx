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
  Divider,
} from '@mui/material';
import { Sliders, CheckCircle2, Cpu, Activity } from 'lucide-react';
import { NodeInfo, NodeServerItem } from '../types';
import { getNodeServerStats, updateNodeServerResources } from '../api';
import { PortForwardCard } from './PortForwardCard';


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

const CPU_PRESETS = [
  { label: 'Unlimited', value: 0 },
  { label: '1 Core (100%)', value: 100 },
  { label: '2 Cores (200%)', value: 200 },
  { label: '3 Cores (300%)', value: 300 },
  { label: '4 Cores (400%)', value: 400 },
  { label: '6 Cores (600%)', value: 600 },
  { label: '8 Cores (800%)', value: 800 },
];

export const SettingsTab: React.FC<SettingsTabProps> = ({ activeNode, activeServer }) => {
  const [ramInput, setRamInput] = useState<string>('1024');
  const [cpuInput, setCpuInput] = useState<string>('0');
  const [savingLimits, setSavingLimits] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load current resource limits
  const fetchSettings = useCallback(async () => {
    if (!activeNode || !activeServer) return;
    try {
      const data = await getNodeServerStats(activeNode, activeServer.id);
      if (data) {
        if (data.memoryLimitMb) {
          setRamInput(data.memoryLimitMb.toString());
        }
        if (data.cpuLimitPercent !== undefined) {
          setCpuInput(data.cpuLimitPercent.toString());
        }
      }
    } catch {}
  }, [activeNode, activeServer.id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle saving custom RAM and CPU limits
  const handleSaveResources = async () => {
    if (!activeNode || !activeServer) return;
    const ramNumber = parseInt(ramInput, 10);
    const cpuNumber = parseInt(cpuInput, 10);

    if (isNaN(ramNumber) || ramNumber < 256) {
      setFeedback({ type: 'error', message: 'Please enter a valid memory limit (at least 256 MB).' });
      return;
    }
    if (isNaN(cpuNumber) || cpuNumber < 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid CPU limit (0% or higher).' });
      return;
    }

    setSavingLimits(true);
    setFeedback(null);
    try {
      const res = await updateNodeServerResources(activeNode, activeServer.id, {
        ramMb: ramNumber,
        cpuLimitPercent: cpuNumber,
      });
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Resource limits updated: ${ramNumber} MB RAM, ${cpuNumber === 0 ? 'Unlimited' : `${cpuNumber}%`} CPU.`,
        });
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
  const parsedCpu = parseInt(cpuInput, 10);

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
            Configure maximum heap memory (-Xmx) and CPU execution limits for this Minecraft instance.
          </Typography>

          <Stack spacing={4}>
            {/* 1. Memory Limit Section */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                <Activity size={17} color="#10b981" />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#f8fafc' }}>
                  Memory Allocation (-Xmx)
                </Typography>
              </Stack>

              <Stack spacing={2} sx={{ maxWidth: 520 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Memory Limit (MB)"
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

                {/* RAM Quick Presets */}
                <Box>
                  <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>
                    Quick RAM Presets:
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
            </Box>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)' }} />

            {/* 2. CPU Limit Section */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                <Cpu size={17} color="#38bdf8" />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#f8fafc' }}>
                  CPU Execution Limit
                </Typography>
              </Stack>

              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 2 }}>
                0% means unlimited CPU usage. 100% corresponds to 1 dedicated CPU core, 200% to 2 CPU cores, etc.
              </Typography>

              <Stack spacing={2} sx={{ maxWidth: 520 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="CPU Limit (%)"
                  placeholder="0 (Unlimited)"
                  value={cpuInput}
                  onChange={(e) => setCpuInput(e.target.value)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  inputProps={{
                    min: 0,
                    max: 3200,
                    step: 50,
                  }}
                />

                {/* CPU Quick Presets */}
                <Box>
                  <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>
                    Quick CPU Presets:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {CPU_PRESETS.map((preset) => {
                      const isSelected = parsedCpu === preset.value;
                      return (
                        <Chip
                          key={preset.value}
                          label={preset.label}
                          size="small"
                          clickable
                          onClick={() => setCpuInput(preset.value.toString())}
                          sx={{
                            backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                            color: isSelected ? '#38bdf8' : '#cbd5e1',
                            border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                            fontWeight: isSelected ? 700 : 400,
                            '&:hover': {
                              backgroundColor: 'rgba(56, 189, 248, 0.15)',
                              borderColor: '#38bdf8',
                            },
                          }}
                        />
                      );
                    })}
                  </Stack>
                </Box>
              </Stack>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)' }} />

            {/* Save Button */}
            <Box>
              <Button
                variant="contained"
                disabled={savingLimits || !ramInput || !cpuInput}
                startIcon={<CheckCircle2 size={16} />}
                onClick={handleSaveResources}
                sx={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  px: 4,
                  py: 1.2,
                  borderRadius: 2,
                  fontWeight: 600,
                  '&:hover': { backgroundColor: '#059669' },
                }}
              >
                {savingLimits ? 'Saving Changes...' : 'Save Resource Limits'}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Relay Port Forwarding & Public Tunnel Card */}
      <PortForwardCard activeNode={activeNode} activeServer={activeServer} />
    </Stack>
  );
};

