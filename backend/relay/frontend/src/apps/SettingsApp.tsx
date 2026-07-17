import React, { useState, useEffect } from 'react';
import { User, Users, Monitor, Info, Shield, ChevronRight, Key, Plus, Trash2, Save, CheckSquare, Square } from 'lucide-react';

type TabId = 'general' | 'appearance' | 'logins' | 'security' | 'about' | 'users';

interface SettingsAppProps {
  token: string;
}

export default function SettingsApp({ token }: SettingsAppProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');

  // Load functional settings from localStorage
  const [username, setUsername] = useState(() => localStorage.getItem('netlink_username') || 'Admin');
  const [wallpaper, setWallpaper] = useState(() => localStorage.getItem('netlink_wallpaper') || 'default');
  const [theme, setTheme] = useState(() => localStorage.getItem('netlink_theme') || 'Dark');

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
    { id: 'general', label: 'General', icon: <User size={18} /> },
    { id: 'appearance', label: 'Appearance', icon: <Monitor size={18} /> },
    { id: 'logins', label: 'Server Logins', icon: <Key size={18} /> },
    { id: 'security', label: 'Security', icon: <Shield size={18} /> },
    { id: 'about', label: 'About NetLink', icon: <Info size={18} /> },
  ];

  if (canManageUsers) {
    tabs.splice(3, 0, { id: 'users', label: 'User Management', icon: <Users size={18} /> });
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
    <div style={{
      display: 'flex',
      height: '100%',
      background: '#090d1a',
      color: '#e2e8f0',
      fontFamily: '"Inter", -apple-system, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Sidebar */}
      <div style={{
        width: '240px',
        background: 'rgba(15, 23, 42, 0.4)',
        borderRight: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 0'
      }}>
        <div style={{ padding: '0 20px', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc' }}>Settings</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 12px' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                background: activeTab === tab.id ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '0.9rem',
                fontWeight: activeTab === tab.id ? 600 : 500,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.color = '#cbd5e1';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#94a3b8';
                }
              }}
            >
              <div style={{ opacity: activeTab === tab.id ? 1 : 0.7 }}>
                {tab.icon}
              </div>
              <span style={{ flex: 1 }}>{tab.label}</span>
              {activeTab === tab.id && <ChevronRight size={16} />}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        padding: '32px 40px',
        overflowY: 'auto',
        background: 'radial-gradient(circle at top right, rgba(15, 23, 42, 0.5) 0%, transparent 50%)'
      }}>
        <div style={{ maxWidth: '600px' }}>
          {activeTab === 'general' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 24px 0', color: '#f8fafc' }}>General Settings</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <SettingSection title="User Profile">
                  <SettingRow label="Username">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => updateSetting('netlink_username', e.target.value, setUsername)}
                      style={inputStyle}
                    />
                  </SettingRow>
                  <SettingRow label="Language">
                    <select style={selectStyle}>
                      <option>English (US)</option>
                      <option>German (DE)</option>
                      <option>French (FR)</option>
                    </select>
                  </SettingRow>
                </SettingSection>

                <SettingSection title="Desktop Behavior">
                  <SettingToggle label="Show desktop icons" defaultChecked={true} />
                  <SettingToggle label="Enable window animations" defaultChecked={true} />
                  <SettingToggle label="Play notification sounds" defaultChecked={false} />
                  <SettingToggle 
                      label="Enable debug mode (VNC FPS/Latency)" 
                      defaultChecked={localStorage.getItem('netlink_debug') === 'true'}
                      onChange={(val) => {
                          localStorage.setItem('netlink_debug', val.toString());
                          window.dispatchEvent(new Event('settingsChange'));
                      }}
                  />
                </SettingSection>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 24px 0', color: '#f8fafc' }}>Appearance</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <SettingSection title="Theme">
                  <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                    <div onClick={() => updateSetting('netlink_theme', 'Dark', setTheme)}>
                      <ThemeCard name="Dark" active={theme === 'Dark'} color="#0f172a" />
                    </div>
                    <div onClick={() => updateSetting('netlink_theme', 'Light', setTheme)}>
                      <ThemeCard name="Light" active={theme === 'Light'} color="#f8fafc" textColor="#0f172a" />
                    </div>
                    <div onClick={() => updateSetting('netlink_theme', 'Hacker', setTheme)}>
                      <ThemeCard name="Hacker" active={theme === 'Hacker'} color="#000000" accent="#22c55e" />
                    </div>
                  </div>
                </SettingSection>

                <SettingSection title="Wallpaper">
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
                    <div
                      onClick={() => updateSetting('netlink_wallpaper', 'default', setWallpaper)}
                      style={{ ...wallpaperThumbStyle, background: 'url("https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=200&auto=format&fit=crop") center/cover', border: wallpaper === 'default' ? '2px solid #38bdf8' : 'none' }}
                    />
                    <div
                      onClick={() => updateSetting('netlink_wallpaper', 'wp1', setWallpaper)}
                      style={{ ...wallpaperThumbStyle, background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)', border: wallpaper === 'wp1' ? '2px solid #38bdf8' : 'none' }}
                    />
                    <div
                      onClick={() => updateSetting('netlink_wallpaper', 'wp2', setWallpaper)}
                      style={{ ...wallpaperThumbStyle, background: 'linear-gradient(135deg, #4c1d95 0%, #0f172a 100%)', border: wallpaper === 'wp2' ? '2px solid #38bdf8' : 'none' }}
                    />
                    <div
                      onClick={() => updateSetting('netlink_wallpaper', 'wp3', setWallpaper)}
                      style={{ ...wallpaperThumbStyle, background: 'linear-gradient(135deg, #064e3b 0%, #0f172a 100%)', border: wallpaper === 'wp3' ? '2px solid #38bdf8' : 'none' }}
                    />
                    <div
                      onClick={() => updateSetting('netlink_wallpaper', 'solid', setWallpaper)}
                      style={{ ...wallpaperThumbStyle, background: '#090d1a', border: wallpaper === 'solid' ? '2px solid #38bdf8' : '1px dashed rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                      Solid
                    </div>
                  </div>
                </SettingSection>

                <SettingSection title="Display Settings">
                  <SettingRow label="UI Scale">
                    <select style={selectStyle}>
                      <option>100% (Default)</option>
                      <option>125%</option>
                      <option>150%</option>
                    </select>
                  </SettingRow>
                </SettingSection>
              </div>
            </div>
          )}


          {activeTab === 'logins' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 24px 0' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, color: '#f8fafc' }}>Server Logins</h3>
                <button
                  onClick={() => setEditingLogin({ id: '', name: 'New Server', ip: '', port: '22', loginUsername: 'root', password: '', type: 'ssh' })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: '#38bdf8', color: '#0f172a', border: 'none',
                    padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
                    fontSize: '0.85rem', fontWeight: 600
                  }}
                >
                  <Plus size={16} /> Add Login
                </button>
              </div>

              {editingLogin ? (
                <SettingSection title="Edit Server Login">
                  <SettingRow label="Name">
                    <input type="text" value={editingLogin.name} onChange={e => setEditingLogin({ ...editingLogin, name: e.target.value })} style={inputStyle} placeholder="My Server" />
                  </SettingRow>
                  <SettingRow label="IP Address">
                    <input type="text" value={editingLogin.ip} onChange={e => setEditingLogin({ ...editingLogin, ip: e.target.value })} style={inputStyle} placeholder="192.168.1.1" />
                  </SettingRow>
                  <SettingRow label="Port">
                    <input type="text" value={editingLogin.port} onChange={e => setEditingLogin({ ...editingLogin, port: e.target.value })} style={inputStyle} placeholder="22" />
                  </SettingRow>
                  <SettingRow label="Username">
                    <input type="text" value={editingLogin.loginUsername} onChange={e => setEditingLogin({ ...editingLogin, loginUsername: e.target.value })} style={inputStyle} placeholder="root" />
                  </SettingRow>
                  <SettingRow label="Password">
                    <input type="password" value={editingLogin.password} onChange={e => setEditingLogin({ ...editingLogin, password: e.target.value })} style={inputStyle} placeholder="password" />
                  </SettingRow>
                  <SettingRow label="Protocol">
                    <select value={editingLogin.type} onChange={e => setEditingLogin({ ...editingLogin, type: e.target.value })} style={selectStyle}>
                      <option value="ssh">SSH</option>
                      <option value="vnc">VNC</option>
                      <option value="sftp">SFTP</option>
                    </select>
                  </SettingRow>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button onClick={saveLogin} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                      <Save size={16} /> Save
                    </button>
                    <button onClick={() => setEditingLogin(null)} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      Cancel
                    </button>
                  </div>
                </SettingSection>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {logins.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#64748b', background: 'rgba(30, 41, 59, 0.3)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                      No saved logins yet. Click "Add Login" to create one.
                    </div>
                  ) : (
                    logins.map(login => (
                      <div key={login.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '12px' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '1.05rem', marginBottom: '4px' }}>{login.name} <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', borderRadius: '4px', marginLeft: '8px', verticalAlign: 'middle', textTransform: 'uppercase' }}>{login.type}</span></div>
                          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{login.loginUsername}@{login.ip}:{login.port}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => setEditingLogin(login)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>Edit</button>
                          <button onClick={() => deleteLogin(login.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && canManageUsers && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 24px 0' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, color: '#f8fafc' }}>User Management</h3>
                <button
                  onClick={() => setEditingUser({ username: '', password: '', role: 'user', permissions: [] })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: '#38bdf8', color: '#0f172a', border: 'none',
                    padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
                    fontSize: '0.85rem', fontWeight: 600
                  }}
                >
                  <Plus size={16} /> Add User
                </button>
              </div>

              {editingUser ? (
                <SettingSection title={usersList.find(u => u.username === editingUser.username) ? "Edit User" : "New User"}>
                  <SettingRow label="Username">
                    <input type="text" value={editingUser.username} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })} style={inputStyle} placeholder="john_doe" disabled={!!usersList.find(u => u.username === editingUser.username)} />
                  </SettingRow>
                  <SettingRow label={usersList.find(u => u.username === editingUser.username) ? "New Password" : "Password"}>
                    <input type="password" value={editingUser.password} onChange={e => setEditingUser({ ...editingUser, password: e.target.value })} style={inputStyle} placeholder={usersList.find(u => u.username === editingUser.username) ? "(Leave blank to keep current)" : "Secret Password"} />
                  </SettingRow>

                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '0.95rem', color: '#cbd5e1', marginBottom: '12px' }}>Permissions</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {ALL_PERMISSIONS.map(perm => {
                        const hasPerm = editingUser.permissions?.includes(perm.id);
                        return (
                          <div
                            key={perm.id}
                            onClick={() => togglePermission(perm.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                          >
                            {hasPerm ? <CheckSquare size={18} color="#38bdf8" /> : <Square size={18} color="#64748b" />}
                            <span style={{ fontSize: '0.9rem', color: hasPerm ? '#f8fafc' : '#94a3b8' }}>{perm.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button onClick={saveUser} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                      <Save size={16} /> Save
                    </button>
                    <button onClick={() => setEditingUser(null)} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      Cancel
                    </button>
                  </div>
                </SettingSection>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {usersList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#64748b', background: 'rgba(30, 41, 59, 0.3)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                      No users found.
                    </div>
                  ) : (
                    usersList.map(user => (
                      <div key={user.username} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '12px' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '1.05rem', marginBottom: '4px' }}>
                            {user.username}
                            {user.role === 'admin' && <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '4px', marginLeft: '8px', verticalAlign: 'middle', textTransform: 'uppercase' }}>Admin</span>}
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{user.permissions?.length || 0} Permissions Granted</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => setEditingUser(user)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>Edit</button>
                          <button onClick={() => deleteUser(user.username)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 24px 0', color: '#f8fafc' }}>Security Settings</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <SettingSection title="Authentication">
                  <SettingToggle label="Require password on wake" defaultChecked={true} />
                  <SettingToggle label="Save credentials securely" defaultChecked={true} />

                  <div style={{ marginTop: '16px' }}>
                    <button style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 500
                    }}>
                      Clear Saved Credentials
                    </button>
                  </div>
                </SettingSection>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.5)'
                }}>
                  <Monitor size={32} color="white" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 4px 0', color: '#f8fafc' }}>NetLink</h3>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>Version 1.0.0-beta</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <SettingSection title="System Information">
                  <InfoRow label="Client Environment" value="Browser (Web Platform)" />
                  <InfoRow label="Build Date" value={new Date().toLocaleDateString()} />
                  <InfoRow label="License" value="MIT License" />
                </SettingSection>

                <SettingSection title="Updates">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontWeight: 500, color: '#f8fafc', marginBottom: '4px' }}>NetLink is up to date</div>
                      <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Last checked: Just now</div>
                    </div>
                    <button style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 500
                    }}>
                      Check for Updates
                    </button>
                  </div>
                </SettingSection>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Components for Settings UI

const SettingSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div style={{
    background: 'rgba(30, 41, 59, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    overflow: 'hidden'
  }}>
    <div style={{
      padding: '12px 20px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      background: 'rgba(15, 23, 42, 0.4)',
      fontSize: '0.85rem',
      fontWeight: 600,
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    }}>
      {title}
    </div>
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {children}
    </div>
  </div>
);

