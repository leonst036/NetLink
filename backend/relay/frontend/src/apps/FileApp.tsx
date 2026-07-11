import { useState, useEffect, useRef } from 'react';
import { Folder, File, ArrowLeft, RefreshCw, HardDrive, ShieldAlert, Upload, Download } from 'lucide-react';

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
  const [appError, setAppError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [history, setHistory] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const downloadChunksRef = useRef<Blob[]>([]);
  const downloadFileNameRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadFileRef = useRef<File | null>(null);
  const uploadOffsetRef = useRef<number>(0);

  const normalizePath = (p: string): string => {
    let clean = p.replace(/\/+/g, '/');
    if (clean.length > 1 && clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }
    return clean;
  };

  const triggerDownload = (fileName: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    setAppError(null);
    const fullPath = normalizePath(currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`);
    downloadFileNameRef.current = fileName;
    downloadChunksRef.current = [];
    socketRef.current.send(JSON.stringify({ type: 'download', path: fullPath }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    setAppError(null);

    uploadFileRef.current = file;
    uploadOffsetRef.current = 0;
    setIsUploading(true);
    setUploadProgress(0);

    const remotePath = normalizePath(currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`);
    socketRef.current.send(JSON.stringify({ type: 'upload', path: remotePath }));
  };

  const sendNextChunk = () => {
    const file = uploadFileRef.current;
    if (!file || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    const offset = uploadOffsetRef.current;
    if (offset >= file.size) {
      socketRef.current.send(JSON.stringify({ type: 'uploadEnd' }));
      return;
    }

    const chunkSize = 64 * 1024; // 64KB
    const slice = file.slice(offset, offset + chunkSize);
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      if (!arrayBuffer) return;
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      socketRef.current?.send(JSON.stringify({ type: 'uploadChunk', data: base64 }));
      uploadOffsetRef.current += bytes.byteLength;
    };
    reader.readAsArrayBuffer(slice);
  };

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
          setAppError(null);
          const startPath = data.homeDir || '/';
          setCurrentPath(startPath);
          socket.send(JSON.stringify({ type: 'list', path: startPath }));
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
          const errorMsg = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
          if (data.fatal) {
            setStatus('disconnected');
            setStatusMessage(errorMsg);
          } else {
            setAppError(errorMsg);
          }
          setIsUploading(false);
          setUploadProgress(null);
        }
        else if (data.type === 'fileDataDownload') {
          if (typeof data.data === 'string') {
            const binaryString = atob(data.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            downloadChunksRef.current.push(new Blob([bytes]));
          }
        }
        else if (data.type === 'fileEnd') {
          const blob = new Blob(downloadChunksRef.current, { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = downloadFileNameRef.current || 'download';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          downloadChunksRef.current = [];
          downloadFileNameRef.current = '';
        }
        else if (data.type === 'uploadReady') {
          sendNextChunk();
        }
        else if (data.type === 'uploadAck') {
          const file = uploadFileRef.current;
          if (file) {
            setUploadProgress(Math.min(100, Math.round((uploadOffsetRef.current / file.size) * 100)));
          }
          sendNextChunk();
        }
        else if (data.type === 'uploadSuccess') {
          setIsUploading(false);
          setUploadProgress(null);
          uploadFileRef.current = null;
          uploadOffsetRef.current = 0;
          refreshList();
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    };

    socket.onclose = (event) => {
      setStatus('disconnected');
      setFiles([]);
      setIsUploading(false);
      setUploadProgress(null);
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
    setAppError(null);

    let targetPath = path;
    // Handle relative pathing
    if (path === '..') {
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      targetPath = '/' + parts.join('/');
    }

    targetPath = normalizePath(targetPath);

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

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              disabled={isUploading}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: isUploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: isUploading ? 0.5 : 1
              }}
            >
              <Upload size={14} />
              <span>{isUploading ? `Uploading ${uploadProgress}%` : 'Upload'}</span>
            </button>

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

          {appError && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#fca5a5',
              padding: '10px 16px',
              fontSize: '0.8rem',
              fontWeight: 500
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                <span>{appError}</span>
              </div>
              <button
                onClick={() => setAppError(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: 1,
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Upload Progress Bar */}
          {isUploading && uploadProgress !== null && (
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              padding: '8px 16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', minWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Uploading: {uploadFileRef.current?.name}
              </div>
              <div style={{
                flex: 1,
                height: '6px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${uploadProgress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #38bdf8, #0ea5e9)',
                  transition: 'width 0.1s'
                }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', minWidth: '40px', textAlign: 'right' }}>
                {uploadProgress}%
              </div>
            </div>
          )}

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
                  <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
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
                    <td style={{ padding: '10px 12px', color: '#64748b' }}></td>
                  </tr>
                )}

                {files.map((file) => {
                  const isDir = file.type === 'd';
                  return (
                    <tr
                      key={file.name}
                      onClick={() => (file.type === 'd' || file.type === 'l') ? navigateTo(`${currentPath === '/' ? '' : currentPath}/${file.name}`) : triggerDownload(file.name)}
                      style={{
                        cursor: 'pointer',
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
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        {!isDir && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerDownload(file.name);
                            }}
                            title="Download File"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'color 0.2s, background 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#38bdf8';
                              e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#94a3b8';
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <Download size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {files.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
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