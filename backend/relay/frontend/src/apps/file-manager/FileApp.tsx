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
import { styled } from '@mui/material/styles';
import GeminiLoader from '../../components/GeminiLoader';

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
    console.log(`Debug: Triggering download for ${fileName} of size ${fileSize}`);
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
    if (host.includes('localhost:5173')) host = import.meta.env.VITE_RELAY_HOST || 'localhost:4535'; // Dev mode fallback

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
    <RootContainer>
      {/* Login Screen */}
      {status === 'disconnected' && (
        <LoginContainer>
          <LoginCard>
            <LoginCardContent>
              <IconWrapper>
                <IconContainer>
                  <Folder size={28} color={theme.palette.warning.main} />
                </IconContainer>
              </IconWrapper>

              <LoginTitle variant="h6" align="center" gutterBottom>SFTP File Client</LoginTitle>
              <LoginSubtitle variant="body2" color="text.secondary" align="center">Access remote files securely</LoginSubtitle>

              <LoginForm>
                {savedLogins.length > 0 && (
                  <Box>
                    <FormLabelText variant="caption" color="text.secondary">Saved Logins</FormLabelText>
                    <Select fullWidth size="small" value="" displayEmpty onChange={applyLogin}>
                      <MenuItem value="" disabled>Select a saved server...</MenuItem>
                      {savedLogins.map(l => <MenuItem key={l.id} value={l.id}>{l.name} ({l.ip})</MenuItem>)}
                    </Select>
                  </Box>
                )}

                <Box>
                  <FormLabelText variant="caption" color="text.secondary">Target IP / Hostname</FormLabelText>
                  <TextField fullWidth size="small" placeholder="e.g. 192.168.1.10" value={selectedIp} onChange={e => setSelectedIp(e.target.value)} />
                </Box>

                <Box>
                  <FormLabelText variant="caption" color="text.secondary">Username</FormLabelText>
                  <TextField fullWidth size="small" value={username} onChange={e => setUsername(e.target.value)} />
                </Box>

                <Box>
                  <FormLabelText variant="caption" color="text.secondary">Password</FormLabelText>
                  <TextField fullWidth size="small" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                </Box>

                {statusMessage && (
                  <Alert severity="error" icon={<ShieldAlert size={16} />}>{statusMessage}</Alert>
                )}

                <ConnectButton
                  variant="contained"
                  color="warning"
                  onClick={connectSftp}
                >
                  Connect SFTP
                </ConnectButton>
              </LoginForm>
            </LoginCardContent>
          </LoginCard>
        </LoginContainer>
      )}

      {/* Connecting Loader */}
      {status === 'connecting' && (
        <LoadingContainer>
          <GeminiLoader size={64} />
          <LoadingText color="text.secondary">{statusMessage}</LoadingText>
        </LoadingContainer>
      )}

      {/* Main File Explorer View */}
      {status === 'connected' && (
        <ExplorerContainer>
          {/* Action Header / Breadcrumb */}
          <Toolbar>
            <ToolbarIconButton onClick={goBack} disabled={history.length === 0}>
              <ArrowLeft size={16} />
            </ToolbarIconButton>

            <ToolbarIconButton onClick={refreshList}>
              <RefreshCw size={16} />
            </ToolbarIconButton>

            {/* Breadcrumb Path Bar */}
            <PathBar>
              <HardDrive size={14} color="#64748b" />
              <PathText noWrap>{currentPath}</PathText>
            </PathBar>

            <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} disabled={isUploading} />

            <ToolbarButton
              variant="outlined"
              color="inherit"
              onClick={handleCreateFolder}
              startIcon={<FolderPlus size={14} />}
            >
              New Folder
            </ToolbarButton>
            <ToolbarButton
              variant="outlined"
              color="inherit"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              startIcon={<Upload size={14} />}
            >
              {isUploading ? `Uploading ${uploadProgress}%` : 'Upload'}
            </ToolbarButton>

            <ToolbarButton
              variant="contained"
              color="error"
              onClick={disconnectSftp}
            >
              Disconnect
            </ToolbarButton>
          </Toolbar>

          {appError && (
            <StyledAlert severity="error" onClose={() => setAppError(null)}>
              {appError}
            </StyledAlert>
          )}

          {/* Upload Progress Bar */}
          {isUploading && uploadProgress !== null && (
            <UploadProgressContainer>
              <ProgressHeader $colorType="warning">
                <ProgressLabelSection>
                  <Typography variant="body2">Uploading {uploadFileRef.current?.name}...</Typography>
                  {transferSpeed && <TransferSpeedText variant="caption">({transferSpeed})</TransferSpeedText>}
                </ProgressLabelSection>
                <ProgressActionsSection>
                  <Typography variant="body2">{uploadProgress}%</Typography>
                  <CancelIconButton size="small" color="error" onClick={cancelUpload}><X size={14} /></CancelIconButton>
                </ProgressActionsSection>
              </ProgressHeader>
              <LinearProgress variant="determinate" value={uploadProgress} color="warning" />
            </UploadProgressContainer>
          )}

          {/* Download Progress Bar */}
          {isDownloading && (
            <DownloadProgressContainer>
              <ProgressHeader $colorType="info">
                <ProgressLabelSection>
                  <Typography variant="body2">Downloading {downloadFileNameRef.current}...</Typography>
                  {transferSpeed && <TransferSpeedText variant="caption">({transferSpeed})</TransferSpeedText>}
                </ProgressLabelSection>
                <ProgressActionsSection>
                  <Typography variant="body2">{downloadProgress !== null ? `${downloadProgress}%` : '...'}</Typography>
                  <CancelIconButton size="small" color="error" onClick={cancelDownload}><X size={14} /></CancelIconButton>
                </ProgressActionsSection>
              </ProgressHeader>
              <LinearProgress variant={downloadProgress !== null ? "determinate" : "indeterminate"} value={downloadProgress || 0} color="info" />
            </DownloadProgressContainer>
          )}

          {/* Files List Panel */}
          <StyledTableContainer component={Box}>
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
                  <StyledTableRow
                    hover
                    onClick={() => navigateTo('..')}
                  >
                    <TableCell>
                      <UpFolderContainer>
                        <Folder size={16} /> ..
                      </UpFolderContainer>
                    </TableCell>
                    <TableCell>--</TableCell>
                    <TableCell>--</TableCell>
                    <TableCell></TableCell>
                  </StyledTableRow>
                )}

                {files.map((file) => {
                  const isDir = file.type === 'd';
                  return (
                    <StyledTableRow
                      key={file.name}
                      hover
                      onClick={() => (file.type === 'd' || file.type === 'l') ? navigateTo(`${currentPath === '/' ? '' : currentPath}/${file.name}`) : triggerDownload(file.name, file.size)}
                    >
                      <TableCell>
                        <FileItemContainer $isDir={isDir}>
                          {isDir ? <Folder size={16} /> : <File size={16} color="#94a3b8" />}
                          <FileNameText noWrap>{file.name}</FileNameText>
                        </FileItemContainer>
                      </TableCell>
                      <SecondaryTableCell>
                        {isDir ? '--' : formatSize(file.size)}
                      </SecondaryTableCell>
                      <MonospaceTableCell>
                        {file.rights ? `${file.type}${file.rights.user}${file.rights.group}${file.rights.other}` : '--'}
                      </MonospaceTableCell>
                      <TableCell align="right">
                        {!isDir && (
                          <ActionIconButton
                            size="small"
                            color="info"
                            onClick={(e) => { e.stopPropagation(); triggerDownload(file.name, file.size); }}
                          >
                            <Download size={14} />
                          </ActionIconButton>
                        )}
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => { e.stopPropagation(); handleDeleteItem(file.name); }}
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      </TableCell>
                    </StyledTableRow>
                  );
                })}

                {files.length === 0 && (
                  <TableRow>
                    <EmptyTableCell colSpan={4} align="center">
                      This folder is empty.
                    </EmptyTableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </StyledTableContainer>
        </ExplorerContainer>
      )}

      {/* Spin Animation Keyframe */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </RootContainer>
  );
}

