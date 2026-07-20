import { useState, useEffect } from 'react';
import { User, Users, Monitor, Info, Shield, Key, Plus, Trash2, Save } from 'lucide-react';
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
  useTheme
} from '@mui/material';

type TabId = 'general' | 'appearance' | 'logins' | 'security' | 'users';

interface SettingsAppProps {
  token: string;
}

export default function SettingsApp({ token }: SettingsAppProps) {
  const theme = useTheme();
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
    <Box sx={{ display: 'flex', height: '100%', bgcolor: 'background.default' }}>
      {/* Sidebar */}
      <Paper
        square
        elevation={0}
        sx={{
          width: 260,
          bgcolor: 'background.paper',
          borderRight: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Box sx={{ p: 3, pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Settings</Typography>
        </Box>
        <List sx={{ px: 1 }}>
          {tabs.map(tab => (
            <ListItem disablePadding key={tab.id} sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id as TabId)}
                sx={{ borderRadius: 2 }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: activeTab === tab.id ? 'primary.main' : 'inherit' }}>
                  {tab.icon}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography sx={{
                      fontWeight: activeTab === tab.id ? 'bold' : 'medium',
                      color: activeTab === tab.id ? 'primary.main' : 'inherit'
                    }}>
                      {tab.label}
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, p: 4, overflowY: 'auto' }}>
        <Box sx={{ maxWidth: 800 }}>
          {activeTab === 'general' && (
            <Box>
              <Typography variant="h5" sx={{ mb: 4, fontWeight: 'bold' }}>General Settings</Typography>

              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
                    User Profile
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography>Username</Typography>
                      <TextField
                        size="small"
                        value={username}
                        onChange={(e) => updateSetting('netlink_username', e.target.value, setUsername)}
                        sx={{ width: 250 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography>Language</Typography>
                      <Select size="small" value="en" sx={{ width: 250 }}>
                        <MenuItem value="en">English (US)</MenuItem>
                        <MenuItem value="de">German (DE)</MenuItem>
                        <MenuItem value="fr">French (FR)</MenuItem>
                      </Select>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Desktop Behavior
                  </Typography>
                  <FormGroup sx={{ gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography>Show desktop icons</Typography>
                      <Switch defaultChecked />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography>Enable window animations</Typography>
                      <Switch defaultChecked />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography>Play notification sounds</Typography>
                      <Switch />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography>Enable debug mode (logs &amp; VNC FPS/Latency)</Typography>
                      <Switch
                        defaultChecked={localStorage.getItem('netlink_debug') === 'true'}
                        onChange={(_e, checked) => {
                          localStorage.setItem('netlink_debug', checked.toString());
                          window.dispatchEvent(new Event('settingsChange'));
                        }}
                      />
                    </Box>
                  </FormGroup>
                </CardContent>
              </Card>
            </Box>
          )}

          {activeTab === 'appearance' && (
            <Box>
              <Typography variant="h5" sx={{ mb: 4, fontWeight: 'bold' }}>Appearance</Typography>

              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Theme
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <ThemeCard name="Dark" active={appTheme === 'Dark'} color="#0f172a" onClick={() => updateSetting('netlink_theme', 'Dark', setAppTheme)} />
                    <ThemeCard name="Light" active={appTheme === 'Light'} color="#f8fafc" textColor="#0f172a" onClick={() => updateSetting('netlink_theme', 'Light', setAppTheme)} />
                  </Box>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Wallpaper
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <WallpaperThumb active={wallpaper === 'default'} bg='url("https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=200&auto=format&fit=crop") center/cover' onClick={() => updateSetting('netlink_wallpaper', 'default', setWallpaper)} />
                    <WallpaperThumb active={wallpaper === 'wp1'} bg='linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)' onClick={() => updateSetting('netlink_wallpaper', 'wp1', setWallpaper)} />
                    <WallpaperThumb active={wallpaper === 'wp2'} bg='linear-gradient(135deg, #4c1d95 0%, #0f172a 100%)' onClick={() => updateSetting('netlink_wallpaper', 'wp2', setWallpaper)} />
                    <WallpaperThumb active={wallpaper === 'wp3'} bg='linear-gradient(135deg, #064e3b 0%, #0f172a 100%)' onClick={() => updateSetting('netlink_wallpaper', 'wp3', setWallpaper)} />
                    <Box
                      onClick={() => updateSetting('netlink_wallpaper', 'solid', setWallpaper)}
                      sx={{
                        width: 100, height: 60, borderRadius: 2, cursor: 'pointer',
                        bgcolor: '#090d1a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'text.secondary', border: wallpaper === 'solid' ? `2px solid ${theme.palette.primary.main}` : `1px dashed ${theme.palette.divider}`
                      }}
                    >
                      Solid
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Display Settings
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography>UI Scale</Typography>
                    <Select size="small" value="100" sx={{ width: 250 }}>
                      <MenuItem value="100">100% (Default)</MenuItem>
                      <MenuItem value="125">125%</MenuItem>
                      <MenuItem value="150">150%</MenuItem>
                    </Select>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}

          {activeTab === 'logins' && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Server Logins</Typography>
                <Button
                  variant="contained"
                  startIcon={<Plus size={16} />}
                  onClick={() => setEditingLogin({ id: '', name: 'New Server', ip: '', port: '22', loginUsername: 'root', password: '', type: 'ssh' })}
                >
                  Add Login
                </Button>
              </Box>

              {editingLogin ? (
                <Card variant="outlined">
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Edit Server Login
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                        <Button variant="contained" color="success" startIcon={<Save size={16} />} onClick={saveLogin}>Save</Button>
                        <Button variant="outlined" color="inherit" onClick={() => setEditingLogin(null)}>Cancel</Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ) : (
                <TableContainer component={Paper} variant="outlined">
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
                          <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>No saved logins yet. Click "Add Login" to create one.</TableCell>
                        </TableRow>
                      ) : (
                        logins.map((login) => (
                          <TableRow key={login.id}>
                            <TableCell sx={{ fontWeight: 500 }}>{login.name}</TableCell>
                            <TableCell><Chip label={login.type} size="small" color="primary" variant="outlined" sx={{ textTransform: 'uppercase' }} /></TableCell>
                            <TableCell sx={{ color: 'text.secondary' }}>{login.loginUsername}@{login.ip}:{login.port}</TableCell>
                            <TableCell align="right">
                              <Button size="small" sx={{ minWidth: 'auto', mr: 1 }} onClick={() => setEditingLogin(login)}>Edit</Button>
                              <IconButton size="small" color="error" onClick={() => deleteLogin(login.id)}>
                                <Trash2 size={16} />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {activeTab === 'users' && canManageUsers && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>User Management</Typography>
                <Button
                  variant="contained"
                  startIcon={<Plus size={16} />}
                  onClick={() => setEditingUser({ username: '', password: '', role: 'user', permissions: [] })}
                >
                  Add User
                </Button>
              </Box>

              {editingUser ? (
                <Card variant="outlined">
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
                      {usersList.find(u => u.username === editingUser.username) ? "Edit User" : "New User"}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <TextField label="Username" size="small" value={editingUser.username} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })} disabled={!!usersList.find(u => u.username === editingUser.username)} fullWidth />
                      <TextField label={usersList.find(u => u.username === editingUser.username) ? "New Password (Leave blank to keep current)" : "Password"} type="password" size="small" value={editingUser.password} onChange={e => setEditingUser({ ...editingUser, password: e.target.value })} fullWidth />

                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Permissions</Typography>
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

                      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                        <Button variant="contained" color="success" startIcon={<Save size={16} />} onClick={saveUser}>Save</Button>
                        <Button variant="outlined" color="inherit" onClick={() => setEditingUser(null)}>Cancel</Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ) : (
                <TableContainer component={Paper} variant="outlined">
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
                          <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>No users found.</TableCell>
                        </TableRow>
                      ) : (
                        usersList.map((user) => (
                          <TableRow key={user.username}>
                            <TableCell sx={{ fontWeight: 500 }}>{user.username}</TableCell>
                            <TableCell>
                              {user.role === 'admin' ? <Chip label="Admin" size="small" color="error" variant="outlined" /> : <Chip label="User" size="small" variant="outlined" />}
                            </TableCell>
                            <TableCell sx={{ color: 'text.secondary' }}>{user.permissions?.length || 0} Granted</TableCell>
                            <TableCell align="right">
                              <Button size="small" sx={{ minWidth: 'auto', mr: 1 }} onClick={() => setEditingUser(user)}>Edit</Button>
                              <IconButton size="small" color="error" onClick={() => deleteUser(user.username)}>
                                <Trash2 size={16} />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {activeTab === 'security' && (
            <Box>
              <Typography variant="h5" sx={{ mb: 4, fontWeight: 'bold' }}>Security Settings</Typography>

              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Authentication
                  </Typography>
                  <FormGroup sx={{ gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography>Require password on wake</Typography>
                      <Switch defaultChecked />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography>Save credentials securely</Typography>
                      <Switch defaultChecked />
                    </Box>
                  </FormGroup>
                  <Divider sx={{ my: 3 }} />
                  <Button variant="outlined" color="error">
                    Clear Saved Credentials
                  </Button>
                </CardContent>
              </Card>
            </Box>
          )}

        </Box>
      </Box>
    </Box>
  );
}

// Subcomponents
const ThemeCard = ({ name, active, color, textColor = 'white', accent, onClick }: { name: string, active: boolean, color: string, textColor?: string, accent?: string, onClick: () => void }) => {
  const theme = useTheme();
  return (
    <Box sx={{ width: 100, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }} onClick={onClick}>
      <Box sx={{
        width: '100%', height: 64, bgcolor: color, borderRadius: 2,
        border: active ? `2px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}`,
        p: 1, position: 'relative'
      }}>
        <Box sx={{ width: '100%', height: 8, bgcolor: textColor === 'white' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: 1, mb: 1 }} />
        <Box sx={{ width: '60%', height: 6, bgcolor: accent || (textColor === 'white' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'), borderRadius: 1 }} />
      </Box>
      <Typography variant="caption" sx={{ color: active ? 'primary.main' : 'text.secondary', fontWeight: active ? 'bold' : 'normal' }}>
        {name}
      </Typography>
    </Box>
  );
};

const WallpaperThumb = ({ bg, active, onClick }: { bg: string, active: boolean, onClick: () => void }) => {
  const theme = useTheme();
  return (
    <Box
      onClick={onClick}
      sx={{
        width: 100, height: 60, borderRadius: 2, cursor: 'pointer',
        background: bg, border: active ? `2px solid ${theme.palette.primary.main}` : 'none'
      }}
    />
  );
};
