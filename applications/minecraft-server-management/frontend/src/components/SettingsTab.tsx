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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  Sliders,
  CheckCircle2,
  Cpu,
  Activity,
  Layers,
  DownloadCloud,
  AlertTriangle,
  Hash,
} from 'lucide-react';
import { NodeInfo, NodeServerItem, SoftwareOption } from '../types';
import {
  getNodeServerStats,
  updateNodeServerResources,
  getServerSoftware,
  updateServerSoftware,
  getSoftwareBuilds,
} from '../api';
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

const FALLBACK_SOFTWARES: SoftwareOption[] = [
  {
    id: 'paper',
    name: 'PaperMC',
    description: 'High-performance Spigot fork with bug fixes and plugin support.',
    recommendedVersion: '1.20.4',
    supportedVersions: ['1.21.4', '1.21.3', '1.21.1', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5'],
    supportsBuilds: true,
    buildLabel: 'Build Number',
  },
  {
    id: 'purpur',
    name: 'Purpur',
    description: 'Drop-in replacement for Paper with extensive gameplay configuration.',
    recommendedVersion: '1.20.4',
    supportedVersions: ['1.21.4', '1.21.3', '1.21.1', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5'],
    supportsBuilds: true,
    buildLabel: 'Build Number',
  },
  {
    id: 'vanilla',
    name: 'Vanilla (Mojang)',
    description: 'Official, unmodded Minecraft server software directly from Mojang.',
    recommendedVersion: '1.20.4',
    supportedVersions: ['1.21.4', '1.21.3', '1.21.1', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2'],
    supportsBuilds: false,
  },
  {
    id: 'fabric',
    name: 'Fabric',
    description: 'Lightweight, highly-modular mod loader with fast startup and low overhead.',
    recommendedVersion: '1.20.4',
    supportedVersions: ['1.21.4', '1.21.3', '1.21.1', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5'],
    supportsBuilds: true,
    buildLabel: 'Loader Version',
  },
  {
    id: 'forge',
    name: 'Forge',
    description: 'Classic modding platform supporting thousands of mods across all Minecraft versions.',
    recommendedVersion: '1.20.1',
    supportedVersions: ['1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.16.5', '1.12.2', '1.7.10'],
    supportsBuilds: true,
    buildLabel: 'Forge Version',
  },
  {
    id: 'spigot',
    name: 'Spigot',
    description: 'Modified Minecraft server with Bukkit plugin compatibility.',
    recommendedVersion: '1.20.4',
    supportedVersions: ['1.21.4', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2'],
    supportsBuilds: false,
  },
];

export const SettingsTab: React.FC<SettingsTabProps> = ({ activeNode, activeServer }) => {
  const [ramInput, setRamInput] = useState<string>('1024');
  const [cpuInput, setCpuInput] = useState<string>('0');
  const [savingLimits, setSavingLimits] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Software, Version & Build state
  const [software, setSoftware] = useState<string>('vanilla');
  const [version, setVersion] = useState<string>('1.20.4');
  const [build, setBuild] = useState<string>('latest');
  const [customBuildInput, setCustomBuildInput] = useState<string>('');
  const [availableBuilds, setAvailableBuilds] = useState<string[]>([]);
  const [loadingBuilds, setLoadingBuilds] = useState(false);
  const [supportedSoftwares, setSupportedSoftwares] = useState<SoftwareOption[]>(FALLBACK_SOFTWARES);
  const [savingSoftware, setSavingSoftware] = useState(false);
  const [softwareFeedback, setSoftwareFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load current resource limits and software
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

    try {
      const swData = await getServerSoftware(activeNode, activeServer.id);
      if (swData) {
        if (swData.current) {
          setSoftware(swData.current.software || 'vanilla');
          setVersion(swData.current.version || '1.20.4');
          if (swData.current.build) {
            setBuild(swData.current.build);
          }
        }
        if (swData.supportedSoftwares && swData.supportedSoftwares.length > 0) {
          setSupportedSoftwares(swData.supportedSoftwares);
        }
      }
    } catch {}
  }, [activeNode, activeServer.id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const currentSoftwareOption = supportedSoftwares.find((s) => s.id === software) || supportedSoftwares[0];
  const supportsBuilds = currentSoftwareOption?.supportsBuilds ?? false;
  const buildLabel = currentSoftwareOption?.buildLabel || 'Build Number';

  // Load available builds when software or version changes
  useEffect(() => {
    if (!activeNode || !activeServer || !supportsBuilds) {
      setAvailableBuilds([]);
      return;
    }

    let isMounted = true;
    const fetchBuilds = async () => {
      setLoadingBuilds(true);
      try {
        const res = await getSoftwareBuilds(activeNode, activeServer.id, software, version);
        if (isMounted && res && Array.isArray(res.builds)) {
          setAvailableBuilds(res.builds);
        }
      } catch {}
      if (isMounted) setLoadingBuilds(false);
    };

    fetchBuilds();
    return () => {
      isMounted = false;
    };
  }, [activeNode, activeServer, software, version, supportsBuilds]);

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

  // Handle installing/switching software, version and build
  const handleSaveSoftware = async () => {
    if (!activeNode || !activeServer) return;
    setSavingSoftware(true);
    setSoftwareFeedback(null);

    const effectiveBuild = build === 'custom' ? customBuildInput.trim() : build;

    try {
      const res = await updateServerSoftware(activeNode, activeServer.id, {
        software,
        version,
        build: effectiveBuild,
      });

      if (res.success) {
        const swOption = supportedSoftwares.find((s) => s.id === software);
        const swName = swOption ? swOption.name : software;
        const buildText = effectiveBuild && effectiveBuild !== 'latest' ? ` (build ${effectiveBuild})` : '';
        setSoftwareFeedback({
          type: 'success',
          message: `Successfully installed and switched server software to ${swName} ${version}${buildText}.`,
        });
      } else {
        setSoftwareFeedback({
          type: 'error',
          message: res.error || 'Failed to install server software jar.',
        });
      }
    } catch (err: any) {
      setSoftwareFeedback({
        type: 'error',
        message: err.message || 'Error downloading and updating server software.',
      });
    } finally {
      setSavingSoftware(false);
    }
  };

  const versionList = currentSoftwareOption?.supportedVersions || [
    '1.21.4',
    '1.21.3',
    '1.21.1',
    '1.20.6',
    '1.20.4',
    '1.20.2',
    '1.20.1',
    '1.19.4',
    '1.18.2',
    '1.16.5',
  ];

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

      {/* 1. Server Software, Version & Build Tuning Card */}
      <Card
        sx={{
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 3,
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
            <Layers size={20} color="#a855f7" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f8fafc' }}>
              Server Software & Version
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3 }}>
            Change the underlying Minecraft server engine (Paper, Purpur, Vanilla, Fabric, Spigot), version, and specific build or loader versions.
          </Typography>

          {softwareFeedback && (
            <Alert
              severity={softwareFeedback.type}
              onClose={() => setSoftwareFeedback(null)}
              sx={{
                mb: 3,
                backgroundColor: softwareFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: softwareFeedback.type === 'success' ? '#34d399' : '#fca5a5',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              {softwareFeedback.message}
            </Alert>
          )}

          {activeServer.status === 'online' && (
            <Alert
              severity="warning"
              icon={<AlertTriangle size={18} />}
              sx={{
                mb: 3,
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.25)',
              }}
            >
              The server is currently running. Installing a new software jar will take effect after restarting the server.
            </Alert>
          )}

          <Stack spacing={3} sx={{ maxWidth: 640 }}>
            {/* Software Selector */}
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: '#94a3b8' }}>Server Engine / Software</InputLabel>
              <Select
                value={software}
                label="Server Engine / Software"
                onChange={(e) => {
                  const newSw = e.target.value;
                  setSoftware(newSw);
                  setBuild('latest');
                  const opt = supportedSoftwares.find((s) => s.id === newSw);
                  if (opt && opt.supportedVersions.length > 0 && !opt.supportedVersions.includes(version)) {
                    setVersion(opt.recommendedVersion || opt.supportedVersions[0]);
                  }
                }}
                sx={{
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  color: '#f8fafc',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.25)' },
                }}
              >
                {supportedSoftwares.map((sw) => (
                  <MenuItem key={sw.id} value={sw.id}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Typography sx={{ fontWeight: 600, color: '#f8fafc' }}>{sw.name}</Typography>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>— {sw.description}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Version Selector */}
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: '#94a3b8' }}>Minecraft Version</InputLabel>
              <Select
                value={version}
                label="Minecraft Version"
                onChange={(e) => {
                  setVersion(e.target.value);
                  setBuild('latest');
                }}
                sx={{
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  color: '#f8fafc',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.25)' },
                }}
              >
                {versionList.map((ver) => (
                  <MenuItem key={ver} value={ver}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography sx={{ color: '#f8fafc' }}>{ver}</Typography>
                      {ver === currentSoftwareOption?.recommendedVersion && (
                        <Chip label="Recommended" size="small" sx={{ height: 18, fontSize: '0.68rem', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }} />
                      )}
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Quick Version Presets */}
            <Box>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>
                Popular Versions for {currentSoftwareOption?.name}:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {versionList.slice(0, 6).map((ver) => {
                  const isSelected = version === ver;
                  return (
                    <Chip
                      key={ver}
                      label={ver}
                      size="small"
                      clickable
                      onClick={() => {
                        setVersion(ver);
                        setBuild('latest');
                      }}
                      sx={{
                        backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                        color: isSelected ? '#c084fc' : '#cbd5e1',
                        border: isSelected ? '1px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.08)',
                        fontWeight: isSelected ? 700 : 400,
                        '&:hover': {
                          backgroundColor: 'rgba(168, 85, 247, 0.15)',
                          borderColor: '#a855f7',
                        },
                      }}
                    />
                  );
                })}
              </Stack>
            </Box>

            {/* Optional Build / Loader Version Selector */}
            {supportsBuilds && (
              <Box sx={{ p: 2, backgroundColor: 'rgba(0, 0, 0, 0.25)', borderRadius: 2, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                  <Hash size={16} color="#c084fc" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#f8fafc' }}>
                    {buildLabel} Selection
                  </Typography>
                  {loadingBuilds && <CircularProgress size={14} sx={{ color: '#c084fc' }} />}
                </Stack>

                <Stack spacing={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ color: '#94a3b8' }}>{buildLabel}</InputLabel>
                    <Select
                      value={build}
                      label={buildLabel}
                      onChange={(e) => setBuild(e.target.value)}
                      sx={{
                        backgroundColor: 'rgba(15, 23, 42, 0.6)',
                        color: '#f8fafc',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.25)' },
                      }}
                    >
                      <MenuItem value="latest">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography sx={{ fontWeight: 600, color: '#f8fafc' }}>Latest (Auto Recommended)</Typography>
                          <Chip label="Auto" size="small" sx={{ height: 18, fontSize: '0.68rem', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }} />
                        </Stack>
                      </MenuItem>
                      {availableBuilds.slice(0, 30).map((b) => (
                        <MenuItem key={b} value={b}>
                          <Typography sx={{ color: '#f8fafc' }}>
                            {software === 'fabric' ? `Loader v${b}` : `Build #${b}`}
                          </Typography>
                        </MenuItem>
                      ))}
                      <MenuItem value="custom">
                        <Typography sx={{ color: '#c084fc', fontStyle: 'italic' }}>Custom / Other {buildLabel}...</Typography>
                      </MenuItem>
                    </Select>
                  </FormControl>

                  {build === 'custom' && (
                    <TextField
                      fullWidth
                      size="small"
                      label={`Custom ${buildLabel}`}
                      placeholder={software === 'fabric' ? 'e.g. 0.16.10' : 'e.g. 232'}
                      value={customBuildInput}
                      onChange={(e) => setCustomBuildInput(e.target.value)}
                    />
                  )}

                  {/* Quick Build Presets */}
                  {availableBuilds.length > 0 && (
                    <Box>
                      <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>
                        Recent {buildLabel}s:
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip
                          label="Latest (Auto)"
                          size="small"
                          clickable
                          onClick={() => setBuild('latest')}
                          sx={{
                            backgroundColor: build === 'latest' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                            color: build === 'latest' ? '#c084fc' : '#cbd5e1',
                            border: build === 'latest' ? '1px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.08)',
                            fontWeight: build === 'latest' ? 700 : 400,
                          }}
                        />
                        {availableBuilds.slice(0, 5).map((b) => {
                          const isSelected = build === b;
                          return (
                            <Chip
                              key={b}
                              label={software === 'fabric' ? `v${b}` : `#${b}`}
                              size="small"
                              clickable
                              onClick={() => setBuild(b)}
                              sx={{
                                backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                                color: isSelected ? '#c084fc' : '#cbd5e1',
                                border: isSelected ? '1px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.08)',
                                fontWeight: isSelected ? 700 : 400,
                              }}
                            />
                          );
                        })}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </Box>
            )}

            {/* Install Button */}
            <Box pt={1}>
              <Button
                variant="contained"
                disabled={savingSoftware || !software || !version || (build === 'custom' && !customBuildInput.trim())}
                startIcon={savingSoftware ? <CircularProgress size={16} color="inherit" /> : <DownloadCloud size={16} />}
                onClick={handleSaveSoftware}
                sx={{
                  backgroundColor: '#a855f7',
                  color: '#ffffff',
                  px: 4,
                  py: 1.2,
                  borderRadius: 2,
                  fontWeight: 600,
                  '&:hover': { backgroundColor: '#9333ea' },
                }}
              >
                {savingSoftware
                  ? 'Downloading & Installing...'
                  : `Install & Switch to ${currentSoftwareOption?.name} ${version}${build && build !== 'latest' && build !== 'custom' ? ` (${build})` : build === 'custom' && customBuildInput ? ` (${customBuildInput})` : ''}`}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* 2. Resource Allocation Tuning Card */}
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
            {/* Memory Limit Section */}
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
                            backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.06)',
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

            {/* CPU Limit Section */}
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

      {/* 3. Relay Port Forwarding & Public Tunnel Card */}
      <PortForwardCard activeNode={activeNode} activeServer={activeServer} />
    </Stack>
  );
};