// Styled Components
const RootContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: 'transparent',
});

const LoginContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: theme.spacing(3),
  background: 'transparent',
}));

const LoginCard = styled(Card)(({ theme }) => ({
  width: '100%',
  maxWidth: 380,
  backgroundColor: 'rgba(30, 41, 59, 0.4)',
  backdropFilter: 'blur(16px)',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 16,
  boxShadow: theme.shadows[24],
}));

const LoginCardContent = styled(CardContent)(({ theme }) => ({
  padding: theme.spacing(4),
  '&:last-child': {
    paddingBottom: theme.spacing(4),
  },
}));

const IconWrapper = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  marginBottom: theme.spacing(2),
}));

const IconContainer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.warning.light,
  padding: theme.spacing(1.5),
  borderRadius: 8,
  border: '1px solid rgba(251, 146, 60, 0.2)',
}));

const LoginTitle = styled(Typography)({
  fontWeight: 'bold',
});

const LoginSubtitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(4),
}));

const LoginForm = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
}));

const FormLabelText = styled(Typography)(({ theme }) => ({
  fontWeight: 'bold',
  textTransform: 'uppercase',
  marginBottom: theme.spacing(1),
  display: 'block',
}));

const ConnectButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(1),
  paddingTop: theme.spacing(1.2),
  paddingBottom: theme.spacing(1.2),
  fontWeight: 'bold',
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  gap: theme.spacing(3),
  backgroundColor: 'transparent',
}));

