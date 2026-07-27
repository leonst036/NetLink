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
  Divider
} from '@mui/material';
import { styled } from '@mui/material/styles';

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

  const deleteUser = async (username: string) => {
    if (!window.confirm(`Are you sure you want to delete user ${username}?`)) return;
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

  const deleteLogin = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this login?')) return;
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
                        onChange={(e) => updateSetting('netlink_username', e.target.value, setUsername)}
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
                              <IconButton size="small" color="error" onClick={() => deleteLogin(login.id)}>
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
                              <IconButton size="small" color="error" onClick={() => deleteUser(user.username)}>
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

// Styled Components
const RootContainer = styled(Box)({
  display: 'flex',
  height: '100%',
  backgroundColor: 'transparent',
});

const SidebarPaper = styled(Paper)({
  width: 260,
  backgroundColor: 'rgba(0,0,0,0.2)',
  borderRight: '1px solid rgba(255,255,255,0.05)',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 0,
});

const SidebarHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  paddingBottom: theme.spacing(1),
}));

const SidebarTitle = styled(Typography)({
  fontWeight: 'bold',
});

const SidebarList = styled(List)(({ theme }) => ({
  paddingLeft: theme.spacing(1),
  paddingRight: theme.spacing(1),
}));

const TabListItem = styled(ListItem)(({ theme }) => ({
  marginBottom: theme.spacing(0.5),
}));

const TabButton = styled(ListItemButton)({
  borderRadius: 8,
});

const TabIcon = styled(ListItemIcon, {
  shouldForwardProp: (prop) => prop !== '$active',
})<{ $active?: boolean }>(({ theme, $active }) => ({
  minWidth: 40,
  color: $active ? theme.palette.primary.main : 'inherit',
}));

const TabText = styled(Typography, {
  shouldForwardProp: (prop) => prop !== '$active',
})<{ $active?: boolean }>(({ theme, $active }) => ({
  fontWeight: $active ? 'bold' : 'medium',
  color: $active ? theme.palette.primary.main : 'inherit',
}));

const MainContentContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  padding: theme.spacing(4),
  overflowY: 'auto',
}));

const ContentMaxWidth = styled(Box)({
  maxWidth: 800,
});

const SectionTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(4),
  fontWeight: 'bold',
}));

const StyledCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== '$mb',
})<{ $mb?: boolean }>(({ theme, $mb }) => ({
  backgroundColor: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 12,
  marginBottom: $mb ? theme.spacing(3) : 0,
}));

const StyledCardContent = styled(CardContent)(({ theme }) => ({
  padding: theme.spacing(3),
  '&:last-child': {
    paddingBottom: theme.spacing(3),
  },
}));

const CardSubtitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  textTransform: 'uppercase',
  letterSpacing: 1,
}));

const VerticalStack = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const FlexRowSpaceBetween = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

const StyledTextField = styled(TextField)({
  width: 250,
});

const StyledSelect = styled(Select)({
  width: 250,
});

const StyledFormGroup = styled(FormGroup)(({ theme }) => ({
  gap: theme.spacing(2),
}));

const FlexRowGap2 = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
}));

const WallpaperContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  flexWrap: 'wrap',
}));

const WallpaperThumb = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$bg' && prop !== '$active',
})<{ $bg: string; $active: boolean }>(({ theme, $bg, $active }) => ({
  width: 100,
  height: 60,
  borderRadius: 8,
  cursor: 'pointer',
  background: $bg,
  border: $active ? `2px solid ${theme.palette.primary.main}` : 'none',
}));

const SolidWallpaperButton = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$active',
})<{ $active?: boolean }>(({ theme, $active }) => ({
  width: 100,
  height: 60,
  borderRadius: 8,
  cursor: 'pointer',
  backgroundColor: '#090d1a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.text.secondary,
  border: $active ? `2px solid ${theme.palette.primary.main}` : `1px dashed ${theme.palette.divider}`,
}));

const SectionHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(4),
}));

const FormFieldsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

const ButtonActionsContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$mt',
})<{ $mt?: number }>(({ theme, $mt }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  marginTop: $mt !== undefined ? theme.spacing($mt) : 0,
}));

const StyledTableContainer = styled(TableContainer)({
  backgroundColor: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 12,
}) as typeof TableContainer;

const EmptyTableCell = styled(TableCell)(({ theme }) => ({
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
  color: theme.palette.text.secondary,
}));

const NameTableCell = styled(TableCell)({
  fontWeight: 500,
});

const StyledChip = styled(Chip)({
  textTransform: 'uppercase',
});

const DetailsTableCell = styled(TableCell)(({ theme }) => ({
  color: theme.palette.text.secondary,
}));

const EditButton = styled(Button)(({ theme }) => ({
  minWidth: 'auto',
  marginRight: theme.spacing(1),
}));

const PermissionsTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));

const StyledDivider = styled(Divider)(({ theme }) => ({
  marginTop: theme.spacing(3),
  marginBottom: theme.spacing(3),
}));

const ThemeCardRoot = styled(Box)(({ theme }) => ({
  width: 100,
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const ThemeCardPreview = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$color' && prop !== '$active',
})<{ $color: string; $active: boolean }>(({ theme, $color, $active }) => ({
  width: '100%',
  height: 64,
  backgroundColor: $color,
  borderRadius: 8,
  border: $active ? `2px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(1),
  position: 'relative',
}));

const ThemeCardHeader = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$textColor',
})<{ $textColor?: string }>(({ theme, $textColor }) => ({
  width: '100%',
  height: 8,
  backgroundColor: $textColor === 'white' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
  borderRadius: 4,
  marginBottom: theme.spacing(1),
}));

const ThemeCardBody = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$accent' && prop !== '$textColor',
})<{ $accent?: string; $textColor?: string }>(({ $accent, $textColor }) => ({
  width: '60%',
  height: 6,
  backgroundColor: $accent || ($textColor === 'white' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
  borderRadius: 4,
}));

const ThemeCardLabel = styled(Typography, {
  shouldForwardProp: (prop) => prop !== '$active',
})<{ $active: boolean }>(({ theme, $active }) => ({
  color: $active ? theme.palette.primary.main : theme.palette.text.secondary,
  fontWeight: $active ? 'bold' : 'normal',
}));
