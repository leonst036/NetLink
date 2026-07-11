import { useState, useEffect, useRef } from 'react';
import { Folder, File, ArrowLeft, RefreshCw, HardDrive, ShieldAlert } from 'lucide-react';

interface FileAppProps {
  token: string;
  target: string;
  initialIp?: string;
}

interface FileItem {
  type: string; // 'd' for directory, '-' for file, 'l' for symlink
  name: string;
  size: number;
  modifyTime: number;
  rights: {
    user: string;
    group: string;
    other: string;
  };
  owner: number;
  group: number;
}

export default function FileApp({ token, target, initialIp }: FileAppProps) {
  const [selectedIp, setSelectedIp] = useState(initialIp || '');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [statusMessage, setStatusMessage] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [history, setHistory] = useState<string[]>([]);
  
  const socketRef = useRef<WebSocket | null>(null);

  const connectSftp = () => {
    if (!token) return;
    if (socketRef.current) socketRef.current.close();

    setStatus('connecting');
    setStatusMessage('Connecting to Relay Server...');

    const isSecure = window.location.protocol === 'https:';
    const protocol = isSecure ? 'wss:' : 'ws:';
    const wsPort = '4536';
    const host = window.location.hostname
      ? `${window.location.hostname}:${wsPort}`
      : `localhost:${wsPort}`;

    const socketUrl = `${protocol}//${host}/client?token=${encodeURIComponent(token)}&target=${encodeURIComponent(target)}`;
    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatusMessage('Connected to relay. Handshaking with local server...');
    };

    socket.onmessage = async (event) => {
      let textData = event.data;
      if (event.data instanceof Blob) {
        textData = await event.data.text();
      } else if (event.data instanceof ArrayBuffer) {
        textData = new TextDecoder().decode(event.data);
      }

      try {
        const data = JSON.parse(textData);

        if (data.type === 'ready_for_credentials') {
          setStatusMessage('Sending SFTP credentials...');
          socket.send(JSON.stringify({
            type: 'connect_sftp',
            ip: selectedIp || 'localhost',
            username,
            password
          }));
        } 
        else if (data.type === 'connected') {
          setStatus('connected');
          setStatusMessage('');
          // Load root / initial directory
          socket.send(JSON.stringify({ type: 'list', path: '/' }));
        } 
        else if (data.type === 'fileList') {
          // Sort folders first, then files
          const sortedList = (data.data as FileItem[]).sort((a, b) => {
            if (a.type === 'd' && b.type !== 'd') return -1;
            if (a.type !== 'd' && b.type === 'd') return 1;
            return a.name.localeCompare(b.name);
          });
          setFiles(sortedList);
        } 
        else if (data.type === 'error') {
          setStatus('disconnected');
          setStatusMessage(typeof data.message === 'string' ? data.message : JSON.stringify(data.message));
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    };

    socket.onclose = (event) => {
      setStatus('disconnected');
      setFiles([]);
      if (event.code !== 1000 && event.code !== 1005) {
        setStatusMessage(`Connection lost (Code: ${event.code})`);
      }
    };

    socket.onerror = () => {
      setStatus('disconnected');
      setStatusMessage('WebSocket error occurred.');
    };
  };

  const disconnectSftp = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setStatus('disconnected');
    setFiles([]);
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const navigateTo = (path: string, pushToHistory = true) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    
    let targetPath = path;
    // Handle relative pathing
    if (path === '..') {
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      targetPath = '/' + parts.join('/');
    }

    if (pushToHistory) {
      setHistory(prev => [...prev, currentPath]);
    }
    
    setCurrentPath(targetPath);
    socketRef.current.send(JSON.stringify({ type: 'list', path: targetPath }));
  };

  const goBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(prevHistory => prevHistory.slice(0, -1));
    navigateTo(prev, false);
  };

  const refreshList = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'list', path: currentPath }));
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#090d1a',
      color: '#e2e8f0',
      fontFamily: '"Inter", -apple-system, sans-serif'
    }}>
      {/* Login Screen */}
      {status === 'disconnected' && (
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px',
          background: 'radial-gradient(circle at center, #0f172a 0%, #020617 100%)'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '380px',
            background: 'rgba(30, 41, 59, 0.4)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{
                background: 'rgba(251, 146, 60, 0.1)',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid rgba(251, 146, 60, 0.2)'
              }}>
                <Folder size={28} color="#fb923c" />
              </div>
            </div>
            
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 600, textAlign: 'center', color: '#f8fafc' }}>
              SFTP File Client
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>
              Access remote files securely
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '6px' }}>
                  Target IP / Hostname
                </label>
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.10"
                  value={selectedIp}
                  onChange={(e) => setSelectedIp(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '6px' }}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '6px' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  placeholder="Enter password..."
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              {statusMessage && (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#fca5a5',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  lineHeight: '1.4'
                }}>
                  <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                  <div>{statusMessage}</div>
                </div>
              )}

              <button
                onClick={connectSftp}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #fb923c 0%, #ea580c 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)',
                  transition: 'transform 0.1s, opacity 0.2s',
                  marginTop: '6px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Connect SFTP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connecting Loader */}
      {status === 'connecting' && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px',
          background: '#020617'
        }}>
          <RefreshCw className="animate-spin" size={32} color="#fb923c" style={{ animation: 'spin 2s linear infinite' }} />
          <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>{statusMessage}</div>
        </div>
      )}

      {/* Main File Explorer View */}
      {status === 'connected' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          
          {/* Action Header / Breadcrumb */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            background: 'rgba(15, 23, 42, 0.4)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <button
              onClick={goBack}
              disabled={history.length === 0}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px',
                cursor: history.length === 0 ? 'not-allowed' : 'pointer',
                opacity: history.length === 0 ? 0.3 : 1,
                color: 'white',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ArrowLeft size={16} />
            </button>

            <button
              onClick={refreshList}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px',
                cursor: 'pointer',
                color: 'white',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <RefreshCw size={16} />
            </button>

            {/* Breadcrumb Path Bar */}
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(2, 6, 23, 0.4)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              fontSize: '0.85rem',
              color: '#38bdf8',
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              <HardDrive size={14} color="#64748b" />
              <span>{currentPath}</span>
            </div>

            <button
              onClick={disconnectSftp}
              style={{
                background: '#ef4444',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Disconnect
            </button>
          </div>

          {/* Files List Panel */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#64748b' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>Size</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>Permissions</th>
                </tr>
              </thead>
              <tbody>
                {currentPath !== '/' && (
                  <tr
                    onClick={() => navigateTo('..')}
                    style={{
                      cursor: 'pointer',
                      borderRadius: '6px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fb923c', fontWeight: 500 }}>
                      <Folder size={16} />
                      <span>..</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>--</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>--</td>
                  </tr>
                )}

                {files.map((file) => {
                  const isDir = file.type === 'd';
                  return (
                    <tr
                      key={file.name}
                      onClick={() => isDir ? navigateTo(`${currentPath === '/' ? '' : currentPath}/${file.name}`) : null}
                      style={{
                        cursor: isDir ? 'pointer' : 'default',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: isDir ? '#facc15' : '#f1f5f9',
                        fontWeight: isDir ? 500 : 400
                      }}>
                        {isDir ? <Folder size={16} color="#fb923c" /> : <File size={16} color="#94a3b8" />}
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                        {isDir ? '--' : formatSize(file.size)}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontFamily: 'monospace' }}>
                        {file.rights ? `${file.type}${file.rights.user}${file.rights.group}${file.rights.other}` : '--'}
                      </td>
                    </tr>
                  );
                })}

                {files.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      This folder is empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Spin Animation Keyframe */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}