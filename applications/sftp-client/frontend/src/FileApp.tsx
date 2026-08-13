import { useState, useEffect, useRef } from 'react';
import { Folder, File, ArrowLeft, RefreshCw, HardDrive, ShieldAlert, Upload, Download, Trash2, FolderPlus, X } from 'lucide-react';
import {
  Box,
  Typography,
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
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import './FileApp.css';
import { GeminiLoader } from '@netlink/ui';
import SftpLogin from './SftpLogin';
import SmbLogin from './SmbLogin';

interface FileAppProps {
  ticket: string;
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

export default function FileApp({ ticket, target, initialIp }: FileAppProps) {
  const theme = useTheme();
  const [protocolType, setProtocolType] = useState<'sftp' | 'smb'>('sftp');
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

  const [folderDialog, setFolderDialog] = useState<{ open: boolean, defaultName: string }>({ open: false, defaultName: '' });
  const [folderName, setFolderName] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean, itemName: string }>({ open: false, itemName: '' });

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

  const handleCreateFolderClick = () => {
    setFolderName('New Folder');
    setFolderDialog({ open: true, defaultName: 'New Folder' });
  };

  const confirmCreateFolder = () => {
    if (folderName && socketRef.current?.readyState === WebSocket.OPEN) {
      const targetPath = normalizePath(currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`);
      socketRef.current.send(JSON.stringify({ type: 'mkdir', path: targetPath }));
    }
    setFolderDialog({ open: false, defaultName: '' });
  };

  const handleDeleteItemClick = (itemName: string) => {
    setDeleteDialog({ open: true, itemName });
  };

  const confirmDeleteItem = () => {
    const itemName = deleteDialog.itemName;
    if (itemName && socketRef.current?.readyState === WebSocket.OPEN) {
      const targetPath = normalizePath(currentPath === '/' ? `/${itemName}` : `${currentPath}/${itemName}`);
      socketRef.current.send(JSON.stringify({ type: 'delete', path: targetPath }));
    }
    setDeleteDialog({ open: false, itemName: '' });
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
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;
      const base64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
      socketRef.current?.send(JSON.stringify({ type: 'uploadChunk', data: base64 }));
      uploadOffsetRef.current += slice.size;
    };
    reader.readAsDataURL(slice);
  };

  const handleConnect = (params: any) => {
    if (!ticket) return;
    if (socketRef.current) socketRef.current.close();

    setStatus('connecting');
    setStatusMessage('Connecting to Relay Server...');

    const isSecure = window.location.protocol === 'https:';
    const protocol = isSecure ? 'wss:' : 'ws:';
    let host = window.location.host;
    if (host.includes('localhost:5173')) host = import.meta.env.VITE_RELAY_HOST || 'localhost:4535'; // Dev mode fallback

    const socketUrl = `${protocol}//${host}/client?ticket=${encodeURIComponent(ticket)}&target=${encodeURIComponent(target)}`;
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
          setStatusMessage(`Sending ${params.type === 'connect_smb' ? 'SMB' : 'SFTP'} credentials...`);
          socket.send(JSON.stringify(params));
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
    fetch('/api/server-logins', { headers: { 'Authorization': `Ticket ${ticket}` } })
      .then(res => res.json())
      .then(data => {
        if (data.logins) {
          setSavedLogins(data.logins.filter((l: any) => l.type === 'sftp' || l.type === 'smb'));
        }
      })
      .catch(err => console.error('Failed to fetch logins', err));
  }, [ticket]);


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

              <LoginTitle variant="h6" align="center" gutterBottom>File Explorer</LoginTitle>
              <LoginSubtitle variant="body2" color="text.secondary" align="center">Access remote files via SFTP or SMB</LoginSubtitle>

              <LoginForm>
                <Box>
                  <FormLabelText variant="caption" color="text.secondary">Protocol</FormLabelText>
                  <Select
                    fullWidth
                    size="small"
                    value={protocolType}
                    onChange={e => setProtocolType(e.target.value as 'sftp' | 'smb')}
                    className="fileapp-input"
                  >
                    <MenuItem value="sftp">SFTP (SSH File Transfer)</MenuItem>
                    <MenuItem value="smb">SMB / CIFS (Windows Share)</MenuItem>
                  </Select>
                </Box>

                {protocolType === 'sftp' ? (
                  <SftpLogin initialIp={initialIp} savedLogins={savedLogins} onConnect={handleConnect} />
                ) : (
                  <SmbLogin initialIp={initialIp} savedLogins={savedLogins} onConnect={handleConnect} />
                )}

                {statusMessage && (
                  <Alert severity="error" icon={<ShieldAlert size={16} />}>{statusMessage}</Alert>
                )}
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
              <Typography variant="caption" sx={{ px: 0.8, py: 0.2, borderRadius: 0.5, backgroundColor: 'rgba(251, 146, 60, 0.2)', color: '#fb923c', fontWeight: 'bold', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                {protocolType}
              </Typography>
              <PathText noWrap>{currentPath}</PathText>
            </PathBar>

            <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} disabled={isUploading} />

            <ToolbarButton
              variant="outlined"
              className="new-folder"
              onClick={handleCreateFolderClick}
              startIcon={<FolderPlus size={14} />}
            >
              New Folder
            </ToolbarButton>
            <ToolbarButton
              variant="outlined"
              className="upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              startIcon={<Upload size={14} />}
            >
              {isUploading ? `Uploading ${uploadProgress}%` : 'Upload'}
            </ToolbarButton>

            <ToolbarButton
              variant="outlined"
              className="disconnect"
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
              <LinearProgress variant="determinate" value={uploadProgress} className="upload-progress" />
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
              <LinearProgress variant={downloadProgress !== null ? "determinate" : "indeterminate"} value={downloadProgress || 0} className="download-progress" />
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
                            onClick={(e: any) => { e.stopPropagation(); triggerDownload(file.name, file.size); }}
                          >
                            <Download size={14} />
                          </ActionIconButton>
                        )}
                        <ActionIconButton
                          size="small"
                          className="delete"
                          onClick={(e: any) => { e.stopPropagation(); handleDeleteItemClick(file.name); }}
                        >
                          <Trash2 size={14} />
                        </ActionIconButton>
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

      {/* Folder Dialog */}
      <Dialog classes={{ paper: 'fileapp-dialog-paper' }} open={folderDialog.open} onClose={() => setFolderDialog({ open: false, defaultName: '' })}>
        <DialogTitle className="fileapp-dialog-title">Create New Folder</DialogTitle>
        <DialogContent className="fileapp-dialog-content">
          <TextField
            autoFocus
            margin="dense"
            label="Folder Name"
            type="text"
            fullWidth
            variant="standard"
            className="fileapp-input"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmCreateFolder()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFolderDialog({ open: false, defaultName: '' })} sx={{ color: 'rgba(255,255,255,0.7)' }}>Cancel</Button>
          <Button onClick={confirmCreateFolder} variant="contained" sx={{ bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog classes={{ paper: 'fileapp-dialog-paper' }} open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, itemName: '' })}>
        <DialogTitle className="fileapp-dialog-title">Delete Item</DialogTitle>
        <DialogContent className="fileapp-dialog-content">
          <Typography>Are you sure you want to delete "{deleteDialog.itemName}"?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, itemName: '' })} sx={{ color: 'rgba(255,255,255,0.7)' }}>Cancel</Button>
          <Button onClick={confirmDeleteItem} variant="contained" sx={{ bgcolor: '#f43f5e', '&:hover': { bgcolor: '#e11d48' } }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </RootContainer>
  );
}

