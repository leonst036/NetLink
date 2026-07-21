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
import GeminiLoader from '../../components/GeminiLoader';
import { useSftp } from './useSftp';
import { useSmb } from './useSmb';

interface FileAppProps {
  token: string;
  target: string;
  initialIp?: string;
}

export default function FileApp({ token, target, initialIp }: FileAppProps) {
  const theme = useTheme();
  const [selectedIp, setSelectedIp] = useState(initialIp || '');
  const [protocol, setProtocol] = useState<'sftp' | 'smb'>('sftp');
  const [shareName, setShareName] = useState('C$');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [savedLogins, setSavedLogins] = useState<any[]>([]);

  const sftp = useSftp(token, target);
  const smb = useSmb(token, target);
  const client = protocol === 'sftp' ? sftp : smb;

  const {
    status,
    statusMessage,
    appError,
    files,
    currentPath,
    history,
    uploadProgress,
    isUploading,
    isDownloading,
    transferSpeed,
    downloadProgress,
    downloadFileName,
    uploadFileName,
    setAppError,
    triggerDownload,
    startUpload,
    cancelUpload,
    cancelDownload,
    createFolder,
    deleteItem,
    navigateTo,
    goBack,
    refreshList
  } = client as any;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch('/api/server-logins', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.logins) {
          setSavedLogins(data.logins.filter((l: any) => l.type === 'sftp' || l.type === 'smb'));
        }
      })
      .catch(err => console.error('Failed to fetch logins', err));
  }, [token]);

  const applyLogin = (e: any) => {
    const login = savedLogins.find(l => l.id === e.target.value);
    if (login) {
      if (login.type === 'sftp' || login.type === 'smb') setProtocol(login.type);
      setSelectedIp(login.ip);
      setUsername(login.loginUsername);
      setPassword(login.password);
      if (login.share) setShareName(login.share);
    }
  };

  const handleCreateFolder = () => {
    const folderName = prompt('Enter new folder name:');
    if (folderName) {
      createFolder(folderName);
    }
  };

  const handleDeleteItem = (itemName: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete "${itemName}"?`);
    if (confirmDelete) {
      deleteItem(itemName);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      startUpload(file);
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'transparent' }}>
      {/* Login Screen */}
      {status === 'disconnected' && (
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, background: 'transparent' }}>
          <Card sx={{ width: '100%', maxWidth: 380, bgcolor: 'rgba(30, 41, 59, 0.4)', backdropFilter: 'blur(16px)', border: `1px solid ${theme.palette.divider}`, borderRadius: 4, boxShadow: 24 }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <Box sx={{ bgcolor: 'warning.light', p: 1.5, borderRadius: 2, border: '1px solid rgba(251, 146, 60, 0.2)' }}>
                  <Folder size={28} color={theme.palette.warning.main} />
                </Box>
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 'bold' }} align="center" gutterBottom>Network File Client</Typography>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 4 }}>Access remote files securely</Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {savedLogins.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase', mb: 1, display: 'block' }}>Saved Logins</Typography>
                    <Select fullWidth size="small" value="" displayEmpty onChange={applyLogin}>
                      <MenuItem value="" disabled>Select a saved server...</MenuItem>
                      {savedLogins.map(l => <MenuItem key={l.id} value={l.id}>{l.name} ({l.ip}) - {l.type.toUpperCase()}</MenuItem>)}
                    </Select>
                  </Box>
                )}

                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase', mb: 1, display: 'block' }}>Protocol</Typography>
                  <Select fullWidth size="small" value={protocol} onChange={e => setProtocol(e.target.value as 'sftp' | 'smb')}>
                    <MenuItem value="sftp">SFTP</MenuItem>
                    <MenuItem value="smb">SMB / CIFS</MenuItem>
                  </Select>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase', mb: 1, display: 'block' }}>Target IP / Hostname</Typography>
                  <TextField fullWidth size="small" placeholder="e.g. 192.168.1.10" value={selectedIp} onChange={e => setSelectedIp(e.target.value)} />
                </Box>

                {protocol === 'smb' && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase', mb: 1, display: 'block' }}>Share Name</Typography>
                    <TextField fullWidth size="small" placeholder="e.g. C$" value={shareName} onChange={e => setShareName(e.target.value)} />
                  </Box>
                )}

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
                  onClick={() => protocol === 'sftp' ? sftp.connectSftp(selectedIp, username, password) : smb.connectSmb(selectedIp, username, password, shareName)}
                  sx={{ mt: 1, py: 1.2, fontWeight: 'bold' }}
                >
                  Connect {protocol.toUpperCase()}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Connecting Loader */}
      {status === 'connecting' && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 3, bgcolor: 'transparent' }}>
          <GeminiLoader size={64} />
          <Typography color="text.secondary" sx={{ fontWeight: 500, letterSpacing: '0.02em' }}>{statusMessage}</Typography>
        </Box>
      )}

      {/* Main File Explorer View */}
      {status === 'connected' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Action Header / Breadcrumb */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
            <IconButton onClick={goBack} disabled={history.length === 0} sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
              <ArrowLeft size={16} />
            </IconButton>

            <IconButton onClick={refreshList} sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
              <RefreshCw size={16} />
            </IconButton>

            {/* Breadcrumb Path Bar */}
            <Box sx={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.8,
              bgcolor: 'rgba(0, 0, 0, 0.3)', borderRadius: 1, border: `1px solid rgba(255,255,255,0.05)`,
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
              onClick={() => protocol === 'sftp' ? sftp.disconnectSftp() : smb.disconnectSmb()}
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
                  <Typography variant="body2">Uploading {uploadFileName}...</Typography>
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
                  <Typography variant="body2">Downloading {downloadFileName}...</Typography>
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
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main', fontWeight: 500 }}>
                        <Folder size={16} /> ..
                      </Box>
                    </TableCell>
                    <TableCell>--</TableCell>
                    <TableCell>--</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}

                {files.map((file: any) => {
                  const isDir = protocol === 'sftp' ? file.type === 'd' : file.isFolder;
                  const perms = protocol === 'sftp' 
                    ? (file.rights ? `${file.type}${file.rights.user}${file.rights.group}${file.rights.other}` : '--')
                    : (file.accessRights ? `R:${file.accessRights.read ? 1 : 0} W:${file.accessRights.write ? 1 : 0}` : '--');

                  return (
                    <TableRow
                      key={file.name}
                      hover
                      onClick={() => (isDir || file.type === 'l' || file.isSymlink) ? navigateTo(`${currentPath === '/' ? '' : currentPath}/${file.name}`) : triggerDownload(file.name, file.size)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: isDir ? 'warning.main' : 'text.primary', fontWeight: isDir ? 500 : 400 }}>
                          {isDir ? <Folder size={16} /> : <File size={16} color="#94a3b8" />}
                          <Typography noWrap sx={{ maxWidth: 200, fontSize: '0.85rem' }}>{file.name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>
                        {isDir ? '--' : formatSize(file.size)}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                        {perms}
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