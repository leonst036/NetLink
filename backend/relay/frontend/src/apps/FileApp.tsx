import { useState, useEffect, useRef } from 'react';
import { Folder, File, ArrowLeft, RefreshCw, HardDrive, ShieldAlert, Upload, Download, Trash2, FolderPlus, X } from 'lucide-react';
import { 
  Box, 
  Typography, 
  TextField, 
  Select, 
  MenuItem, 
  Button, 
  IconButton, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  LinearProgress, 
  Alert,
  Card,
  CardContent,
  useTheme
} from '@mui/material';

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
  const theme = useTheme();
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

  const applyLogin = (e: any) => {
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
      {/* Login Screen */}
      {status === 'disconnected' && (
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, background: 'radial-gradient(circle at center, #0f172a 0%, #020617 100%)' }}>
          <Card sx={{ width: '100%', maxWidth: 380, bgcolor: 'rgba(30, 41, 59, 0.4)', backdropFilter: 'blur(16px)', border: `1px solid ${theme.palette.divider}`, borderRadius: 4, boxShadow: 24 }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <Box sx={{ bgcolor: 'warning.light', p: 1.5, borderRadius: 2, border: '1px solid rgba(251, 146, 60, 0.2)' }}>
                  <Folder size={28} color={theme.palette.warning.main} />
                </Box>
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 'bold' }} align="center" gutterBottom>SFTP File Client</Typography>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 4 }}>Access remote files securely</Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {savedLogins.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase', mb: 1, display: 'block' }}>Saved Logins</Typography>
                    <Select fullWidth size="small" value="" displayEmpty onChange={applyLogin}>
                      <MenuItem value="" disabled>Select a saved server...</MenuItem>
                      {savedLogins.map(l => <MenuItem key={l.id} value={l.id}>{l.name} ({l.ip})</MenuItem>)}
                    </Select>
                  </Box>
                )}

                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase', mb: 1, display: 'block' }}>Target IP / Hostname</Typography>
                  <TextField fullWidth size="small" placeholder="e.g. 192.168.1.10" value={selectedIp} onChange={e => setSelectedIp(e.target.value)} />
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase', mb: 1, display: 'block' }}>Username</Typography>
                  <TextField fullWidth size="small" value={username} onChange={e => setUsername(e.target.value)} />
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase', mb: 1, display: 'block' }}>Password</Typography>
                  <TextField fullWidth size="small" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                </Box>

                {statusMessage && (
                  <Alert severity="error" icon={<ShieldAlert size={16} />}>{statusMessage}</Alert>
                )}

                <Button 
                  variant="contained" 
                  color="warning" 
                  onClick={connectSftp} 
                  sx={{ mt: 1, py: 1.2, fontWeight: 'bold' }}
                >
                  Connect SFTP
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Connecting Loader */}
      {status === 'connecting' && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 2, bgcolor: '#020617' }}>
          <RefreshCw className="animate-spin" size={32} color={theme.palette.warning.main} />
          <Typography color="text.secondary">{statusMessage}</Typography>
        </Box>
      )}

      {/* Main File Explorer View */}
      {status === 'connected' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Action Header / Breadcrumb */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: 'rgba(15, 23, 42, 0.4)', borderBottom: `1px solid ${theme.palette.divider}` }}>
            <IconButton onClick={goBack} disabled={history.length === 0} sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
              <ArrowLeft size={16} />
            </IconButton>

            <IconButton onClick={refreshList} sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
              <RefreshCw size={16} />
            </IconButton>

            {/* Breadcrumb Path Bar */}
            <Box sx={{ 
              flex: 1, display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.8, 
              bgcolor: 'rgba(2, 6, 23, 0.4)', borderRadius: 1, border: `1px solid ${theme.palette.divider}`,
              fontFamily: 'monospace', color: 'info.main', overflow: 'hidden'
            }}>
              <HardDrive size={14} color="#64748b" />
              <Typography noWrap sx={{ fontFamily: 'inherit', fontSize: '0.85rem' }}>{currentPath}</Typography>
            </Box>

            <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} disabled={isUploading} />

            <Button 
              variant="outlined" 
              color="inherit" 
              onClick={handleCreateFolder} 
              startIcon={<FolderPlus size={14} />}
              sx={{ textTransform: 'none' }}
            >
              New Folder
            </Button>
            <Button 
              variant="outlined" 
              color="inherit" 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isUploading} 
              startIcon={<Upload size={14} />}
              sx={{ textTransform: 'none' }}
            >
              {isUploading ? `Uploading ${uploadProgress}%` : 'Upload'}
            </Button>

            <Button 
              variant="contained" 
              color="error" 
              onClick={disconnectSftp}
              sx={{ textTransform: 'none' }}
            >
              Disconnect
            </Button>
          </Box>

          {appError && (
            <Alert severity="error" onClose={() => setAppError(null)} sx={{ borderRadius: 0, '& .MuiAlert-message': { width: '100%' } }}>
              {appError}
            </Alert>
          )}

          {/* Upload Progress Bar */}
          {isUploading && uploadProgress !== null && (
            <Box sx={{ p: 1.5, bgcolor: 'rgba(234, 88, 12, 0.1)', borderBottom: `1px solid rgba(234, 88, 12, 0.2)` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'warning.main', mb: 1, fontSize: '0.85rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">Uploading {uploadFileRef.current?.name}...</Typography>
                  {transferSpeed && <Typography variant="caption" sx={{ opacity: 0.8 }}>({transferSpeed})</Typography>}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography variant="body2">{uploadProgress}%</Typography>
                  <IconButton size="small" color="error" onClick={cancelUpload} sx={{ p: 0 }}><X size={14} /></IconButton>
                </Box>
              </Box>
              <LinearProgress variant="determinate" value={uploadProgress} color="warning" />
            </Box>
          )}

          {/* Download Progress Bar */}
          {isDownloading && (
            <Box sx={{ p: 1.5, bgcolor: 'rgba(56, 189, 248, 0.1)', borderBottom: `1px solid rgba(56, 189, 248, 0.2)` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'info.main', mb: 1, fontSize: '0.85rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">Downloading {downloadFileNameRef.current}...</Typography>
                  {transferSpeed && <Typography variant="caption" sx={{ opacity: 0.8 }}>({transferSpeed})</Typography>}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography variant="body2">{downloadProgress !== null ? `${downloadProgress}%` : '...'}</Typography>
                  <IconButton size="small" color="error" onClick={cancelDownload} sx={{ p: 0 }}><X size={14} /></IconButton>
                </Box>
              </Box>
              <LinearProgress variant={downloadProgress !== null ? "determinate" : "indeterminate"} value={downloadProgress || 0} color="info" />
            </Box>
          )}

          {/* Files List Panel */}
          <TableContainer component={Box} sx={{ flex: 1, overflowY: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Permissions</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentPath !== '/' && (
                  <TableRow 
                    hover 
                    onClick={() => navigateTo('..')} 
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main', fontWeight: 500 }}>
                      <Folder size={16} /> ..
                    </TableCell>
                    <TableCell>--</TableCell>
                    <TableCell>--</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}

                {files.map((file) => {
                  const isDir = file.type === 'd';
                  return (
                    <TableRow
                      key={file.name}
                      hover
                      onClick={() => (file.type === 'd' || file.type === 'l') ? navigateTo(`${currentPath === '/' ? '' : currentPath}/${file.name}`) : triggerDownload(file.name, file.size)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell sx={{ display: 'flex', alignItems: 'center', gap: 1, color: isDir ? 'warning.main' : 'text.primary', fontWeight: isDir ? 500 : 400 }}>
                        {isDir ? <Folder size={16} /> : <File size={16} color="#94a3b8" />}
                        <Typography noWrap sx={{ maxWidth: 200, fontSize: '0.85rem' }}>{file.name}</Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>
                        {isDir ? '--' : formatSize(file.size)}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                        {file.rights ? `${file.type}${file.rights.user}${file.rights.group}${file.rights.other}` : '--'}
                      </TableCell>
                      <TableCell align="right">
                        {!isDir && (
                          <IconButton 
                            size="small" 
                            color="info" 
                            onClick={(e) => { e.stopPropagation(); triggerDownload(file.name, file.size); }}
                            sx={{ mr: 1 }}
                          >
                            <Download size={14} />
                          </IconButton>
                        )}
                        <IconButton 
                          size="small" 
                          color="error" 
                          onClick={(e) => { e.stopPropagation(); handleDeleteItem(file.name); }}
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {files.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      This folder is empty.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Spin Animation Keyframe */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Box>
  );
}