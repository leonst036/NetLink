import { useState, useEffect, useRef } from 'react';
import { Folder, File, ArrowLeft, RefreshCw, HardDrive, ShieldAlert, Upload, Download, Trash2, FolderPlus, X } from 'lucide-react';

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
  const [savedLogins, setSavedLogins] = useState<any[]>([]);

  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [statusMessage, setStatusMessage] = useState('');
  const [appError, setAppError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [history, setHistory] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [transferSpeed, setTransferSpeed] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const downloadTotalSizeRef = useRef<number>(0);
  const downloadReceivedRef = useRef<number>(0);

  const socketRef = useRef<WebSocket | null>(null);
  const downloadChunksRef = useRef<Blob[]>([]);
  const downloadFileNameRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadFileRef = useRef<File | null>(null);
  const uploadOffsetRef = useRef<number>(0);
  const currentChunkSizeRef = useRef<number>(64 * 1024);
  const chunkStartTimeRef = useRef<number>(0);

  const normalizePath = (p: string): string => {
    let clean = p.replace(/\/+/g, '/');
    if (clean.length > 1 && clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }
    return clean;
  };

  const triggerDownload = (fileName: string, fileSize: number = 0) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    setAppError(null);
    const fullPath = normalizePath(currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`);
    downloadFileNameRef.current = fileName;
    downloadChunksRef.current = [];
    downloadTotalSizeRef.current = fileSize;
    downloadReceivedRef.current = 0;
    setIsDownloading(true);
    setDownloadProgress(0);
    setTransferSpeed('');
    chunkStartTimeRef.current = Date.now();
    socketRef.current.send(JSON.stringify({ type: 'download', path: fullPath }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    setAppError(null);

    uploadFileRef.current = file;
    uploadOffsetRef.current = 0;
    currentChunkSizeRef.current = 64 * 1024;
    setIsUploading(true);
    setUploadProgress(0);
    setTransferSpeed('');

    const remotePath = normalizePath(currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`);
    socketRef.current.send(JSON.stringify({ type: 'upload', path: remotePath }));
  };


  const cancelUpload = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'uploadCancel' }));
      setIsUploading(false);
      setUploadProgress(null);
      setTransferSpeed('');
      uploadFileRef.current = null;
    }
  };

  const cancelDownload = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'downloadCancel' }));
    }
  };

  const handleCreateFolder = () => {
    const folderName = prompt('Enter new folder name:');
    if (folderName && socketRef.current?.readyState === WebSocket.OPEN) {
      const targetPath = normalizePath(currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`);
      socketRef.current.send(JSON.stringify({ type: 'mkdir', path: targetPath }));
    }
  };

  const handleDeleteItem = (itemName: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete "${itemName}"?`);
    if (confirmDelete && socketRef.current?.readyState === WebSocket.OPEN) {
      const targetPath = normalizePath(currentPath === '/' ? `/${itemName}` : `${currentPath}/${itemName}`);
      socketRef.current.send(JSON.stringify({ type: 'delete', path: targetPath }));
    }
  };

  const sendNextChunk = () => {
    const file = uploadFileRef.current;
    if (!file || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    const offset = uploadOffsetRef.current;
    if (offset >= file.size) {
      socketRef.current.send(JSON.stringify({ type: 'uploadEnd' }));
      return;
    }

    const chunkSize = currentChunkSizeRef.current;
    const slice = file.slice(offset, offset + chunkSize);
    chunkStartTimeRef.current = Date.now();
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
    let host = window.location.host;
    if (host.includes('localhost:5173')) host = 'localhost:4535'; // Dev mode fallback

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
            
            downloadReceivedRef.current += bytes.byteLength;
            if (downloadTotalSizeRef.current > 0) {
              setDownloadProgress(Math.min(100, Math.round((downloadReceivedRef.current / downloadTotalSizeRef.current) * 100)));
            }
            const duration = Date.now() - chunkStartTimeRef.current;
            if (duration > 0) {
              const speedBytesPerMs = bytes.byteLength / duration;
              setTransferSpeed((speedBytesPerMs / 1024).toFixed(2) + ' MB/s');
            }
            chunkStartTimeRef.current = Date.now();
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
          setIsDownloading(false);
          setDownloadProgress(null);
          setTransferSpeed('');
        }
        else if (data.type === 'downloadCancelled') {
          downloadChunksRef.current = [];
          downloadFileNameRef.current = '';
          setIsDownloading(false);
          setDownloadProgress(null);
          setTransferSpeed('');
        }
        else if (data.type === 'mkdirSuccess' || data.type === 'deleteSuccess') {
          refreshList();
        }
        else if (data.type === 'uploadReady') {
          sendNextChunk();
        }
        else if (data.type === 'uploadAck') {
          const file = uploadFileRef.current;
          if (file) {
            setUploadProgress(Math.min(100, Math.round((uploadOffsetRef.current / file.size) * 100)));
            const duration = Date.now() - chunkStartTimeRef.current;
            if (duration > 0) {
              const speedBytesPerMs = currentChunkSizeRef.current / duration;
              setTransferSpeed((speedBytesPerMs / 1024).toFixed(2) + ' MB/s');
            }
            if (duration < 50 && currentChunkSizeRef.current < 2 * 1024 * 1024) {
              currentChunkSizeRef.current = Math.floor(currentChunkSizeRef.current * 1.5);
            } else if (duration > 150 && currentChunkSizeRef.current > 32 * 1024) {
              currentChunkSizeRef.current = Math.floor(currentChunkSizeRef.current * 0.75);
            }
          }
          sendNextChunk();
        }
        else if (data.type === 'uploadSuccess') {
          setIsUploading(false);
          setUploadProgress(null);
          setTransferSpeed('');
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

  // Fetch saved logins
  useEffect(() => {
    fetch('/api/server-logins', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.logins) {
          setSavedLogins(data.logins.filter((l: any) => l.type === 'sftp'));
        }
      })
      .catch(err => console.error('Failed to fetch logins', err));
  }, [token]);

  const applyLogin = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const login = savedLogins.find(l => l.id === e.target.value);
    if (login) {
      setSelectedIp(login.ip);
      setUsername(login.loginUsername);
      setPassword(login.password);
    }
  };

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
              {savedLogins.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '6px' }}>
                    Saved Logins
                  </label>
                  <select
                    onChange={applyLogin}
                    defaultValue=""
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '0.9rem',
                      outline: 'none',
                      appearance: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="" disabled>Select a saved server...</option>
                    {savedLogins.map(l => (
                      <option key={l.id} value={l.id}>{l.name} ({l.ip})</option>
                    ))}
                  </select>
                </div>
              )}

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
              onClick={handleCreateFolder}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FolderPlus size={14} />
              <span>New Folder</span>
            </button>
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
              padding: '12px 16px',
              background: 'rgba(234, 88, 12, 0.1)',
              borderBottom: '1px solid rgba(234, 88, 12, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#fb923c' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Uploading {uploadFileRef.current?.name}...</span>
                  {transferSpeed && <span style={{ opacity: 0.8 }}>({transferSpeed})</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span>{uploadProgress}%</span>
                  <button onClick={cancelUpload} style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', display: 'flex', padding: 0 }}><X size={14} /></button>
                </div>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#fb923c', transition: 'width 0.2s' }} />
              </div>
            </div>
          )}

          {/* Download Progress Bar */}
          {isDownloading && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(56, 189, 248, 0.1)',
              borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#38bdf8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Downloading {downloadFileNameRef.current}...</span>
                  {transferSpeed && <span style={{ opacity: 0.8 }}>({transferSpeed})</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {downloadProgress !== null ? <span>{downloadProgress}%</span> : <span>...</span>}
                  <button onClick={cancelDownload} style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', display: 'flex', padding: 0 }}><X size={14} /></button>
                </div>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${downloadProgress || 0}%`, height: '100%', background: '#38bdf8', transition: 'width 0.2s' }} />
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
                      onClick={() => (file.type === 'd' || file.type === 'l') ? navigateTo(`${currentPath === '/' ? '' : currentPath}/${file.name}`) : triggerDownload(file.name, file.size)}
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
                              triggerDownload(file.name, file.size);
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
                              transition: 'color 0.2s, background 0.2s',
                              marginRight: '8px'
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(file.name);
                          }}
                          title="Delete"
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
                            e.currentTarget.style.color = '#ef4444';
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#94a3b8';
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
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