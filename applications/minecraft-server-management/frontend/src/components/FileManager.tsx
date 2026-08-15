import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Breadcrumbs,
  Link,
  CircularProgress,
  Tooltip,
  Alert,
  Card,
  CardContent,
  keyframes,
} from '@mui/material';
import {
  Folder,
  FileCode,
  File,
  Trash2,
  Edit3,
  RefreshCw,
  FolderPlus,
  FilePlus,
  ChevronRight,
  HardDrive,
} from 'lucide-react';
import { NodeInfo, FileItem } from '../types';
import {
  getNodeServerFiles,
  getNodeServerFileContent,
  saveNodeServerFile,
  deleteNodeServerFile,
  createNodeServerFolder,
} from '../api';
import { FileEditorModal } from './FileEditorModal';

const spinAnimation = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

interface FileManagerProps {
  node: NodeInfo;
  serverId: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isEditableFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const editableExtensions = [
    'txt',
    'properties',
    'json',
    'yml',
    'yaml',
    'cfg',
    'conf',
    'sh',
    'env',
    'log',
    'toml',
    'xml',
    'md',
  ];
  return editableExtensions.includes(ext);
}

export const FileManager: React.FC<FileManagerProps> = ({ node, serverId }) => {
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filesRef = useRef<FileItem[]>([]);
  filesRef.current = files;

  // File Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingFilePath, setEditingFilePath] = useState('');
  const [editingFileName, setEditingFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [editorLoading, setEditorLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // New item modal
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);

  // Load files quietly without unmounting table
  const loadFiles = useCallback(
    async (path = currentPath, isManualRefresh = false) => {
      if (filesRef.current.length === 0 && !isManualRefresh) {
        setLoading(true);
      }
      if (isManualRefresh) {
        setRefreshing(true);
      }
      setError(null);
      try {
        const res = await getNodeServerFiles(node, serverId, path);
        setFiles((prev) => {
          const next = res.files || [];
          if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
          return next;
        });
        setCurrentPath(res.currentPath ?? path);
      } catch (err: any) {
        setError(err.message || 'Failed to load directory contents.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [node.id, serverId, currentPath]
  );

  useEffect(() => {
    loadFiles(currentPath);
  }, [currentPath, node.id, serverId]);

  // Navigate folder
  const handleFolderClick = (folderPath: string) => {
    setFiles([]);
    setCurrentPath(folderPath);
  };

  // Open file in editor
  const handleOpenFile = async (file: FileItem) => {
    if (!isEditableFile(file.name)) return;
    setEditingFilePath(file.path);
    setEditingFileName(file.name);
    setEditorOpen(true);
    setEditorLoading(true);
    try {
      const content = await getNodeServerFileContent(node, serverId, file.path);
      setFileContent(content);
    } catch (err: any) {
      setError(err.message || 'Failed to read file content.');
      setEditorOpen(false);
    } finally {
      setEditorLoading(false);
    }
  };

  // Save file content
  const handleSaveFile = async () => {
    setSaveLoading(true);
    try {
      const res = await saveNodeServerFile(node, serverId, editingFilePath, fileContent);
      if (res.success) {
        setEditorOpen(false);
        loadFiles(currentPath, true);
      } else {
        setError(res.error || 'Failed to save file.');
      }
    } catch (err: any) {
      setError(err.message || 'Save error.');
    } finally {
      setSaveLoading(false);
    }
  };

  // Create folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const targetPath = currentPath ? `${currentPath}/${newFolderName.trim()}` : newFolderName.trim();
    try {
      await createNodeServerFolder(node, serverId, targetPath);
      setNewFolderOpen(false);
      setNewFolderName('');
      loadFiles(currentPath, true);
    } catch (err: any) {
      setError(err.message || 'Failed to create folder.');
    }
  };

  // Create new file
  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const targetPath = currentPath ? `${currentPath}/${newFileName.trim()}` : newFileName.trim();
    try {
      await saveNodeServerFile(node, serverId, targetPath, '');
      setNewFileOpen(false);
      setNewFileName('');
      loadFiles(currentPath, true);
      setEditingFilePath(targetPath);
      setEditingFileName(newFileName.trim());
      setFileContent('');
      setEditorOpen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to create file.');
    }
  };

  // Delete file or folder
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteNodeServerFile(node, serverId, deleteTarget.path);
      setDeleteTarget(null);
      loadFiles(currentPath, true);
    } catch (err: any) {
      setError(err.message || 'Failed to delete.');
    }
  };

  const pathSegments = currentPath ? currentPath.split('/').filter(Boolean) : [];

  return (
    <Box>
      <Card
        sx={{
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 3,
        }}
      >
        <CardContent sx={{ p: 3 }}>
          {error && (
            <Alert
              severity="error"
              onClose={() => setError(null)}
              sx={{ mb: 2, backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5' }}
            >
              {error}
            </Alert>
          )}

          {/* Navigation & Action Bar */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={2}
            mb={2.5}
          >
            {/* Breadcrumb Navigation */}
            <Breadcrumbs
              separator={<ChevronRight size={14} color="#64748b" />}
              sx={{
                '& .MuiBreadcrumbs-ol': { alignItems: 'center' },
                color: '#94a3b8',
              }}
            >
              <Link
                component="button"
                underline="hover"
                onClick={() => {
                  setFiles([]);
                  setCurrentPath('');
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: currentPath === '' ? '#34d399' : '#94a3b8',
                  fontWeight: currentPath === '' ? 700 : 500,
                  fontSize: '0.9rem',
                }}
              >
                <HardDrive size={16} />
                root
              </Link>
              {pathSegments.map((segment, index) => {
                const segPath = pathSegments.slice(0, index + 1).join('/');
                const isLast = index === pathSegments.length - 1;
                return (
                  <Link
                    key={segPath}
                    component="button"
                    underline="hover"
                    onClick={() => {
                      setFiles([]);
                      setCurrentPath(segPath);
                    }}
                    sx={{
                      color: isLast ? '#34d399' : '#94a3b8',
                      fontWeight: isLast ? 700 : 500,
                      fontSize: '0.9rem',
                    }}
                  >
                    {segment}
                  </Link>
                );
              })}
            </Breadcrumbs>

            {/* Action Buttons */}
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => loadFiles(currentPath, true)}
                startIcon={
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      animation: refreshing ? `${spinAnimation} 0.8s linear infinite` : 'none',
                    }}
                  >
                    <RefreshCw size={14} />
                  </Box>
                }
                sx={{
                  color: '#94a3b8',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  '&:hover': {
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  },
                }}
              >
                Refresh
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FolderPlus size={14} />}
                onClick={() => setNewFolderOpen(true)}
                sx={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.3)' }}
              >
                New Folder
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<FilePlus size={14} />}
                onClick={() => setNewFileOpen(true)}
                sx={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  '&:hover': { backgroundColor: '#059669' },
                }}
              >
                New File
              </Button>
            </Stack>
          </Stack>

          {/* Files Table */}
          <TableContainer
            component={Paper}
            sx={{
              backgroundColor: 'rgba(3, 7, 18, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: 2,
              minHeight: 280,
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <TableCell sx={{ color: '#94a3b8', fontWeight: 600, py: 1.5 }}>Name</TableCell>
                  <TableCell sx={{ color: '#94a3b8', fontWeight: 600, width: 110 }}>Size</TableCell>
                  <TableCell sx={{ color: '#94a3b8', fontWeight: 600, width: 140 }}>Modified</TableCell>
                  <TableCell align="right" sx={{ color: '#94a3b8', fontWeight: 600, width: 100 }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={24} sx={{ color: '#10b981' }} />
                    </TableCell>
                  </TableRow>
                ) : files.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 5, color: '#64748b' }}>
                      This folder is empty.
                    </TableCell>
                  </TableRow>
                ) : (
                  files.map((file) => {
                    const editable = !file.isDirectory && isEditableFile(file.name);
                    return (
                      <TableRow
                        key={file.path}
                        hover
                        sx={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.03)' },
                        }}
                      >
                        {/* Name & Icon */}
                        <TableCell sx={{ color: '#f8fafc', py: 1.2 }}>
                          <Stack
                            direction="row"
                            spacing={1.5}
                            alignItems="center"
                            component="span"
                            onClick={() => {
                              if (file.isDirectory) handleFolderClick(file.path);
                              else if (editable) handleOpenFile(file);
                            }}
                            sx={{
                              cursor: file.isDirectory || editable ? 'pointer' : 'default',
                              '&:hover': { color: '#34d399' },
                            }}
                          >
                            {file.isDirectory ? (
                              <Folder size={18} color="#fbbf24" />
                            ) : editable ? (
                              <FileCode size={18} color="#38bdf8" />
                            ) : (
                              <File size={18} color="#94a3b8" />
                            )}
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: file.isDirectory ? 600 : 400,
                                fontFamily: 'monospace',
                                color: 'inherit',
                              }}
                            >
                              {file.name}
                            </Typography>
                          </Stack>
                        </TableCell>

                        {/* Size */}
                        <TableCell sx={{ color: '#94a3b8', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                          {file.isDirectory ? '-' : formatBytes(file.size)}
                        </TableCell>

                        {/* Modified Time */}
                        <TableCell sx={{ color: '#64748b', fontSize: '0.8rem' }}>
                          {formatDate(file.modifiedTime)}
                        </TableCell>

                        {/* Actions */}
                        <TableCell align="right" sx={{ py: 0.5 }}>
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            {editable && (
                              <Tooltip title="Edit File">
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenFile(file)}
                                  sx={{ color: '#38bdf8' }}
                                >
                                  <Edit3 size={15} />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                onClick={() => setDeleteTarget(file)}
                                sx={{ color: '#f87171' }}
                              >
                                <Trash2 size={15} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Extracted In-App File Editor Modal */}
      <FileEditorModal
        open={editorOpen}
        fileName={editingFileName}
        filePath={editingFilePath}
        content={fileContent}
        loading={editorLoading}
        saving={saveLoading}
        onChangeContent={setFileContent}
        onSave={handleSaveFile}
        onClose={() => setEditorOpen(false)}
      />

      {/* New Folder Modal */}
      <Dialog
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ p: 2.5, pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            New Directory
          </Typography>
        </DialogTitle>
        <Box component="form" onSubmit={handleCreateFolder}>
          <DialogContent sx={{ p: 2.5 }}>
            <TextField
              required
              fullWidth
              autoFocus
              size="small"
              label="Folder Name"
              placeholder="plugins"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2.5, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <Button onClick={() => setNewFolderOpen(false)} sx={{ color: '#94a3b8' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!newFolderName.trim()}
              sx={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                '&:hover': { backgroundColor: '#059669' },
              }}
            >
              Create Folder
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* New File Modal */}
      <Dialog
        open={newFileOpen}
        onClose={() => setNewFileOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ p: 2.5, pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            New File
          </Typography>
        </DialogTitle>
        <Box component="form" onSubmit={handleCreateFile}>
          <DialogContent sx={{ p: 2.5 }}>
            <TextField
              required
              fullWidth
              autoFocus
              size="small"
              label="File Name"
              placeholder="whitelist.json"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2.5, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <Button onClick={() => setNewFileOpen(false)} sx={{ color: '#94a3b8' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!newFileName.trim()}
              sx={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                '&:hover': { backgroundColor: '#059669' },
              }}
            >
              Create & Edit
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ p: 2.5, pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#f87171' }}>
            Confirm Deletion
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 2.5 }}>
          <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
            Are you sure you want to permanently delete{' '}
            <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong>?
          </Typography>
          {deleteTarget?.isDirectory && (
            <Typography variant="caption" sx={{ color: '#fbbf24', display: 'block', mt: 1 }}>
              Warning: All contents inside this directory will be removed!
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: '#94a3b8' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDelete}
            sx={{
              backgroundColor: '#ef4444',
              color: '#ffffff',
              '&:hover': { backgroundColor: '#dc2626' },
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
