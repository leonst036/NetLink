import React, { useState } from 'react';
import { User, Monitor, Wifi, Info, Shield, Bell, ChevronRight } from 'lucide-react';

type TabId = 'general' | 'appearance' | 'network' | 'security' | 'about';

export default function SettingsApp() {
  const [activeTab, setActiveTab] = useState<TabId>('general');

  const tabs = [
    { id: 'general', label: 'General', icon: <User size={18} /> },
    { id: 'appearance', label: 'Appearance', icon: <Monitor size={18} /> },
    { id: 'network', label: 'Network & API', icon: <Wifi size={18} /> },
    { id: 'security', label: 'Security', icon: <Shield size={18} /> },
    { id: 'about', label: 'About NetLink', icon: <Info size={18} /> },
  ];

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
                    <input type="text" defaultValue="Admin" style={inputStyle} />
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
                    <ThemeCard name="Dark" active={true} color="#0f172a" />
                    <ThemeCard name="Light" active={false} color="#f8fafc" textColor="#0f172a" />
                    <ThemeCard name="Hacker" active={false} color="#000000" accent="#22c55e" />
                  </div>
                </SettingSection>

                <SettingSection title="Wallpaper">
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
                    <div style={{ ...wallpaperThumbStyle, background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)', border: '2px solid #38bdf8' }} />
                    <div style={{ ...wallpaperThumbStyle, background: 'linear-gradient(135deg, #4c1d95 0%, #0f172a 100%)' }} />
                    <div style={{ ...wallpaperThumbStyle, background: 'linear-gradient(135deg, #064e3b 0%, #0f172a 100%)' }} />
                    <div style={{ ...wallpaperThumbStyle, background: '#090d1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', border: '1px dashed rgba(255,255,255,0.2)' }}>
                      + Custom
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

          {activeTab === 'network' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 24px 0', color: '#f8fafc' }}>Network & API</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <SettingSection title="Relay Server Configuration">
                  <SettingRow label="Default Host">
                    <input type="text" defaultValue="localhost" style={inputStyle} />
                  </SettingRow>
                  <SettingRow label="WebSocket Port">
                    <input type="number" defaultValue={4536} style={inputStyle} />
                  </SettingRow>
                </SettingSection>

                <SettingSection title="Connection Defaults">
                  <SettingRow label="Default SSH Port">
                    <input type="number" defaultValue={22} style={inputStyle} />
                  </SettingRow>
                  <SettingRow label="Default VNC Port">
                    <input type="number" defaultValue={5900} style={inputStyle} />
                  </SettingRow>
                  <SettingToggle label="Auto-connect on startup" defaultChecked={false} />
                  <SettingToggle label="Use secure WebSocket (wss://)" defaultChecked={true} />
                </SettingSection>
              </div>
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

const SettingToggle = ({ label, defaultChecked }: { label: string, defaultChecked: boolean }) => {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div 
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
      onClick={() => setChecked(!checked)}
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
