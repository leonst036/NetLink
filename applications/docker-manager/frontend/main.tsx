import React, { useState, useEffect, useCallback } from 'react';
import LoginPanel from './components/LoginPanel';
import DashboardHeader from './components/DashboardHeader';
import ContainerCard from './components/ContainerCard';
import EmptyState from './components/EmptyState';
import LogModal from './components/LogModal';
import RunContainerModal from './components/RunContainerModal';
import InspectModal from './components/InspectModal';
import ExecModal from './components/ExecModal';
import ImagesTab from './tabs/ImagesTab';
import VolumesTab from './tabs/VolumesTab';
import NetworksTab from './tabs/NetworksTab';
import ComposeTab from './tabs/ComposeTab';

const LOCAL_STORAGE_KEY = 'netstore_docker_manager_creds';

export default function DockerManager() {
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [remember, setRemember] = useState(true);
    const [credentials, setCredentials] = useState({ host: '', port: '22', username: '', password: '' });
    const [activeTab, setActiveTab] = useState<'containers' | 'images' | 'volumes' | 'networks' | 'compose'>('containers');
    const [error, setError] = useState('');

    // Data lists
    const [containers, setContainers] = useState<any[]>([]);
    const [images, setImages] = useState<any[]>([]);
    const [volumes, setVolumes] = useState<any[]>([]);
    const [networks, setNetworks] = useState<any[]>([]);
    const [stats, setStats] = useState<Record<string, any>>({});

    // Filtering
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped'>('all');

    // Modals
    const [runModalOpen, setRunModalOpen] = useState(false);

    const [inspectContainer, setInspectContainer] = useState<any>(null);
    const [inspectData, setInspectData] = useState<any>(null);
    const [inspectLoading, setInspectLoading] = useState(false);

    const [execContainer, setExecContainer] = useState<any>(null);

    const [logContainer, setLogContainer] = useState<any>(null);
    const [logContent, setLogContent] = useState('');
    const [logLoading, setLogLoading] = useState(false);
    const [logTail, setLogTail] = useState<number>(100);

    // Load credentials from localStorage if available
    useEffect(() => {
        try {
            const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.host) {
                    setCredentials(parsed);
                }
            }
        } catch (e) {
            console.warn('Could not load stored SSH credentials', e);
        }
    }, []);

    // Load stylesheet dynamically
    useEffect(() => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "/apps/docker-manager/frontend/styles.css";
        document.head.appendChild(link);
        return () => {
            document.head.removeChild(link);
        };
    }, []);

    const executeCommand = async (command: string) => {
        const res = await fetch('/api/docker-manager/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...credentials, command })
        });
        
        const rawText = await res.text();
        let data: any = null;
        try {
            data = JSON.parse(rawText);
        } catch {
            throw new Error(rawText || `Backend server returned non-JSON error (Status ${res.status})`);
        }
        
        if (!res.ok) {
            throw new Error(data?.error || `Execution error (Status ${res.status})`);
        }
        
        return data;
    };

    const parseJsonLines = (stdout: string): any[] => {
        if (!stdout || !stdout.trim()) return [];
        const result: any[] = [];
        const lines = stdout.split('\n');
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            const firstBrace = line.indexOf('{');
            const lastBrace = line.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                const jsonCandidate = line.substring(firstBrace, lastBrace + 1);
                try {
                    const parsed = JSON.parse(jsonCandidate);
                    if (parsed && typeof parsed === 'object') {
                        result.push(parsed);
                    }
                } catch (err) {
                    // Ignore line parse errors
                }
            }
        }
        return result;
    };

    const fetchContainers = useCallback(async () => {
        try {
            const result = await executeCommand("docker ps -a --format '{{json .}}'");
            if (result.code === 0) {
                const parsed = parseJsonLines(result.stdout || '');
                setContainers(parsed);
            }
        } catch (err) {
            console.error('Failed to fetch containers:', err);
        }
    }, [credentials]);

    const fetchImages = useCallback(async () => {
        try {
            const result = await executeCommand("docker images --format '{{json .}}'");
            if (result.code === 0) {
                const parsed = parseJsonLines(result.stdout || '');
                setImages(parsed);
            }
        } catch (err) {
            console.error('Failed to fetch images:', err);
        }
    }, [credentials]);

    const fetchVolumes = useCallback(async () => {
        try {
            const result = await executeCommand("docker volume ls --format '{{json .}}'");
            if (result.code === 0) {
                const parsed = parseJsonLines(result.stdout || '');
                setVolumes(parsed);
            }
        } catch (err) {
            console.error('Failed to fetch volumes:', err);
        }
    }, [credentials]);

    const fetchNetworks = useCallback(async () => {
        try {
            const result = await executeCommand("docker network ls --format '{{json .}}'");
            if (result.code === 0) {
                const parsed = parseJsonLines(result.stdout || '');
                setNetworks(parsed);
            }
        } catch (err) {
            console.error('Failed to fetch networks:', err);
        }
    }, [credentials]);

    const fetchStats = useCallback(async () => {
        try {
            const result = await executeCommand("docker stats --no-stream --format '{{json .}}'");
            if (result.code === 0) {
                const parsed = parseJsonLines(result.stdout || '');
                const statsMap: Record<string, any> = {};
                for (const item of parsed) {
                    if (item.ID) statsMap[item.ID] = item;
                    if (item.Name) statsMap[item.Name] = item;
                }
                setStats(statsMap);
            }
        } catch (err) {
            console.warn('Failed to fetch container stats:', err);
        }
    }, [credentials]);

    const refreshData = useCallback(async () => {
        await Promise.all([
            fetchContainers(),
            fetchImages(),
            fetchVolumes(),
            fetchNetworks(),
            fetchStats()
        ]);
    }, [fetchContainers, fetchImages, fetchVolumes, fetchNetworks, fetchStats]);

    // Periodically refresh container stats when connected
    useEffect(() => {
        if (!connected) return;
        refreshData();
        const interval = setInterval(() => {
            fetchContainers();
            fetchStats();
        }, 8000);
        return () => clearInterval(interval);
    }, [connected, refreshData, fetchContainers, fetchStats]);

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setConnecting(true);
        setError('');

        try {
            const result = await executeCommand("docker ps -a --format '{{json .}}'");
            if (result.code !== 0) throw new Error(`Connection failed (code ${result.code}): ${result.stderr}`);

            if (remember) {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(credentials));
            } else {
                localStorage.removeItem(LOCAL_STORAGE_KEY);
            }

            setConnected(true);
            refreshData();
        } catch (err: any) {
            setError(err.message || 'Failed to connect via SSH to Docker engine');
        } finally {
            setConnecting(false);
        }
    };

    // Container actions
    const handleAction = async (action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause', containerId: string) => {
        try {
            await executeCommand(`docker ${action} ${containerId}`);
            await fetchContainers();
            fetchStats();
        } catch (err: any) {
            alert(`Failed to ${action} container: ${err.message}`);
        }
    };

    const handleRemove = async (containerId: string) => {
        if (!confirm('Are you sure you want to forcibly remove this container?')) return;
        try {
            await executeCommand(`docker rm -f ${containerId}`);
            await fetchContainers();
        } catch (err: any) {
            alert(`Failed to remove container: ${err.message}`);
        }
    };

    const handleRunContainer = async (config: any) => {
        let cmd = `docker run -d`;
        if (config.name) cmd += ` --name ${config.name}`;
        if (config.hostPort && config.containerPort) cmd += ` -p ${config.hostPort}:${config.containerPort}`;
        if (config.restartPolicy) cmd += ` --restart ${config.restartPolicy}`;
        if (config.volumeMount) cmd += ` -v ${config.volumeMount}`;

        if (config.envVars) {
            const envLines = config.envVars.split('\n');
            for (const envLine of envLines) {
                if (envLine.trim()) {
                    cmd += ` -e "${envLine.trim().replace(/"/g, '\\"')}"`;
                }
            }
        }

        cmd += ` ${config.image}`;

        const res = await executeCommand(cmd);
        if (res.code !== 0) {
            throw new Error(res.stderr || `Execution failed with code ${res.code}`);
        }

        await fetchContainers();
    };

    // Logs viewer
    const handleViewLogs = async (container: any, linesCount?: number) => {
        const count = linesCount || logTail;
        setLogContainer(container);
        setLogLoading(true);
        setLogContent('');
        try {
            const res = await executeCommand(`docker logs --tail ${count} ${container.ID}`);
            const combined = ((res.stdout || '') + '\n' + (res.stderr || '')).trim();
            setLogContent(combined);
        } catch (err: any) {
            setLogContent(`Error fetching logs: ${err.message}`);
        } finally {
            setLogLoading(false);
        }
    };

    // Inspect viewer
    const handleInspect = async (container: any) => {
        setInspectContainer(container);
        setInspectLoading(true);
        setInspectData(null);
        try {
            const res = await executeCommand(`docker inspect ${container.ID}`);
            if (res.code === 0 && res.stdout) {
                const parsed = JSON.parse(res.stdout);
                setInspectData(parsed);
            } else {
                setInspectData({ error: res.stderr || 'Inspect failed' });
            }
        } catch (err: any) {
            setInspectData({ error: err.message });
        } finally {
            setInspectLoading(false);
        }
    };

    // Exec command runner
    const handleExec = (container: any) => {
        setExecContainer(container);
    };

    const handleExecCommand = async (containerId: string, cmd: string) => {
        return await executeCommand(`docker exec ${containerId} ${cmd}`);
    };

    // Image actions
    const handlePullImage = async (imageName: string) => {
        const res = await executeCommand(`docker pull ${imageName}`);
        if (res.code !== 0) {
            alert(`Failed to pull image: ${res.stderr}`);
        } else {
            await fetchImages();
        }
    };

    const handleRemoveImage = async (imageId: string) => {
        if (!confirm('Are you sure you want to remove this image?')) return;
        try {
            await executeCommand(`docker rmi -f ${imageId}`);
            await fetchImages();
        } catch (err: any) {
            alert(`Failed to delete image: ${err.message}`);
        }
    };

    // Volume actions
    const handleCreateVolume = async (volName: string) => {
        const res = await executeCommand(`docker volume create ${volName}`);
        if (res.code !== 0) {
            alert(`Failed to create volume: ${res.stderr}`);
        } else {
            await fetchVolumes();
        }
    };

    const handleRemoveVolume = async (volName: string) => {
        if (!confirm(`Are you sure you want to delete volume "${volName}"?`)) return;
        try {
            await executeCommand(`docker volume rm ${volName}`);
            await fetchVolumes();
        } catch (err: any) {
            alert(`Failed to delete volume: ${err.message}`);
        }
    };

    // Network actions
    const handleCreateNetwork = async (netName: string, driver: string) => {
        const res = await executeCommand(`docker network create -d ${driver} ${netName}`);
        if (res.code !== 0) {
            alert(`Failed to create network: ${res.stderr}`);
        } else {
            await fetchNetworks();
        }
    };

    const handleRemoveNetwork = async (netId: string) => {
        if (!confirm('Are you sure you want to remove this network?')) return;
        try {
            await executeCommand(`docker network rm ${netId}`);
            await fetchNetworks();
        } catch (err: any) {
            alert(`Failed to delete network: ${err.message}`);
        }
    };

    // System Prune
    const handlePrune = async () => {
        if (!confirm('Warning: This will remove all stopped containers, unused networks, and dangling images. Proceed?')) return;
        try {
            await executeCommand(`docker system prune -f`);
            await refreshData();
        } catch (err: any) {
            alert(`System prune error: ${err.message}`);
        }
    };

    // Compose actions
    const handleDeployCompose = async (stackName: string, yamlContent: string) => {
        const script = `cat << 'EOF' > /tmp/docker-compose-${stackName}.yml\n${yamlContent}\nEOF\n(docker compose -f /tmp/docker-compose-${stackName}.yml -p ${stackName} up -d || docker-compose -f /tmp/docker-compose-${stackName}.yml -p ${stackName} up -d)`;
        const res = await executeCommand(script);
        fetchContainers();
        return res;
    };

    const handleDownCompose = async (stackName: string) => {
        const script = `(docker compose -f /tmp/docker-compose-${stackName}.yml -p ${stackName} down || docker-compose -f /tmp/docker-compose-${stackName}.yml -p ${stackName} down)`;
        const res = await executeCommand(script);
        fetchContainers();
        return res;
    };

    // Filter containers
    const filteredContainers = containers.filter(c => {
        const matchesQuery = (c.Names || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.Image || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.ID || '').toLowerCase().includes(searchQuery.toLowerCase());

        if (statusFilter === 'running') return matchesQuery && c.State === 'running';
        if (statusFilter === 'stopped') return matchesQuery && c.State !== 'running';
        return matchesQuery;
    });

    const runningCount = containers.filter(c => c.State === 'running').length;
    const stoppedCount = containers.length - runningCount;

    if (!connected) {
        return (
            <LoginPanel
                credentials={credentials}
                setCredentials={setCredentials}
                remember={remember}
                setRemember={setRemember}
                connecting={connecting}
                error={error}
                handleConnect={handleConnect}
            />
        );
    }

    return (
        <div className="dm-dashboard">
            <DashboardHeader
                credentials={credentials}
                metrics={{
                    runningCount,
                    stoppedCount,
                    totalContainers: containers.length,
                    imagesCount: images.length,
                    volumesCount: volumes.length,
                    networksCount: networks.length
                }}
                refreshData={refreshData}
                handlePrune={handlePrune}
                onOpenRunModal={() => setRunModalOpen(true)}
                setConnected={setConnected}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
            />

            <div className="dm-content">
                {activeTab === 'containers' && (
                    <div className="dm-containers-view">
                        <div className="dm-action-bar">
                            <div className="dm-filter-group">
                                <div className="dm-pill-switch">
                                    <button
                                        className={statusFilter === 'all' ? 'active' : ''}
                                        onClick={() => setStatusFilter('all')}
                                    >
                                        All ({containers.length})
                                    </button>
                                    <button
                                        className={statusFilter === 'running' ? 'active' : ''}
                                        onClick={() => setStatusFilter('running')}
                                    >
                                        Running ({runningCount})
                                    </button>
                                    <button
                                        className={statusFilter === 'stopped' ? 'active' : ''}
                                        onClick={() => setStatusFilter('stopped')}
                                    >
                                        Stopped ({stoppedCount})
                                    </button>
                                </div>
                            </div>

                            <div className="dm-search-input-wrapper">
                                <span className="dm-search-icon">🔍</span>
                                <input
                                    className="dm-input"
                                    type="text"
                                    placeholder="Search containers by name, image, or ID..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="dm-grid">
                            {filteredContainers.map(container => (
                                <ContainerCard
                                    key={container.ID}
                                    container={container}
                                    stats={stats}
                                    handleAction={handleAction}
                                    handleViewLogs={handleViewLogs}
                                    handleInspect={handleInspect}
                                    handleExec={handleExec}
                                    handleRemove={handleRemove}
                                />
                            ))}
                            {filteredContainers.length === 0 && <EmptyState />}
                        </div>
                    </div>
                )}

                {activeTab === 'images' && (
                    <ImagesTab
                        images={images}
                        handlePull={handlePullImage}
                        handleRemoveImage={handleRemoveImage}
                    />
                )}

                {activeTab === 'volumes' && (
                    <VolumesTab
                        volumes={volumes}
                        handleCreateVolume={handleCreateVolume}
                        handleRemoveVolume={handleRemoveVolume}
                    />
                )}

                {activeTab === 'networks' && (
                    <NetworksTab
                        networks={networks}
                        handleCreateNetwork={handleCreateNetwork}
                        handleRemoveNetwork={handleRemoveNetwork}
                    />
                )}

                {activeTab === 'compose' && (
                    <ComposeTab
                        handleDeployCompose={handleDeployCompose}
                        handleDownCompose={handleDownCompose}
                    />
                )}
            </div>

            {/* Modals */}
            {runModalOpen && (
                <RunContainerModal
                    onClose={() => setRunModalOpen(false)}
                    onRun={handleRunContainer}
                />
            )}

            {logContainer && (
                <LogModal
                    container={logContainer}
                    logs={logContent}
                    loading={logLoading}
                    tail={logTail}
                    setTail={(newTail: number) => {
                        setLogTail(newTail);
                        handleViewLogs(logContainer, newTail);
                    }}
                    onClose={() => setLogContainer(null)}
                    onRefresh={(tailCount: number) => handleViewLogs(logContainer, tailCount)}
                />
            )}

            {inspectContainer && (
                <InspectModal
                    container={inspectContainer}
                    inspectData={inspectData}
                    loading={inspectLoading}
                    onClose={() => setInspectContainer(null)}
                />
            )}

            {execContainer && (
                <ExecModal
                    container={execContainer}
                    onExecCommand={handleExecCommand}
                    onClose={() => setExecContainer(null)}
                />
            )}
        </div>
    );
}
