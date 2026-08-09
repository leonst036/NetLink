import React, { useState, useEffect } from 'react';
import LoginPanel from './components/LoginPanel.tsx';
import DashboardHeader from './components/DashboardHeader.tsx';
import ContainerCard from './components/ContainerCard.tsx';
import LogModal from './components/LogModal.tsx';
import EmptyState from './components/EmptyState.tsx';
import ImagesTab from './tabs/ImagesTab.tsx';
import VolumesTab from './tabs/VolumesTab.tsx';

export default function DockerManager() {
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [credentials, setCredentials] = useState({ host: '', port: '22', username: '', password: '' });
    
    const [activeTab, setActiveTab] = useState<'containers' | 'images' | 'volumes'>('containers');
    const [containers, setContainers] = useState<any[]>([]);
    const [containerStats, setContainerStats] = useState<Record<string, any>>({});
    const [images, setImages] = useState<any[]>([]);
    const [volumes, setVolumes] = useState<any[]>([]);
    
    const [selectedLogContainer, setSelectedLogContainer] = useState<any>(null);
    const [logContent, setLogContent] = useState('');
    const [logLoading, setLogLoading] = useState(false);
    
    const [error, setError] = useState('');

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
        
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Request failed');
        }
        
        return await res.json();
    };

    const refreshData = async () => {
        try {
            // Containers
            const resC = await executeCommand("docker ps -a --format '{{json .}}'");
            if (resC.code === 0) {
                const parsed = resC.stdout.split('\n').filter((l: string) => l.trim()).map((l: string) => JSON.parse(l));
                setContainers(parsed);
            }

            // Live Container Stats (non-streaming)
            const resS = await executeCommand("docker stats --no-stream --format '{{json .}}'");
            if (resS.code === 0) {
                const statsMap: Record<string, any> = {};
                resS.stdout.split('\n').filter((l: string) => l.trim()).forEach((l: string) => {
                    try {
                        const parsedS = JSON.parse(l);
                        statsMap[parsedS.ID || parsedS.Container] = parsedS;
                    } catch {}
                });
                setContainerStats(statsMap);
            }

            // Images
            const resI = await executeCommand("docker images --format '{{json .}}'");
            if (resI.code === 0) {
                const parsedI = resI.stdout.split('\n').filter((l: string) => l.trim()).map((l: string) => JSON.parse(l));
                setImages(parsedI);
            }

            // Volumes
            const resV = await executeCommand("docker volume ls --format '{{json .}}'");
            if (resV.code === 0) {
                const parsedV = resV.stdout.split('\n').filter((l: string) => l.trim()).map((l: string) => JSON.parse(l));
                setVolumes(parsedV);
            }
        } catch (err) {
            console.error('Refresh failed', err);
        }
    };

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setConnecting(true);
        setError('');
        
        try {
            const result = await executeCommand("docker ps -a --format '{{json .}}'");
            if (result.code !== 0) throw new Error(result.stderr || `Failed code ${result.code}`);
            
            setConnected(true);
            await refreshData();
        } catch (err: any) {
            setError(err.message || 'Failed to connect');
        } finally {
            setConnecting(false);
        }
    };

    const handleAction = async (action: 'start' | 'stop' | 'restart', containerId: string) => {
        try {
            await executeCommand(`docker ${action} ${containerId}`);
            await refreshData();
        } catch (err: any) {
            alert(`Failed to ${action} container: ${err.message}`);
        }
    };

    const handleRemoveContainer = async (containerId: string) => {
        if (!confirm('Are you sure you want to remove this container?')) return;
        try {
            await executeCommand(`docker rm -f ${containerId}`);
            await refreshData();
        } catch (err: any) {
            alert(`Failed to remove container: ${err.message}`);
        }
    };

    const handlePullImage = async (imageName: string) => {
        try {
            await executeCommand(`docker pull ${imageName}`);
            await refreshData();
        } catch (err: any) {
            alert(`Failed to pull image: ${err.message}`);
        }
    };

    const handleRemoveImage = async (imageId: string) => {
        if (!confirm('Are you sure you want to delete this image?')) return;
        try {
            await executeCommand(`docker rmi -f ${imageId}`);
            await refreshData();
        } catch (err: any) {
            alert(`Failed to delete image: ${err.message}`);
        }
    };

    const handleRemoveVolume = async (volumeName: string) => {
        if (!confirm('Are you sure you want to delete this volume?')) return;
        try {
            await executeCommand(`docker volume rm ${volumeName}`);
            await refreshData();
        } catch (err: any) {
            alert(`Failed to delete volume: ${err.message}`);
        }
    };

    const handlePrune = async () => {
        if (!confirm('System Prune will remove all stopped containers, unused networks, and dangling images. Continue?')) return;
        try {
            await executeCommand("docker system prune -af");
            await refreshData();
            alert('System pruned successfully!');
        } catch (err: any) {
            alert(`Prune failed: ${err.message}`);
        }
    };

    const fetchLogs = async (container: any) => {
        setLogLoading(true);
        setSelectedLogContainer(container);
        try {
            const res = await executeCommand(`docker logs --tail 200 ${container.ID}`);
            setLogContent(res.stdout || res.stderr || 'No logs available.');
        } catch (err: any) {
            setLogContent(`Error fetching logs: ${err.message}`);
        } finally {
            setLogLoading(false);
        }
    };

    if (!connected) {
        return (
            <LoginPanel 
                credentials={credentials} 
                setCredentials={setCredentials} 
                connecting={connecting} 
                error={error} 
                handleConnect={handleConnect} 
            />
        );
    }

    const runningCount = containers.filter(c => c.State === 'running').length;

    return (
        <div className="dm-dashboard">
            <DashboardHeader 
                credentials={credentials} 
                refreshData={refreshData} 
                handlePrune={handlePrune} 
                setConnected={setConnected} 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
            />
            
            {/* Quick Stats Summary */}
            <div className="dm-stats-bar">
                <div className="nl-panel dm-stat-card">
                    <span className="dm-stat-val">{containers.length}</span>
                    <span className="dm-stat-lbl">Containers ({runningCount} Running)</span>
                </div>
                <div className="nl-panel dm-stat-card">
                    <span className="dm-stat-val">{images.length}</span>
                    <span className="dm-stat-lbl">Images</span>
                </div>
                <div className="nl-panel dm-stat-card">
                    <span className="dm-stat-val">{volumes.length}</span>
                    <span className="dm-stat-lbl">Volumes</span>
                </div>
            </div>

            <div className="dm-content">
                {activeTab === 'containers' && (
                    <div className="dm-grid">
                        {containers.map(container => (
                            <ContainerCard 
                                key={container.ID} 
                                container={container} 
                                stats={containerStats}
                                handleAction={handleAction} 
                                handleViewLogs={fetchLogs}
                                handleRemove={handleRemoveContainer}
                            />
                        ))}
                        {containers.length === 0 && <EmptyState />}
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
                        handleRemoveVolume={handleRemoveVolume} 
                    />
                )}
            </div>

            <LogModal 
                container={selectedLogContainer} 
                logs={logContent} 
                loading={logLoading} 
                onClose={() => setSelectedLogContainer(null)} 
                onRefresh={() => fetchLogs(selectedLogContainer)} 
            />
        </div>
    );
}
