import { useState, useEffect } from 'react';
import {
  User,
  Users,
  Monitor,
  Shield,
  Key,
  Plus,
  Trash2,
  Edit2,
  Save,
  Server
} from 'lucide-react';
import {
  Box,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  TextField,
  Select,
  MenuItem,
  Switch,
  Button,
  IconButton,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid
} from '@mui/material';
import './SettingsApp.css';

type TabId = 'general' | 'appearance' | 'logins' | 'security' | 'users';

interface SettingsAppProps {
  ticket: string;
}

export default function SettingsApp({ ticket }: SettingsAppProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');

  // Load functional settings from localStorage
  const [username, setUsername] = useState(() => localStorage.getItem('netlink_username') || 'Admin');
  const [wallpaper, setWallpaper] = useState(() => localStorage.getItem('netlink_wallpaper') || 'default');
  const [appTheme, setAppTheme] = useState(() => localStorage.getItem('netlink_theme') || 'Dark');
  const [windowAnimations, setWindowAnimations] = useState(() => localStorage.getItem('netlink_animations') !== 'false');
  const [notificationSounds, setNotificationSounds] = useState(() => localStorage.getItem('netlink_sounds') === 'true');
  const [debugMode, setDebugMode] = useState(() => localStorage.getItem('netlink_debug') === 'true');

  const updateSetting = (key: string, value: string, setter: (val: string) => void) => {
    setter(value);
    localStorage.setItem(key, value);
    window.dispatchEvent(new Event('settingsChange'));
    try {
      window.parent.postMessage({ type: 'netlink_setting_changed', key, value }, '*');
    } catch {
      // Ignore cross-origin error
    }
  };

  const getPermissions = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role');
    if (role === 'admin') return ['manage_users', 'manage_logins', 'access_terminal', 'access_vnc', 'access_sftp', 'scan_network'];
    const perms = urlParams.get('permissions');
    return perms ? perms.split(',') : [];
  };

  const permissions = getPermissions();
  const canManageUsers = permissions.includes('manage_users');

  const tabs = [
    { id: 'general', label: 'General', icon: <User size={19} /> },
    { id: 'appearance', label: 'Appearance', icon: <Monitor size={19} /> },
    { id: 'logins', label: 'Server Logins', icon: <Key size={19} /> },
    { id: 'security', label: 'Security', icon: <Shield size={19} /> },
  ];

  if (canManageUsers) {
    tabs.splice(3, 0, { id: 'users', label: 'User Management', icon: <Users size={19} /> });
  }

  const [logins, setLogins] = useState<any[]>([]);
  const [editingLogin, setEditingLogin] = useState<any | null>(null);

  const [usersList, setUsersList] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  const [deleteUserDialog, setDeleteUserDialog] = useState<{ open: boolean, username: string }>({ open: false, username: '' });
  const [deleteLoginDialog, setDeleteLoginDialog] = useState<{ open: boolean, id: string }>({ open: false, id: '' });

  useEffect(() => {
    if (activeTab === 'logins') {
      fetchLogins();
    } else if (activeTab === 'users' && canManageUsers) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Ticket ${ticket}` }
      });
      const data = await res.json();
      if (data.users) setUsersList(data.users);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const saveUser = async () => {
    if (!editingUser) return;
    try {
      const isNew = !usersList.find(u => u.username === editingUser.username);
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch('/api/users', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Ticket ${ticket}`
        },
        body: JSON.stringify(editingUser)
      });
      if (res.ok) {
        setEditingUser(null);
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to save user', err);
    }
  };

  const handleDeleteUserClick = (username: string) => {
    setDeleteUserDialog({ open: true, username });
  };

  const confirmDeleteUser = async () => {
    const username = deleteUserDialog.username;
    try {
      const res = await fetch(`/api/users?username=${encodeURIComponent(username)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Ticket ${ticket}` }
      });
      if (res.ok) {
        await fetchUsers();
      }
    } catch (err) {
      console.error('Failed to delete user', err);
    }
    setDeleteUserDialog({ open: false, username: '' });
  };

  const togglePermission = (perm: string) => {
    if (!editingUser) return;
    const current = editingUser.permissions || [];
    if (current.includes(perm)) {
      setEditingUser({ ...editingUser, permissions: current.filter((p: string) => p !== perm) });
    } else {
      setEditingUser({ ...editingUser, permissions: [...current, perm] });
    }
  };

  const ALL_PERMISSIONS = [
    { id: 'manage_users', label: 'Manage Users', desc: 'Create, edit, and delete system user accounts' },
    { id: 'manage_logins', label: 'Manage Server Logins', desc: 'Add and configure remote server credentials' },
    { id: 'access_terminal', label: 'Access SSH Terminal', desc: 'Launch interactive SSH terminal sessions' },
    { id: 'access_vnc', label: 'Access VNC Desktop', desc: 'Connect to remote VNC graphical desktops' },
    { id: 'access_sftp', label: 'Access SFTP File Explorer', desc: 'Browse and transfer remote files' },
    { id: 'scan_network', label: 'Scan Network', desc: 'Perform automatic subnet and topology scans' }
  ];

  const fetchLogins = async () => {
    try {
      const res = await fetch('/api/server-logins', {
        headers: { 'Authorization': `Ticket ${ticket}` }
      });
      const data = await res.json();
      if (data.logins) {
        setLogins(data.logins);
      }
    } catch (err) {
      console.error('Failed to fetch logins', err);
    }
  };

  const handleProtocolChange = (type: string) => {
    if (!editingLogin) return;
    let defaultPort = '22';
    if (type === 'vnc') defaultPort = '5900';
    if (type === 'smb') defaultPort = '445';
    setEditingLogin({
      ...editingLogin,
      type,
      port: defaultPort
    });
  };

  const saveLogin = async () => {
    if (!editingLogin) return;
    try {
      const res = await fetch('/api/server-logins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Ticket ${ticket}`
        },
        body: JSON.stringify(editingLogin)
      });
      if (res.ok) {
        setEditingLogin(null);
        await fetchLogins();
      }
    } catch (err) {
      console.error('Failed to save login', err);
    }
  };

  const handleDeleteLoginClick = (id: string) => {
    setDeleteLoginDialog({ open: true, id });
  };

  const confirmDeleteLogin = async () => {
    const id = deleteLoginDialog.id;
    try {
      const res = await fetch(`/api/server-logins?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Ticket ${ticket}` }
      });
      if (res.ok) {
        await fetchLogins();
      }
    } catch (err) {
      console.error('Failed to delete login', err);
    }
    setDeleteLoginDialog({ open: false, id: '' });
  };

  const getProtocolChip = (type: string) => {
    const upper = (type || 'ssh').toUpperCase();
    let color: 'primary' | 'secondary' | 'success' | 'warning' = 'primary';
    if (upper === 'VNC') color = 'secondary';
    if (upper === 'SFTP') color = 'success';
    if (upper === 'SMB') color = 'warning';

    return <Chip label={upper} color={color} size="small" className="styled-chip" variant="outlined" />;
  };

  return (
    <RootContainer>
      {/* Sidebar */}
      <SidebarPaper elevation={0}>
        <SidebarHeader>
          <Typography variant="h6" className="sidebar-title">Settings</Typography>
        </SidebarHeader>
        <SidebarList>
          {tabs.map(tab => (
            <TabListItem disablePadding key={tab.id}>
              <TabButton
                selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id as TabId)}
              >
                <TabIcon $active={activeTab === tab.id}>
                  {tab.icon}
                </TabIcon>
                <ListItemText
                  primary={
                    <TabText $active={activeTab === tab.id}>
                      {tab.label}
                    </TabText>
                  }
                />
              </TabButton>
            </TabListItem>
          ))}
        </SidebarList>
      </SidebarPaper>

      {/* Main Content Area */}
      <MainContentContainer>
        <ContentMaxWidth>
          {/* General Tab */}
          {activeTab === 'general' && (
            <Box>
              <Typography variant="h5" className="section-title">General Settings</Typography>

              <StyledCard variant="outlined" $mb>
                <StyledCardContent>
                  <Typography variant="subtitle2" className="card-subtitle">User Profile</Typography>
                  <VerticalStack>
                    <FlexRowSpaceBetween>
                      <Box>
                        <Typography sx={{ fontWeight: 500 }}>Display Name</Typography>
                        <Typography variant="body2" color="text.secondary">Name shown across the desktop workspace</Typography>
                      </Box>
                      <StyledTextField
                        size="small"
                        value={username}
                        onChange={(e: any) => updateSetting('netlink_username', e.target.value, setUsername)}
                      />
                    </FlexRowSpaceBetween>
                    <FlexRowSpaceBetween>
                      <Box>
                        <Typography sx={{ fontWeight: 500 }}>Language</Typography>
                        <Typography variant="body2" color="text.secondary">Default system and app language</Typography>
                      </Box>
                      <StyledSelect size="small" defaultValue="en">
                        <MenuItem value="en">English (US)</MenuItem>
                        <MenuItem value="de">Deutsch (DE)</MenuItem>
                        <MenuItem value="fr">Français (FR)</MenuItem>
                        <MenuItem value="es">Español (ES)</MenuItem>
                      </StyledSelect>
                    </FlexRowSpaceBetween>
                  </VerticalStack>
                </StyledCardContent>
              </StyledCard>

              <StyledCard variant="outlined">
                <StyledCardContent>
                  <Typography variant="subtitle2" className="card-subtitle">Desktop Experience</Typography>
                  <StyledFormGroup>
                    <FlexRowSpaceBetween>
                      <Box>
                        <Typography sx={{ fontWeight: 500 }}>Window Animations</Typography>
                        <Typography variant="body2" color="text.secondary">Smooth open, minimize, and restore transitions</Typography>
                      </Box>
                      <Switch
                        checked={windowAnimations}
                        onChange={(_e, checked) => updateSetting('netlink_animations', checked.toString(), () => setWindowAnimations(checked))}
                      />
                    </FlexRowSpaceBetween>
                    <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />
                    <FlexRowSpaceBetween>
                      <Box>
                        <Typography sx={{ fontWeight: 500 }}>Notification Sounds</Typography>
                        <Typography variant="body2" color="text.secondary">Audio feedback for system events</Typography>
                      </Box>
                      <Switch
                        checked={notificationSounds}
                        onChange={(_e, checked) => updateSetting('netlink_sounds', checked.toString(), () => setNotificationSounds(checked))}
                      />
                    </FlexRowSpaceBetween>
                    <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />
                    <FlexRowSpaceBetween>
                      <Box>
                        <Typography sx={{ fontWeight: 500 }}>Debug Overlay & Diagnostic Logs</Typography>
                        <Typography variant="body2" color="text.secondary">Display live VNC FPS, latency metrics, and relay logs</Typography>
                      </Box>
                      <Switch
                        checked={debugMode}
                        onChange={(_e, checked) => updateSetting('netlink_debug', checked.toString(), () => setDebugMode(checked))}
                      />
                    </FlexRowSpaceBetween>
                  </StyledFormGroup>
                </StyledCardContent>
              </StyledCard>
            </Box>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <Box>
              <Typography variant="h5" className="section-title">Appearance & Themes</Typography>

              <StyledCard variant="outlined" $mb>
                <StyledCardContent>
                  <Typography variant="subtitle2" className="card-subtitle">Theme Mode</Typography>
                  <FlexRowGap2>
                    <ThemeCard
                      name="Dark Nebula"
                      active={appTheme === 'Dark'}
                      color="#0b0f19"
                      accent="#38bdf8"
                      onClick={() => updateSetting('netlink_theme', 'Dark', setAppTheme)}
                    />
                    <ThemeCard
                      name="Midnight Blue"
                      active={appTheme === 'Midnight'}
                      color="#0f172a"
                      accent="#818cf8"
                      onClick={() => updateSetting('netlink_theme', 'Midnight', setAppTheme)}
                    />
                    <ThemeCard
                      name="Cyber Neon"
                      active={appTheme === 'Cyber'}
                      color="#180c2e"
                      accent="#ec4899"
                      onClick={() => updateSetting('netlink_theme', 'Cyber', setAppTheme)}
                    />
                  </FlexRowGap2>
                </StyledCardContent>
              </StyledCard>

              <StyledCard variant="outlined" $mb>
                <StyledCardContent>
                  <Typography variant="subtitle2" className="card-subtitle">Desktop Wallpaper</Typography>
                  <WallpaperContainer>
                    <WallpaperThumb
                      $active={wallpaper === 'default'}
                      $bg='url("/login-bg.png") center/cover'
                      onClick={() => updateSetting('netlink_wallpaper', 'default', setWallpaper)}
                    />
                    <WallpaperThumb
                      $active={wallpaper === 'wp1'}
                      $bg='linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)'
                      onClick={() => updateSetting('netlink_wallpaper', 'wp1', setWallpaper)}
                    />
                    <WallpaperThumb
                      $active={wallpaper === 'wp2'}
                      $bg='linear-gradient(135deg, #4c1d95 0%, #0f172a 100%)'
                      onClick={() => updateSetting('netlink_wallpaper', 'wp2', setWallpaper)}
                    />
                    <WallpaperThumb
                      $active={wallpaper === 'wp3'}
                      $bg='linear-gradient(135deg, #064e3b 0%, #0f172a 100%)'
                      onClick={() => updateSetting('netlink_wallpaper', 'wp3', setWallpaper)}
                    />
                    <SolidWallpaperButton
                      onClick={() => updateSetting('netlink_wallpaper', 'solid', setWallpaper)}
                      $active={wallpaper === 'solid'}
                    >
                      Solid Charcoal
                    </SolidWallpaperButton>
                  </WallpaperContainer>
                </StyledCardContent>
              </StyledCard>

              <StyledCard variant="outlined">
                <StyledCardContent>
                  <Typography variant="subtitle2" className="card-subtitle">Display Scale</Typography>
                  <FlexRowSpaceBetween>
                    <Box>
                      <Typography sx={{ fontWeight: 500 }}>Interface Scaling</Typography>
                      <Typography variant="body2" color="text.secondary">Adjust element sizing for high-DPI displays</Typography>
                    </Box>
                    <StyledSelect size="small" defaultValue="100">
                      <MenuItem value="100">100% (Standard)</MenuItem>
                      <MenuItem value="125">125% (Comfortable)</MenuItem>
                      <MenuItem value="150">150% (Large)</MenuItem>
                    </StyledSelect>
                  </FlexRowSpaceBetween>
                </StyledCardContent>
              </StyledCard>
            </Box>
          )}

          {/* Server Logins Tab */}
          {activeTab === 'logins' && (
            <Box>
              <SectionHeader>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc' }}>Server Logins</Typography>
                  <Typography variant="body2" color="text.secondary">Manage saved credentials for SSH, SFTP, VNC, and SMB access</Typography>
                </Box>
                {!editingLogin && (
                  <Button
                    variant="contained"
                    startIcon={<Plus size={16} />}
                    onClick={() => setEditingLogin({ id: '', name: 'Home Server', ip: '', port: '22', loginUsername: 'root', password: '', type: 'ssh' })}
                  >
                    Add Server
                  </Button>
                )}
              </SectionHeader>

              {editingLogin ? (
                <StyledCard variant="outlined">
                  <StyledCardContent>
                    <Typography variant="subtitle2" className="card-subtitle">
                      {editingLogin.id ? 'Edit Server Login' : 'Add New Server Login'}
                    </Typography>
                    <FormFieldsContainer>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={8}>
                          <TextField
                            label="Server Name"
                            size="small"
                            value={editingLogin.name}
                            onChange={e => setEditingLogin({ ...editingLogin, name: e.target.value })}
                            fullWidth
                            placeholder="e.g. Debian Test Server"
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Select
                            size="small"
                            value={editingLogin.type || 'ssh'}
                            onChange={e => handleProtocolChange(e.target.value)}
                            fullWidth
                          >
                            <MenuItem value="ssh">SSH (Terminal)</MenuItem>
                            <MenuItem value="sftp">SFTP (File Transfer)</MenuItem>
                            <MenuItem value="vnc">VNC (Remote Desktop)</MenuItem>
                            <MenuItem value="smb">SMB (Network Share)</MenuItem>
                          </Select>
                        </Grid>
                        <Grid item xs={12} sm={8}>
                          <TextField
                            label="Host / IP Address"
                            size="small"
                            value={editingLogin.ip}
                            onChange={e => setEditingLogin({ ...editingLogin, ip: e.target.value })}
                            fullWidth
                            placeholder="192.168.1.100"
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Port"
                            size="small"
                            value={editingLogin.port}
                            onChange={e => setEditingLogin({ ...editingLogin, port: e.target.value })}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Username"
                            size="small"
                            value={editingLogin.loginUsername}
                            onChange={e => setEditingLogin({ ...editingLogin, loginUsername: e.target.value })}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Password"
                            type="password"
                            size="small"
                            value={editingLogin.password}
                            onChange={e => setEditingLogin({ ...editingLogin, password: e.target.value })}
                            fullWidth
                          />
                        </Grid>
                        {editingLogin.type === 'smb' && (
                          <>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                label="Share Name"
                                size="small"
                                value={editingLogin.share || ''}
                                onChange={e => setEditingLogin({ ...editingLogin, share: e.target.value })}
                                fullWidth
                                placeholder="e.g. data"
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                label="Domain / Workgroup"
                                size="small"
                                value={editingLogin.domain || ''}
                                onChange={e => setEditingLogin({ ...editingLogin, domain: e.target.value })}
                                fullWidth
                                placeholder="WORKGROUP"
                              />
                            </Grid>
                          </>
                        )}
                      </Grid>

                      <ButtonActionsContainer>
                        <Button variant="contained" color="primary" startIcon={<Save size={16} />} onClick={saveLogin}>
                          Save Server
                        </Button>
                        <Button variant="outlined" color="inherit" onClick={() => setEditingLogin(null)}>
                          Cancel
                        </Button>
                      </ButtonActionsContainer>
                    </FormFieldsContainer>
                  </StyledCardContent>
                </StyledCard>
              ) : (
                <StyledTableContainer component={Paper} elevation={0}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                        <TableCell sx={{ color: '#94a3b8', fontWeight: 600 }}>Name</TableCell>
                        <TableCell sx={{ color: '#94a3b8', fontWeight: 600 }}>Protocol</TableCell>
                        <TableCell sx={{ color: '#94a3b8', fontWeight: 600 }}>Connection Endpoint</TableCell>
                        <TableCell align="right" sx={{ color: '#94a3b8', fontWeight: 600 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {logins.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="empty-table-cell">
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 2 }}>
                              <Server size={36} color="#64748b" />
                              <Typography sx={{ color: '#94a3b8', fontWeight: 500 }}>No saved server logins yet</Typography>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<Plus size={14} />}
                                onClick={() => setEditingLogin({ id: '', name: 'Home Server', ip: '', port: '22', loginUsername: 'root', password: '', type: 'ssh' })}
                                sx={{ mt: 1 }}
                              >
                                Add Your First Server
                              </Button>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ) : (
                        logins.map((login) => (
                          <TableRow key={login.id} sx={{ '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.02)' } }}>
                            <TableCell className="name-table-cell">
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Server size={16} color="#38bdf8" />
                                {login.name}
                              </Box>
                            </TableCell>
                            <TableCell>{getProtocolChip(login.type)}</TableCell>
                            <TableCell className="details-table-cell">
                              {login.loginUsername ? `${login.loginUsername}@` : ''}{login.ip}{login.port ? `:${login.port}` : ''}
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                sx={{ color: '#38bdf8', mr: 1 }}
                                onClick={() => setEditingLogin(login)}
                              >
                                <Edit2 size={16} />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteLoginClick(login.id)}
                              >
                                <Trash2 size={16} />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </StyledTableContainer>
              )}
            </Box>
          )}

          {/* User Management Tab */}
          {activeTab === 'users' && canManageUsers && (
            <Box>
              <SectionHeader>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc' }}>User Management</Typography>
                  <Typography variant="body2" color="text.secondary">Create and manage accounts, roles, and service permissions</Typography>
                </Box>
                {!editingUser && (
                  <Button
                    variant="contained"
                    startIcon={<Plus size={16} />}
                    onClick={() => setEditingUser({ username: '', password: '', role: 'user', permissions: ['access_terminal', 'scan_network'] })}
                  >
                    Add User
                  </Button>
                )}
              </SectionHeader>

              {editingUser ? (
                <StyledCard variant="outlined">
                  <StyledCardContent>
                    <Typography variant="subtitle2" className="card-subtitle">
                      {usersList.find(u => u.username === editingUser.username) ? 'Edit User Account' : 'Create New User Account'}
                    </Typography>
                    <FormFieldsContainer>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Username"
                            size="small"
                            value={editingUser.username}
                            onChange={e => setEditingUser({ ...editingUser, username: e.target.value })}
                            disabled={Boolean(usersList.find(u => u.username === editingUser.username))}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Password"
                            type="password"
                            size="small"
                            value={editingUser.password || ''}
                            onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                            placeholder={usersList.find(u => u.username === editingUser.username) ? '(Leave empty to keep current)' : ''}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Select
                            size="small"
                            value={editingUser.role || 'user'}
                            onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                            fullWidth
                          >
                            <MenuItem value="user">Standard User</MenuItem>
                            <MenuItem value="admin">System Administrator</MenuItem>
                          </Select>
                        </Grid>
                      </Grid>

                      <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.06)' }} />

                      <Box>
                        <Typography variant="subtitle2" className="permissions-title">
                          Service Permissions
                        </Typography>
                        <Grid container spacing={1.5}>
                          {ALL_PERMISSIONS.map(perm => (
                            <Grid item xs={12} sm={6} key={perm.id}>
                              <Paper
                                variant="outlined"
                                sx={{
                                  p: 1.5,
                                  backgroundColor: 'rgba(255,255,255,0.015)',
                                  borderColor: (editingUser.permissions || []).includes(perm.id) ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255,255,255,0.06)',
                                  borderRadius: 2
                                }}
                              >
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      size="small"
                                      checked={(editingUser.permissions || []).includes(perm.id)}
                                      onChange={() => togglePermission(perm.id)}
                                      color="primary"
                                    />
                                  }
                                  label={
                                    <Box>
                                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#f8fafc' }}>
                                        {perm.label}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {perm.desc}
                                      </Typography>
                                    </Box>
                                  }
                                  sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
                                />
                              </Paper>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>

                      <ButtonActionsContainer>
                        <Button variant="contained" color="primary" startIcon={<Save size={16} />} onClick={saveUser}>
                          Save Account
                        </Button>
                        <Button variant="outlined" color="inherit" onClick={() => setEditingUser(null)}>
                          Cancel
                        </Button>
                      </ButtonActionsContainer>
                    </FormFieldsContainer>
                  </StyledCardContent>
                </StyledCard>
              ) : (
                <StyledTableContainer component={Paper} elevation={0}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                        <TableCell sx={{ color: '#94a3b8', fontWeight: 600 }}>Username</TableCell>
                        <TableCell sx={{ color: '#94a3b8', fontWeight: 600 }}>Role</TableCell>
                        <TableCell sx={{ color: '#94a3b8', fontWeight: 600 }}>Granted Permissions</TableCell>
                        <TableCell align="right" sx={{ color: '#94a3b8', fontWeight: 600 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {usersList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="empty-table-cell">
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 2 }}>
                              <Users size={36} color="#64748b" />
                              <Typography sx={{ color: '#94a3b8', fontWeight: 500 }}>No users found</Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ) : (
                        usersList.map((u) => (
                          <TableRow key={u.username} sx={{ '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.02)' } }}>
                            <TableCell className="name-table-cell">
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <User size={16} color={u.role === 'admin' ? '#f43f5e' : '#38bdf8'} />
                                {u.username}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={u.role === 'admin' ? 'ADMINISTRATOR' : 'USER'}
                                color={u.role === 'admin' ? 'error' : 'default'}
                                size="small"
                                className="styled-chip"
                                variant={u.role === 'admin' ? 'filled' : 'outlined'}
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {(u.permissions || []).slice(0, 3).map((p: string) => (
                                  <Chip key={p} label={p.replace('_', ' ')} size="small" sx={{ fontSize: '0.7rem', height: 20 }} />
                                ))}
                                {(u.permissions || []).length > 3 && (
                                  <Chip label={`+${u.permissions.length - 3} more`} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                sx={{ color: '#38bdf8', mr: 1 }}
                                onClick={() => setEditingUser({ ...u, password: '' })}
                              >
                                <Edit2 size={16} />
                              </IconButton>
                              {u.username !== 'admin' && (
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteUserClick(u.username)}
                                >
                                  <Trash2 size={16} />
                                </IconButton>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </StyledTableContainer>
              )}
            </Box>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <Box>
              <Typography variant="h5" className="section-title">Security & Credentials</Typography>

              <StyledCard variant="outlined" $mb>
                <StyledCardContent>
                  <Typography variant="subtitle2" className="card-subtitle">Session Security</Typography>
                  <StyledFormGroup>
                    <FlexRowSpaceBetween>
                      <Box>
                        <Typography sx={{ fontWeight: 500 }}>Ticket-Based Sandbox Auth</Typography>
                        <Typography variant="body2" color="text.secondary">Enforce isolated cryptographic tickets for application iframes</Typography>
                      </Box>
                      <Chip label="ACTIVE" color="success" size="small" className="styled-chip" />
                    </FlexRowSpaceBetween>
                    <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />
                    <FlexRowSpaceBetween>
                      <Box>
                        <Typography sx={{ fontWeight: 500 }}>Relay Channel Encryption</Typography>
                        <Typography variant="body2" color="text.secondary">TLS tunnel transport between Relay Server and Local Server</Typography>
                      </Box>
                      <Chip label="ENABLED" color="primary" size="small" className="styled-chip" />
                    </FlexRowSpaceBetween>
                  </StyledFormGroup>
                </StyledCardContent>
              </StyledCard>
            </Box>
          )}
        </ContentMaxWidth>
      </MainContentContainer>

      {/* Delete User Dialog */}
      <Dialog
        open={deleteUserDialog.open}
        onClose={() => setDeleteUserDialog({ open: false, username: '' })}
        PaperProps={{ sx: { backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 } }}
      >
        <DialogTitle sx={{ color: '#f8fafc', fontWeight: 700 }}>Delete User Account</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#94a3b8' }}>
            Are you sure you want to permanently delete user <strong style={{ color: '#f8fafc' }}>"{deleteUserDialog.username}"</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteUserDialog({ open: false, username: '' })} color="inherit">
            Cancel
          </Button>
          <Button onClick={confirmDeleteUser} variant="contained" color="error">
            Delete User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Login Dialog */}
      <Dialog
        open={deleteLoginDialog.open}
        onClose={() => setDeleteLoginDialog({ open: false, id: '' })}
        PaperProps={{ sx: { backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 } }}
      >
        <DialogTitle sx={{ color: '#f8fafc', fontWeight: 700 }}>Delete Server Login</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#94a3b8' }}>
            Are you sure you want to remove this saved server credential?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteLoginDialog({ open: false, id: '' })} color="inherit">
            Cancel
          </Button>
          <Button onClick={confirmDeleteLogin} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </RootContainer>
  );
}