const LoadingText = styled(Typography)({
  fontWeight: 500,
  letterSpacing: '0.02em',
});

const ExplorerContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
});

const Toolbar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5),
  backgroundColor: 'rgba(255,255,255,0.03)',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
}));

const ToolbarIconButton = styled(IconButton)({
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderRadius: 4,
});

const PathBar = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  paddingLeft: theme.spacing(1.5),
  paddingRight: theme.spacing(1.5),
  paddingTop: theme.spacing(0.8),
  paddingBottom: theme.spacing(0.8),
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.05)',
  fontFamily: 'monospace',
  color: theme.palette.info.main,
  overflow: 'hidden',
}));

const PathText = styled(Typography)({
  fontFamily: 'inherit',
  fontSize: '0.85rem',
});

const ToolbarButton = styled(Button)({
  textTransform: 'none',
});

const StyledAlert = styled(Alert)({
  borderRadius: 0,
  '& .MuiAlert-message': {
    width: '100%',
  },
});

const UploadProgressContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  backgroundColor: 'rgba(234, 88, 12, 0.1)',
  borderBottom: '1px solid rgba(234, 88, 12, 0.2)',
}));

const DownloadProgressContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  backgroundColor: 'rgba(56, 189, 248, 0.1)',
  borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
}));

const ProgressHeader = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$colorType',
})<{ $colorType?: 'warning' | 'info' }>(({ theme, $colorType }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  color: $colorType === 'warning' ? theme.palette.warning.main : theme.palette.info.main,
  marginBottom: theme.spacing(1),
  fontSize: '0.85rem',
}));

const ProgressLabelSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const ProgressActionsSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
}));

const TransferSpeedText = styled(Typography)({
  opacity: 0.8,
});

const CancelIconButton = styled(IconButton)({
  padding: 0,
});

const StyledTableContainer = styled(TableContainer)({
  flex: 1,
  overflowY: 'auto',
}) as typeof TableContainer;

const StyledTableRow = styled(TableRow)({
  cursor: 'pointer',
});

const UpFolderContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  color: theme.palette.warning.main,
  fontWeight: 500,
}));

const FileItemContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$isDir',
})<{ $isDir: boolean }>(({ theme, $isDir }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  color: $isDir ? theme.palette.warning.main : theme.palette.text.primary,
  fontWeight: $isDir ? 500 : 400,
}));

const FileNameText = styled(Typography)({
  maxWidth: 200,
  fontSize: '0.85rem',
});

const SecondaryTableCell = styled(TableCell)(({ theme }) => ({
  color: theme.palette.text.secondary,
}));

const MonospaceTableCell = styled(TableCell)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontFamily: 'monospace',
}));

const ActionIconButton = styled(IconButton)(({ theme }) => ({
  marginRight: theme.spacing(1),
}));

const EmptyTableCell = styled(TableCell)(({ theme }) => ({
  paddingTop: theme.spacing(6),
  paddingBottom: theme.spacing(6),
  color: theme.palette.text.secondary,
}));