const SettingRow = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px' }}>
    <span style={{ fontSize: '0.95rem', color: '#cbd5e1' }}>{label}</span>
    <div style={{ flexShrink: 0, width: '200px' }}>{children}</div>
  </div>
);

const SettingToggle = ({ label, defaultChecked, onChange }: { label: string, defaultChecked: boolean, onChange?: (val: boolean) => void }) => {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
      onClick={() => {
        const newChecked = !checked;
        setChecked(newChecked);
        if (onChange) onChange(newChecked);
      }}
    >
      <span style={{ fontSize: '0.95rem', color: '#cbd5e1', userSelect: 'none' }}>{label}</span>
      <div style={{
        width: '44px',
        height: '24px',
        background: checked ? '#38bdf8' : 'rgba(255,255,255,0.1)',
        borderRadius: '12px',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0
      }}>
        <div style={{
          width: '18px',
          height: '18px',
          background: 'white',
          borderRadius: '50%',
          position: 'absolute',
          top: '3px',
          left: checked ? '23px' : '3px',
          transition: 'left 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }} />
      </div>
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string, value: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
    <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{label}</span>
    <span style={{ color: '#f8fafc', fontSize: '0.9rem', fontWeight: 500 }}>{value}</span>
  </div>
);

const ThemeCard = ({ name, active, color, textColor = 'white', accent }: { name: string, active: boolean, color: string, textColor?: string, accent?: string }) => (
  <div style={{
    width: '100px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px'
  }}>
    <div style={{
      width: '100%',
      height: '64px',
      background: color,
      borderRadius: '8px',
      border: active ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      padding: '8px',
      boxShadow: active ? '0 0 15px rgba(56, 189, 248, 0.3)' : 'none',
      position: 'relative'
    }}>
      {/* Mock UI elements */}
      <div style={{ width: '100%', height: '8px', background: textColor === 'white' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: '4px', marginBottom: '8px' }} />
      <div style={{ width: '60%', height: '6px', background: accent || (textColor === 'white' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'), borderRadius: '3px' }} />
    </div>
    <span style={{ fontSize: '0.85rem', color: active ? '#38bdf8' : '#94a3b8', fontWeight: active ? 600 : 400 }}>
      {name}
    </span>
  </div>
);

// Shared Styles
const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  background: 'rgba(15, 23, 42, 0.6)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '6px',
  color: 'white',
  fontSize: '0.9rem',
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box' as const
};

const selectStyle = {
  ...inputStyle,
  appearance: 'none' as const,
  cursor: 'pointer'
};

const wallpaperThumbStyle = {
  width: '100px',
  height: '60px',
  borderRadius: '8px',
  cursor: 'pointer',
  transition: 'transform 0.2s',
  boxSizing: 'border-box' as const
};
