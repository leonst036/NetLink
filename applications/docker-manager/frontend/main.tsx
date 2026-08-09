import React, { useState, useEffect, useCallback } from 'react';
import LoginPanel from './components/LoginPanel';
import DashboardHeader from './components/DashboardHeader';
import ContainerCard from './components/ContainerCard';
import EmptyState from './components/EmptyState';
import LogModal from './components/LogModal';
import RunContainerModal from './components/RunContainerModal';
import InspectModal from './components/InspectModal';
import ExecModal from './components/ExecModal';
import ConfirmModal from './components/ConfirmModal';
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

    const [confirmState, setConfirmState] = useState<{
        title: string;
        message: string;
        confirmText?: string;
        action: () => Promise<void>;
        loading?: boolean;
    } | null>(null);

    const [notification, setNotification] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

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
            const res = await executeCommand(`docker ${action} ${containerId}`);
            if (res.code !== 0) throw new Error(res.stderr || `Action ${action} failed`);
            await fetchContainers();
            fetchStats();
        } catch (err: any) {
            setNotification({ type: 'error', message: `Failed to ${action} container: ${err.message}` });
        }
    };

    const handleRemove = (containerId: string) => {
        setConfirmState({
            title: 'Delete Container',
            message: `Are you sure you want to forcibly remove container ${containerId.substring(0, 12)}?`,
            confirmText: 'Delete Container',
            action: async () => {
                const res = await executeCommand(`docker rm -f ${containerId}`);
                if (res.code !== 0) throw new Error(res.stderr || `Container removal failed`);
                await fetchContainers();
            }
        });
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
        try {
            const res = await executeCommand(`docker pull ${imageName}`);
            if (res.code !== 0) {
                setNotification({ type: 'error', message: `Failed to pull image: ${res.stderr}` });
            } else {
                await fetchImages();
                setNotification({ type: 'success', message: `Successfully pulled ${imageName}` });
            }
        } catch (err: any) {
            setNotification({ type: 'error', message: `Failed to pull image: ${err.message}` });
        }
    };

    const handleRemoveImage = (imageId: string) => {
        setConfirmState({
            title: 'Remove Image',
            message: `Are you sure you want to remove Docker image ${imageId.substring(0, 12)}?`,
            confirmText: 'Remove Image',
            action: async () => {
                const res = await executeCommand(`docker rmi -f ${imageId}`);
                if (res.code !== 0) throw new Error(res.stderr || `Image removal failed`);
                await fetchImages();
            }
        });
    };

    // Volume actions
    const handleCreateVolume = async (volName: string) => {
        try {
            const res = await executeCommand(`docker volume create ${volName}`);
            if (res.code !== 0) {
                setNotification({ type: 'error', message: `Failed to create volume: ${res.stderr}` });
            } else {
                await fetchVolumes();
            }
        } catch (err: any) {
            setNotification({ type: 'error', message: `Failed to create volume: ${err.message}` });
        }
    };

    const handleRemoveVolume = (volName: string) => {
        setConfirmState({
            title: 'Delete Volume',
            message: `Are you sure you want to delete volume "${volName}"?`,
            confirmText: 'Delete Volume',
            action: async () => {
                const res = await executeCommand(`docker volume rm ${volName}`);
                if (res.code !== 0) throw new Error(res.stderr || `Volume deletion failed`);
                await fetchVolumes();
            }
        });
    };

    // Network actions
    const handleCreateNetwork = async (netName: string, driver: string) => {
        try {
            const res = await executeCommand(`docker network create -d ${driver} ${netName}`);
            if (res.code !== 0) {
                setNotification({ type: 'error', message: `Failed to create network: ${res.stderr}` });
            } else {
                await fetchNetworks();
            }
        } catch (err: any) {
            setNotification({ type: 'error', message: `Failed to create network: ${err.message}` });
        }
    };

    const handleRemoveNetwork = (netId: string) => {
        setConfirmState({
            title: 'Remove Network',
            message: `Are you sure you want to remove network ${netId.substring(0, 12)}?`,
            confirmText: 'Remove Network',
            action: async () => {
                const res = await executeCommand(`docker network rm ${netId}`);
                if (res.code !== 0) throw new Error(res.stderr || `Network removal failed`);
                await fetchNetworks();
            }
        });
    };

    // System Prune
    const handlePrune = () => {
        setConfirmState({
            title: 'System Prune',
            message: 'Warning: This will remove all stopped containers, unused networks, and dangling images. Proceed?',
            confirmText: 'Prune System',
            action: async () => {
                const res = await executeCommand(`docker system prune -f`);
                if (res.code !== 0) throw new Error(res.stderr || `System prune failed`);
                await refreshData();
            }
        });
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
        <div className="stitch-app">
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
                setConnected={setConnected}
            />

            <div className="stitch-body">
                <aside className="stitch-sidebar">
                    <button className="stitch-btn-deploy" onClick={() => setRunModalOpen(true)}>
                        + DEPLOY NEW
                    </button>

                    <nav className="stitch-nav-group">
                        <button 
                            className={`stitch-nav-item ${activeTab === 'containers' ? 'active' : ''}`}
                            onClick={() => setActiveTab('containers')}
                        >
                            <div className="stitch-nav-item-left">
                                <span className="material-symbols-outlined">view_module</span>
                                <span>Containers</span>
                            </div>
                            <span className="stitch-nav-badge">{containers.length}</span>
                        </button>

                        <button 
                            className={`stitch-nav-item ${activeTab === 'images' ? 'active' : ''}`}
                            onClick={() => setActiveTab('images')}
                        >
                            <div className="stitch-nav-item-left">
                                <span className="material-symbols-outlined">layers</span>
                                <span>Images</span>
                            </div>
                            <span className="stitch-nav-badge">{images.length}</span>
                        </button>

                        <button 
                            className={`stitch-nav-item ${activeTab === 'volumes' ? 'active' : ''}`}
                            onClick={() => setActiveTab('volumes')}
                        >
                            <div className="stitch-nav-item-left">
                                <span className="material-symbols-outlined">storage</span>
                                <span>Volumes</span>
                            </div>
                            <span className="stitch-nav-badge">{volumes.length}</span>
                        </button>

                        <button 
                            className={`stitch-nav-item ${activeTab === 'networks' ? 'active' : ''}`}
                            onClick={() => setActiveTab('networks')}
                        >
                            <div className="stitch-nav-item-left">
                                <span className="material-symbols-outlined">lan</span>
                                <span>Networks</span>
                            </div>
                            <span className="stitch-nav-badge">{networks.length}</span>
                        </button>

                        <button 
                            className={`stitch-nav-item ${activeTab === 'compose' ? 'active' : ''}`}
                            onClick={() => setActiveTab('compose')}
                        >
                            <div className="stitch-nav-item-left">
                                <span className="material-symbols-outlined">account_tree</span>
                                <span>Compose</span>
                            </div>
                        </button>
                    </nav>
                </aside>

                <main className="stitch-main">
                    {notification && (
                        <div className={`dm-toast ${notification.type}`}>
                            <span>{notification.message}</span>
                            <button 
                                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px' }} 
                                onClick={() => setNotification(null)}
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {activeTab === 'containers' && (
                        <div>
                            <div className="stitch-toolbar">
                                <div className="stitch-search">
                                    <span className="material-symbols-outlined stitch-search-icon">search</span>
                                    <input
                                        className="stitch-search-input"
                                        type="text"
                                        placeholder="Search containers..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                <div className="stitch-filters">
                                    <span style={{ fontSize: '0.82rem', color: 'var(--dm-on-surface-variant)', marginRight: '4px' }}>Filter by:</span>
                                    <button
                                        className={`stitch-filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                                        onClick={() => setStatusFilter('all')}
                                    >
                                        All ({containers.length})
                                    </button>
                                    <button
                                        className={`stitch-filter-btn ${statusFilter === 'running' ? 'active' : ''}`}
                                        onClick={() => setStatusFilter('running')}
                                    >
                                        Running ({runningCount})
                                    </button>
                                    <button
                                        className={`stitch-filter-btn ${statusFilter === 'stopped' ? 'active' : ''}`}
                                        onClick={() => setStatusFilter('stopped')}
                                    >
                                        Stopped ({stoppedCount})
                                    </button>
                                </div>
                            </div>

                            <div className="stitch-grid">
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
                </main>
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

            {confirmState && (
                <ConfirmModal
                    title={confirmState.title}
                    message={confirmState.message}
                    confirmText={confirmState.confirmText}
                    loading={confirmState.loading}
                    onClose={() => setConfirmState(null)}
                    onConfirm={async () => {
                        try {
                            setConfirmState(prev => prev ? { ...prev, loading: true } : null);
                            await confirmState.action();
                            setConfirmState(null);
                        } catch (err: any) {
                            setConfirmState(null);
                            setNotification({ type: 'error', message: err.message || 'Operation failed' });
                        }
                    }}
                />
            )}
        </div>
    );
}
