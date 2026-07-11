import { useState, useEffect } from 'react';
import Window from './Window';
import TerminalApp from './TerminalApp';
import NetworkGraph from './NetworkGraph';
import { Terminal, Network, LogOut, Search } from 'lucide-react';

interface DesktopProps {
  token: string;
  onLogout: () => void;
  target: string;
}

export default function Desktop({ token, onLogout, target }: DesktopProps) {
  const [servers, setServers] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // Window states
  const [activeWindow, setActiveWindow] = useState<string | null>('graph');

  const [graphWindow, setGraphWindow] = useState({ isOpen: true, zIndex: 1 });
  interface TerminalInstance {
    id: string;
    ip: string;
  }
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);


  const fetchServers = async () => {
    setIsScanning(true);
    try {
      const res = await fetch(`/api/servers?target=${encodeURIComponent(target)}`);
      const data = await res.json();
      if (data.devices) {
        setServers(data.devices);
      }
    } catch (err) {
      console.error('Failed to fetch servers', err);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    fetchServers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const bringToFront = (windowName: string) => {
    setActiveWindow(windowName);
  };

  const openTerminal = (ip: string) => {
    const newID = `terminal-${Date.now()}`;
    setTerminals(prev => [...prev, { id: newID, ip }])
    setActiveWindow(newID);
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'url("https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop") center/cover no-repeat',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Desktop overlay filter */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(2, 6, 23, 0.4)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Top Menu Bar */}
      <div style={{
        height: '28px',
        background: 'rgba(2, 6, 23, 0.6)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        justifyContent: 'space-between',
        color: 'white',
        fontSize: '0.85rem',
        fontWeight: 500,
        zIndex: 9999,
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontWeight: 'bold' }}>NetLink OS</span>
          <span>Target: {target}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>{new Date().toLocaleTimeString()}</span>
          <button onClick={onLogout} style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {/* Windows Area */}
      <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        {graphWindow.isOpen && (
          <Window
            id="graph"
            title="Network Topology Explorer"
            icon={<Network size={14} color="#38bdf8" />}
            isActive={activeWindow === 'graph'}
            onFocus={() => bringToFront('graph')}
            onClose={() => setGraphWindow(w => ({ ...w, isOpen: false }))}
            defaultPosition={{ x: 50, y: 50 }}
            defaultSize={{ width: 900, height: 600 }}
          >
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#020617' }}>
              <div style={{ padding: '10px', display: 'flex', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <button
                  onClick={fetchServers}
                  disabled={isScanning}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#3b82f6', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  <Search size={14} /> {isScanning ? 'Scanning...' : 'Scan Network'}
                </button>
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <NetworkGraph servers={servers} onNodeClick={(ip) => openTerminal(ip)} token={token} target={target} />
              </div>
            </div>
          </Window>
        )}

        {termWindow.isOpen && (
          <Window
            id="terminal"
            title={`NetLink Terminal - ${selectedIpForTerm || 'Localhost'}`}
            icon={<Terminal size={14} color="#a78bfa" />}
            isActive={activeWindow === 'terminal'}
            onFocus={() => bringToFront('terminal')}
            onClose={() => setTermWindow(w => ({ ...w, isOpen: false }))}
            defaultPosition={{ x: 150, y: 150 }}
            defaultSize={{ width: 800, height: 500 }}
          >
            <TerminalApp token={token} target={target} initialIp={selectedIpForTerm} />
          </Window>
        )}
      </div>

      {/* macOS style Dock */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '10px 16px',
        borderRadius: '24px',
        display: 'flex',
        gap: '16px',
        zIndex: 9999,
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}>
        <DockIcon
          icon={<Network size={24} color="#38bdf8" />}
          label="Topology Explorer"
          isOpen={graphWindow.isOpen}
          onClick={() => {
            setGraphWindow(w => ({ ...w, isOpen: true }));
            bringToFront('graph');
          }}
        />
        <DockIcon
          icon={<Terminal size={24} color="#a78bfa" />}
          label="New SSH Terminal"
          isOpen={terminals.length > 0}
          onClick={() => openTerminal('')}
        />
      </div>
    </div>
  );
}

function DockIcon({ icon, label, onClick, isOpen }: { icon: React.ReactNode; label: string; onClick: () => void; isOpen: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: '48px',
        height: '48px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '14px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.2s',
      }}
      title={label}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-5px) scale(1.1)';
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)';
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
      }}
    >
      {icon}
      {isOpen && (
        <div style={{ position: 'absolute', bottom: '-8px', width: '4px', height: '4px', borderRadius: '50%', background: '#f8fafc' }} />
      )}
    </div>
  );
}