// Styled Components Wrappers
const RootContainer = (props: any) => <Box className="fileapp-root-container" {...props} />;
const LoginContainer = (props: any) => <Box className="fileapp-login-container" {...props} />;
const LoginCard = (props: any) => <Card className="fileapp-login-card" {...props} />;
const LoginCardContent = (props: any) => <CardContent className="fileapp-login-card-content" {...props} />;
const IconWrapper = (props: any) => <Box className="fileapp-icon-wrapper" {...props} />;
const IconContainer = (props: any) => <Box className="fileapp-icon-container" {...props} />;
const LoginTitle = (props: any) => <Typography className="fileapp-login-title" {...props} />;
const LoginSubtitle = (props: any) => <Typography className="fileapp-login-subtitle" {...props} />;
const LoginForm = (props: any) => <Box className="fileapp-login-form" {...props} />;
const FormLabelText = (props: any) => <Typography className="fileapp-form-label-text" {...props} />;
const LoadingContainer = (props: any) => <Box className="fileapp-loading-container" {...props} />;
const LoadingText = (props: any) => <Typography className="fileapp-loading-text" {...props} />;
const ExplorerContainer = (props: any) => <Box className="fileapp-explorer-container" {...props} />;
const Toolbar = (props: any) => <Box className="fileapp-toolbar" {...props} />;
const ToolbarIconButton = (props: any) => <IconButton className="fileapp-toolbar-icon-button" {...props} />;
const PathBar = (props: any) => <Box className="fileapp-path-bar" {...props} />;
const PathText = (props: any) => <Typography className="fileapp-path-text" {...props} />;
const ToolbarButton = (props: any) => <Button className="fileapp-toolbar-button" {...props} />;
const StyledAlert = (props: any) => <Alert className="fileapp-styled-alert" {...props} />;
const UploadProgressContainer = (props: any) => <Box className="fileapp-upload-progress-container" {...props} />;
const DownloadProgressContainer = (props: any) => <Box className="fileapp-download-progress-container" {...props} />;
const ProgressHeader = ({ $colorType, ...props }: any) => {
  return <Box className="fileapp-progress-header" sx={{ color: $colorType === 'warning' ? 'warning.main' : 'info.main' }} {...props} />;
};
const ProgressLabelSection = (props: any) => <Box className="fileapp-progress-label-section" {...props} />;
const ProgressActionsSection = (props: any) => <Box className="fileapp-progress-actions-section" {...props} />;
const TransferSpeedText = (props: any) => <Typography className="fileapp-transfer-speed-text" {...props} />;
const CancelIconButton = (props: any) => <IconButton className="fileapp-cancel-icon-button" {...props} />;
const StyledTableContainer = (props: any) => <TableContainer className="fileapp-styled-table-container" {...props} />;
const StyledTableRow = (props: any) => <TableRow className="fileapp-styled-table-row" {...props} />;
const UpFolderContainer = (props: any) => {
  return <Box className="fileapp-up-folder-container" sx={{ color: 'warning.main' }} {...props} />;
};
const FileItemContainer = ({ $isDir, ...props }: any) => {
  return <Box className="fileapp-file-item-container" sx={{ color: $isDir ? 'warning.main' : 'text.primary', fontWeight: $isDir ? 500 : 400 }} {...props} />;
};
const FileNameText = (props: any) => <Typography className="fileapp-file-name-text" {...props} />;
const SecondaryTableCell = (props: any) => {
  return <TableCell className="fileapp-secondary-table-cell" sx={{ color: 'text.secondary' }} {...props} />;
};
const MonospaceTableCell = (props: any) => {
  return <TableCell className="fileapp-monospace-table-cell" sx={{ color: 'text.secondary' }} {...props} />;
};
const ActionIconButton = (props: any) => <IconButton className="fileapp-action-icon-button" {...props} />;
const EmptyTableCell = (props: any) => {
  return <TableCell className="fileapp-empty-table-cell" sx={{ color: 'text.secondary' }} {...props} />;
};