// Subcomponents
const ThemeCard = ({ name, active, color, accent, onClick }: { name: string, active: boolean, color: string, accent?: string, onClick: () => void }) => {
  return (
    <ThemeCardRoot onClick={onClick}>
      <ThemeCardPreview $color={color} $active={active}>
        <ThemeCardHeader />
        <ThemeCardBody $accent={accent} />
      </ThemeCardPreview>
      <Typography
        variant="caption"
        className="theme-card-label"
        sx={{ color: active ? '#38bdf8' : '#94a3b8' }}
      >
        {name}
      </Typography>
    </ThemeCardRoot>
  );
};

// Styled Components Wrappers
const RootContainer = (props: any) => <Box className="root-container" {...props} />;
const SidebarPaper = (props: any) => <Paper className="sidebar-paper" {...props} />;
const SidebarHeader = (props: any) => <Box className="sidebar-header" {...props} />;
const SidebarList = (props: any) => <List className="sidebar-list" {...props} />;
const TabListItem = (props: any) => <ListItem className="tab-list-item" {...props} />;
const TabButton = (props: any) => <ListItemButton className="tab-button" {...props} />;
const TabIcon = ({ $active, ...props }: any) => {
  return <ListItemIcon className="tab-icon" sx={{ color: $active ? '#38bdf8' : '#64748b' }} {...props} />;
};
const TabText = ({ $active, ...props }: any) => {
  return <Typography sx={{ fontWeight: $active ? 600 : 500, color: $active ? '#38bdf8' : '#cbd5e1', fontSize: '0.92rem' }} {...props} />;
};
const MainContentContainer = (props: any) => <Box className="main-content-container" {...props} />;
const ContentMaxWidth = (props: any) => <Box className="content-max-width" {...props} />;
const StyledCard = ({ $mb, ...props }: any) => (
  <Card className="styled-card" sx={{ mb: $mb ? 3 : 0 }} {...props} />
);
const StyledCardContent = (props: any) => <CardContent className="styled-card-content" {...props} />;
const VerticalStack = (props: any) => <Box className="vertical-stack" {...props} />;
const FlexRowSpaceBetween = (props: any) => <Box className="flex-row-space-between" {...props} />;
const StyledTextField = (props: any) => <TextField className="styled-text-field" {...props} />;
const StyledSelect = (props: any) => <Select className="styled-select" {...props} />;
const StyledFormGroup = (props: any) => <FormGroup className="styled-form-group" {...props} />;
const FlexRowGap2 = (props: any) => <Box className="flex-row-gap-2" {...props} />;
const WallpaperContainer = (props: any) => <Box className="wallpaper-container" {...props} />;
const WallpaperThumb = ({ $bg, $active, ...props }: any) => {
  return <Box className="wallpaper-thumb" sx={{ background: $bg, border: $active ? '2px solid #38bdf8' : '2px solid transparent' }} {...props} />;
};
const SolidWallpaperButton = ({ $active, ...props }: any) => {
  return <Box className="solid-wallpaper-button" sx={{ border: $active ? '2px solid #38bdf8' : '1px dashed rgba(255,255,255,0.15)', color: $active ? '#38bdf8' : '#94a3b8' }} {...props} />;
};
const SectionHeader = (props: any) => <Box className="section-header" {...props} />;
const FormFieldsContainer = (props: any) => <Box className="form-fields-container" {...props} />;
const ButtonActionsContainer = (props: any) => (
  <Box className="button-actions-container" {...props} />
);
const StyledTableContainer = (props: any) => <TableContainer className="styled-table-container" {...props} />;
const ThemeCardRoot = (props: any) => <Box className="theme-card-root" {...props} />;
const ThemeCardPreview = ({ $color, $active, ...props }: any) => {
  return <Box className="theme-card-preview" sx={{ backgroundColor: $color, border: $active ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)' }} {...props} />;
};
const ThemeCardHeader = (props: any) => (
  <Box className="theme-card-header" sx={{ backgroundColor: 'rgba(255,255,255,0.12)' }} {...props} />
);
const ThemeCardBody = ({ $accent, ...props }: any) => (
  <Box className="theme-card-body" sx={{ backgroundColor: $accent || 'rgba(255,255,255,0.06)' }} {...props} />
);
