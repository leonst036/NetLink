import { useState, useEffect } from 'react';
import { User, Users, Monitor, Shield, Key, Plus, Trash2, Save } from 'lucide-react';
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
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import './SettingsApp.css';

type TabId = 'general' | 'appearance' | 'logins' | 'security' | 'users';

interface SettingsAppProps {
  token: string;
}

export default function SettingsApp({ token }: SettingsAppProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');

  // Load functional settings from localStorage
  const [username, setUsername] = useState(() => localStorage.getItem('netlink_username') || 'Admin');
  const [wallpaper, setWallpaper] = useState(() => localStorage.getItem('netlink_wallpaper') || 'default');
  const [appTheme, setAppTheme] = useState(() => localStorage.getItem('netlink_theme') || 'Dark');

  const updateSetting = (key: string, value: string, setter: (val: string) => void) => {
    setter(value);
    localStorage.setItem(key, value);
    window.dispatchEvent(new Event('settingsChange'));
  };

  const getPermissions = () => {
    try {
      if (!token) return [];
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const decoded = JSON.parse(jsonPayload);
      if (decoded.role === 'admin') return ['manage_users', 'manage_logins', 'access_terminal', 'access_vnc', 'access_sftp', 'scan_network'];
      return decoded.permissions || [];
    } catch {
      return [];
    }
  };

  const permissions = getPermissions();
  const canManageUsers = permissions.includes('manage_users');

  const tabs = [
    { id: 'general', label: 'General', icon: <User size={20} /> },
    { id: 'appearance', label: 'Appearance', icon: <Monitor size={20} /> },
    { id: 'logins', label: 'Server Logins', icon: <Key size={20} /> },
    { id: 'security', label: 'Security', icon: <Shield size={20} /> },
  ];

  if (canManageUsers) {
    tabs.splice(3, 0, { id: 'users', label: 'User Management', icon: <Users size={20} /> });
  }

  const [logins, setLogins] = useState<any[]>([]);
  const [editingLogin, setEditingLogin] = useState<any | null>(null);

  const [usersList, setUsersList] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  const [deleteUserDialog, setDeleteUserDialog] = useState<{ open: boolean, username: string }>({ open: false, username: '' });
  const [deleteLoginDialog, setDeleteLoginDialog] = useState<{ open: boolean, id: string }>({ open: false, id: '' });

  useEffect(() => {
    if (activeTab === 'logins') {
      try {
        fetchLogins();
      } catch (err) {
        console.error('Failed to fetch logins', err);
      }
    } else if (activeTab === 'users' && canManageUsers) {
      try {
        fetchUsers();
      } catch (err) {
        console.error('Failed to fetch users', err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
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
          'Authorization': `Bearer ${token}`
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
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        try {
          await fetchUsers();
        } catch (err) {
          console.error('Failed to fetch users', err);
        }
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

  const ALL_PERMISSIONS = [ // TODO: Move these permissions to the DB
    { id: 'manage_users', label: 'Manage Users' },
    { id: 'manage_logins', label: 'Manage Server Logins' },
    { id: 'access_terminal', label: 'Access Terminal' },
    { id: 'access_vnc', label: 'Access VNC' },
    { id: 'access_sftp', label: 'Access SFTP File Explorer' },
    { id: 'scan_network', label: 'Scan Network' }
  ];

  const fetchLogins = async () => {
    try {
      const res = await fetch('/api/server-logins', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.logins) {
        setLogins(data.logins);
      }
    } catch (err) {
      console.error('Failed to fetch logins', err);
    }
  };

  const saveLogin = async () => {
    if (!editingLogin) return;
    try {
      const res = await fetch('/api/server-logins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editingLogin)
      });
      if (res.ok) {
        try {
          setEditingLogin(null);
          await fetchLogins();
        } catch (err) {
          console.error('Failed to fetch logins', err);
        }
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
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        try {
          await fetchLogins();
        } catch (err) {
          console.error('Failed to fetch logins', err);
        }
      }
    } catch (err) {
      console.error('Failed to delete login', err);
    }
    setDeleteLoginDialog({ open: false, id: '' });
  };

  return (
    <RootContainer>
      {/* Sidebar */}
      <SidebarPaper elevation={0}>
        <SidebarHeader>
          <SidebarTitle variant="h6">Settings</SidebarTitle>
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
          {activeTab === 'general' && (
            <Box>
              <SectionTitle variant="h5">General Settings</SectionTitle>

              <StyledCard variant="outlined" $mb>
                <StyledCardContent>
                  <CardSubtitle variant="subtitle2" color="text.secondary">
                    User Profile
                  </CardSubtitle>
                  <VerticalStack>
                    <FlexRowSpaceBetween>
                      <Typography>Username</Typography>
                      <StyledTextField
                        size="small"
                        value={username}
                        onChange={(e: any) => updateSetting('netlink_username', e.target.value, setUsername)}
                      />
                    </FlexRowSpaceBetween>
                    <FlexRowSpaceBetween>
                      <Typography>Language</Typography>
                      <StyledSelect size="small" value="en">
                        <MenuItem value="en">English (US)</MenuItem>
                      </StyledSelect>
                    </FlexRowSpaceBetween>
                  </VerticalStack>
                </StyledCardContent>
              </StyledCard>

              <StyledCard variant="outlined">
                <StyledCardContent>
                  <CardSubtitle variant="subtitle2" color="text.secondary">
                    Desktop Behavior
                  </CardSubtitle>
                  <StyledFormGroup>
                    <FlexRowSpaceBetween>
                      <Typography>Show desktop icons</Typography>
                      <Switch defaultChecked />
                    </FlexRowSpaceBetween>
                    <FlexRowSpaceBetween>
                      <Typography>Enable window animations</Typography>
                      <Switch defaultChecked />
                    </FlexRowSpaceBetween>
                    <FlexRowSpaceBetween>
                      <Typography>Play notification sounds</Typography>
                      <Switch />
                    </FlexRowSpaceBetween>
                    <FlexRowSpaceBetween>
                      <Typography>Enable debug mode (logs &amp; VNC FPS/Latency)</Typography>
                      <Switch
                        defaultChecked={localStorage.getItem('netlink_debug') === 'true'}
                        onChange={(_e, checked) => {
                          localStorage.setItem('netlink_debug', checked.toString());
                          window.dispatchEvent(new Event('settingsChange'));
                        }}
                      />
                    </FlexRowSpaceBetween>
                  </StyledFormGroup>
                </StyledCardContent>
              </StyledCard>
            </Box>
          )}

          {activeTab === 'appearance' && (
            <Box>
              <SectionTitle variant="h5">Appearance</SectionTitle>

              <StyledCard variant="outlined" $mb>
                <StyledCardContent>
                  <CardSubtitle variant="subtitle2" color="text.secondary">
                    Theme (Beta)
                  </CardSubtitle>
                  <FlexRowGap2>
                    <ThemeCard name="Dark" active={appTheme === 'Dark'} color="#0f172a" onClick={() => updateSetting('netlink_theme', 'Dark', setAppTheme)} />
                    <ThemeCard name="Light" active={appTheme === 'Light'} color="#f8fafc" textColor="#0f172a" onClick={() => updateSetting('netlink_theme', 'Light', setAppTheme)} />
                  </FlexRowGap2>
                </StyledCardContent>
              </StyledCard>

              <StyledCard variant="outlined" $mb>
                <StyledCardContent>
                  <CardSubtitle variant="subtitle2" color="text.secondary">
                    Wallpaper
                  </CardSubtitle>
                  <WallpaperContainer>
                    <WallpaperThumb $active={wallpaper === 'default'} $bg='url("/login-bg.png") center/cover' onClick={() => updateSetting('netlink_wallpaper', 'default', setWallpaper)} />
                    <WallpaperThumb $active={wallpaper === 'wp1'} $bg='linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)' onClick={() => updateSetting('netlink_wallpaper', 'wp1', setWallpaper)} />
                    <WallpaperThumb $active={wallpaper === 'wp2'} $bg='linear-gradient(135deg, #4c1d95 0%, #0f172a 100%)' onClick={() => updateSetting('netlink_wallpaper', 'wp2', setWallpaper)} />
                    <WallpaperThumb $active={wallpaper === 'wp3'} $bg='linear-gradient(135deg, #064e3b 0%, #0f172a 100%)' onClick={() => updateSetting('netlink_wallpaper', 'wp3', setWallpaper)} />
                    <SolidWallpaperButton
                      onClick={() => updateSetting('netlink_wallpaper', 'solid', setWallpaper)}
                      $active={wallpaper === 'solid'}
                    >
                      Solid
                    </SolidWallpaperButton>
                  </WallpaperContainer>
                </StyledCardContent>
              </StyledCard>

              <StyledCard variant="outlined">
                <StyledCardContent>
                  <CardSubtitle variant="subtitle2" color="text.secondary">
                    Display Settings
                  </CardSubtitle>
                  <FlexRowSpaceBetween>
                    <Typography>UI Scale</Typography>
                    <StyledSelect size="small" value="100">
                      <MenuItem value="100">100% (Default)</MenuItem>
                      <MenuItem value="125">125%</MenuItem>
                      <MenuItem value="150">150%</MenuItem>
                    </StyledSelect>
                  </FlexRowSpaceBetween>
                </StyledCardContent>
              </StyledCard>
            </Box>
          )}

          {activeTab === 'logins' && (
            <Box>
              <SectionHeader>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Server Logins</Typography>
                <Button
                  variant="contained"
                  startIcon={<Plus size={16} />}
                  onClick={() => setEditingLogin({ id: '', name: 'New Server', ip: '', port: '22', loginUsername: 'root', password: '', type: 'ssh' })}
                >
                  Add Login
                </Button>
              </SectionHeader>

              {editingLogin ? (
                <StyledCard variant="outlined">
                  <StyledCardContent>
                    <CardSubtitle variant="subtitle2" color="text.secondary">
                      Edit Server Login
                    </CardSubtitle>
                    <FormFieldsContainer>
                      <TextField label="Name" size="small" value={editingLogin.name} onChange={e => setEditingLogin({ ...editingLogin, name: e.target.value })} fullWidth />
                      <TextField label="IP Address" size="small" value={editingLogin.ip} onChange={e => setEditingLogin({ ...editingLogin, ip: e.target.value })} fullWidth />
                      <TextField label="Port" size="small" value={editingLogin.port} onChange={e => setEditingLogin({ ...editingLogin, port: e.target.value })} fullWidth />
                      <TextField label="Username" size="small" value={editingLogin.loginUsername} onChange={e => setEditingLogin({ ...editingLogin, loginUsername: e.target.value })} fullWidth />
                      <TextField label="Password" type="password" size="small" value={editingLogin.password} onChange={e => setEditingLogin({ ...editingLogin, password: e.target.value })} fullWidth />
                      <Select size="small" value={editingLogin.type} onChange={e => setEditingLogin({ ...editingLogin, type: e.target.value })} fullWidth>
                        <MenuItem value="ssh">SSH</MenuItem>
                        <MenuItem value="vnc">VNC</MenuItem>
                        <MenuItem value="sftp">SFTP</MenuItem>
                        <MenuItem value="smb">SMB</MenuItem>
                      </Select>
                      <ButtonActionsContainer $mt={2}>
                        <Button variant="contained" color="success" startIcon={<Save size={16} />} onClick={saveLogin}>Save</Button>
                        <Button variant="outlined" color="inherit" onClick={() => setEditingLogin(null)}>Cancel</Button>
                      </ButtonActionsContainer>
                    </FormFieldsContainer>
                  </StyledCardContent>
                </StyledCard>
              ) : (
                <StyledTableContainer component={Paper} elevation={0}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Address</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {logins.length === 0 ? (
                        <TableRow>
                          <EmptyTableCell colSpan={4} align="center">No saved logins yet. Click "Add Login" to create one.</EmptyTableCell>
                        </TableRow>
                      ) : (
                        logins.map((login) => (
                          <TableRow key={login.id}>
                            <NameTableCell>{login.name}</NameTableCell>
                            <TableCell><StyledChip label={login.type} size="small" color="primary" variant="outlined" /></TableCell>
                            <DetailsTableCell>{login.loginUsername}@{login.ip}:{login.port}</DetailsTableCell>
                            <TableCell align="right">
                              <EditButton size="small" onClick={() => setEditingLogin(login)}>Edit</EditButton>
                              <IconButton size="small" color="error" onClick={() => handleDeleteLoginClick(login.id)}>
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

          {activeTab === 'users' && canManageUsers && (
            <Box>
              <SectionHeader>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>User Management</Typography>
                <Button
                  variant="contained"
                  startIcon={<Plus size={16} />}
                  onClick={() => setEditingUser({ username: '', password: '', role: 'user', permissions: [] })}
                >
                  Add User
                </Button>
              </SectionHeader>

              {editingUser ? (
                <StyledCard variant="outlined">
                  <StyledCardContent>
                    <CardSubtitle variant="subtitle2" color="text.secondary">
                      {usersList.find(u => u.username === editingUser.username) ? "Edit User" : "New User"}
                    </CardSubtitle>
                    <VerticalStack>
                      <TextField label="Username" size="small" value={editingUser.username} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })} disabled={!!usersList.find(u => u.username === editingUser.username)} fullWidth />
                      <TextField label={usersList.find(u => u.username === editingUser.username) ? "New Password (Leave blank to keep current)" : "Password"} type="password" size="small" value={editingUser.password} onChange={e => setEditingUser({ ...editingUser, password: e.target.value })} fullWidth />

                      <Box>
                        <PermissionsTitle variant="subtitle2">Permissions</PermissionsTitle>
                        <FormGroup>
                          {ALL_PERMISSIONS.map(perm => (
                            <FormControlLabel
                              key={perm.id}
                              control={<Checkbox checked={editingUser.permissions?.includes(perm.id) || false} onChange={() => togglePermission(perm.id)} />}
                              label={perm.label}
                            />
                          ))}
                        </FormGroup>
                      </Box>

                      <ButtonActionsContainer $mt={1}>
                        <Button variant="contained" color="success" startIcon={<Save size={16} />} onClick={saveUser}>Save</Button>
                        <Button variant="outlined" color="inherit" onClick={() => setEditingUser(null)}>Cancel</Button>
                      </ButtonActionsContainer>
                    </VerticalStack>
                  </StyledCardContent>
                </StyledCard>
              ) : (
                <StyledTableContainer component={Paper} elevation={0}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Username</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Permissions</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {usersList.length === 0 ? (
                        <TableRow>
                          <EmptyTableCell colSpan={4} align="center">No users found.</EmptyTableCell>
                        </TableRow>
                      ) : (
                        usersList.map((user) => (
                          <TableRow key={user.username}>
                            <NameTableCell>{user.username}</NameTableCell>
                            <TableCell>
                              {user.role === 'admin' ? <Chip label="Admin" size="small" color="error" variant="outlined" /> : <Chip label="User" size="small" variant="outlined" />}
                            </TableCell>
                            <DetailsTableCell>{user.permissions?.length || 0} Granted</DetailsTableCell>
                            <TableCell align="right">
                              <EditButton size="small" onClick={() => setEditingUser(user)}>Edit</EditButton>
                              <IconButton size="small" color="error" onClick={() => handleDeleteUserClick(user.username)}>
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

          {activeTab === 'security' && (
            <Box>
              <SectionTitle variant="h5">Security Settings</SectionTitle>

              <StyledCard variant="outlined" $mb>
                <StyledCardContent>
                  <CardSubtitle variant="subtitle2" color="text.secondary">
                    Authentication
                  </CardSubtitle>
                  <StyledFormGroup>
                    <FlexRowSpaceBetween>
                      <Typography>Require password on wake</Typography>
                      <Switch defaultChecked />
                    </FlexRowSpaceBetween>
                    <FlexRowSpaceBetween>
                      <Typography>Save credentials securely</Typography>
                      <Switch defaultChecked />
                    </FlexRowSpaceBetween>
                  </StyledFormGroup>
                  <StyledDivider />
                  <Button variant="outlined" color="error">
                    Clear Saved Credentials
                  </Button>
                </StyledCardContent>
              </StyledCard>
            </Box>
          )}

        </ContentMaxWidth>
      </MainContentContainer>

      {/* Delete User Dialog */}
      <Dialog open={deleteUserDialog.open} onClose={() => setDeleteUserDialog({ open: false, username: '' })}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete user "{deleteUserDialog.username}"?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteUserDialog({ open: false, username: '' })} color="inherit">Cancel</Button>
          <Button onClick={confirmDeleteUser} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Login Dialog */}
      <Dialog open={deleteLoginDialog.open} onClose={() => setDeleteLoginDialog({ open: false, id: '' })}>
        <DialogTitle>Delete Login</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this login?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteLoginDialog({ open: false, id: '' })} color="inherit">Cancel</Button>
          <Button onClick={confirmDeleteLogin} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </RootContainer>
  );
}

// Subcomponents
const ThemeCard = ({ name, active, color, textColor = 'white', accent, onClick }: { name: string, active: boolean, color: string, textColor?: string, accent?: string, onClick: () => void }) => {
  return (
    <ThemeCardRoot onClick={onClick}>
      <ThemeCardPreview $color={color} $active={active}>
        <ThemeCardHeader $textColor={textColor} />
        <ThemeCardBody $accent={accent} $textColor={textColor} />
      </ThemeCardPreview>
      <ThemeCardLabel variant="caption" $active={active}>
        {name}
      </ThemeCardLabel>
    </ThemeCardRoot>
  );
};

// Styled Components Wrappers
const RootContainer = (props: any) => <Box className="root-container" {...props} />;
const SidebarPaper = (props: any) => <Paper className="sidebar-paper" {...props} />;
const SidebarHeader = (props: any) => <Box className="sidebar-header" {...props} />;
const SidebarTitle = (props: any) => <Typography className="sidebar-title" {...props} />;
const SidebarList = (props: any) => <List className="sidebar-list" {...props} />;
const TabListItem = (props: any) => <ListItem className="tab-list-item" {...props} />;
const TabButton = (props: any) => <ListItemButton className="tab-button" {...props} />;
const TabIcon = ({ $active, ...props }: any) => {
  return <ListItemIcon className="tab-icon" sx={{ color: $active ? 'primary.main' : 'inherit' }} {...props} />;
};
const TabText = ({ $active, ...props }: any) => {
  return <Typography className="tab-text" sx={{ fontWeight: $active ? 'bold' : 'medium', color: $active ? 'primary.main' : 'inherit' }} {...props} />;
};
const MainContentContainer = (props: any) => <Box className="main-content-container" {...props} />;
const ContentMaxWidth = (props: any) => <Box className="content-max-width" {...props} />;
const SectionTitle = (props: any) => <Typography className="section-title" {...props} />;
const StyledCard = ({ $mb, ...props }: any) => (
  <Card className="styled-card" sx={{ mb: $mb ? 3 : 0 }} {...props} />
);
const StyledCardContent = (props: any) => <CardContent className="styled-card-content" {...props} />;
const CardSubtitle = (props: any) => <Typography className="card-subtitle" {...props} />;
const VerticalStack = (props: any) => <Box className="vertical-stack" {...props} />;
const FlexRowSpaceBetween = (props: any) => <Box className="flex-row-space-between" {...props} />;
const StyledTextField = (props: any) => <TextField className="styled-text-field" {...props} />;
const StyledSelect = (props: any) => <Select className="styled-select" {...props} />;
const StyledFormGroup = (props: any) => <FormGroup className="styled-form-group" {...props} />;
const FlexRowGap2 = (props: any) => <Box className="flex-row-gap-2" {...props} />;
const WallpaperContainer = (props: any) => <Box className="wallpaper-container" {...props} />;
const WallpaperThumb = ({ $bg, $active, ...props }: any) => {
  return <Box className="wallpaper-thumb" sx={{ background: $bg, border: $active ? (theme) => `2px solid ${theme.palette.primary.main}` : 'none' }} {...props} />;
};
const SolidWallpaperButton = ({ $active, ...props }: any) => {
  return <Box className="solid-wallpaper-button" sx={{ border: $active ? (theme) => `2px solid ${theme.palette.primary.main}` : (theme) => `1px dashed ${theme.palette.divider}` }} {...props} />;
};
const SectionHeader = (props: any) => <Box className="section-header" {...props} />;
const FormFieldsContainer = (props: any) => <Box className="form-fields-container" {...props} />;
const ButtonActionsContainer = ({ $mt, ...props }: any) => (
  <Box className="button-actions-container" sx={{ mt: $mt !== undefined ? $mt : 0 }} {...props} />
);
const StyledTableContainer = (props: any) => <TableContainer className="styled-table-container" {...props} />;
const EmptyTableCell = (props: any) => {
  return <TableCell className="empty-table-cell" sx={{ color: 'text.secondary' }} {...props} />;
};
const NameTableCell = (props: any) => <TableCell className="name-table-cell" {...props} />;
const StyledChip = (props: any) => <Chip className="styled-chip" {...props} />;
const DetailsTableCell = (props: any) => {
  return <TableCell className="details-table-cell" sx={{ color: 'text.secondary' }} {...props} />;
};
const EditButton = (props: any) => <Button className="edit-button" {...props} />;
const PermissionsTitle = (props: any) => <Typography className="permissions-title" {...props} />;
const StyledDivider = (props: any) => <Divider className="styled-divider" {...props} />;
const ThemeCardRoot = (props: any) => <Box className="theme-card-root" {...props} />;
const ThemeCardPreview = ({ $color, $active, ...props }: any) => {
  return <Box className="theme-card-preview" sx={{ backgroundColor: $color, border: $active ? (theme) => `2px solid ${theme.palette.primary.main}` : (theme) => `1px solid ${theme.palette.divider}` }} {...props} />;
};
const ThemeCardHeader = ({ $textColor, ...props }: any) => (
  <Box className="theme-card-header" sx={{ backgroundColor: $textColor === 'white' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} {...props} />
);
const ThemeCardBody = ({ $accent, $textColor, ...props }: any) => (
  <Box className="theme-card-body" sx={{ backgroundColor: $accent || ($textColor === 'white' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') }} {...props} />
);
const ThemeCardLabel = ({ $active, ...props }: any) => {
  return <Typography className="theme-card-label" sx={{ color: $active ? 'primary.main' : 'text.secondary', fontWeight: $active ? 'bold' : 'normal' }} {...props} />;
};
