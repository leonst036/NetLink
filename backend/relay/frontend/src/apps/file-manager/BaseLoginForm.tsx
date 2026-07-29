import React, { useState } from 'react';
import { Box, Typography, TextField, Select, MenuItem, Button } from '@mui/material';

interface BaseLoginFormProps {
  initialIp?: string;
  savedLogins: any[];
  protocolName: string; 
  protocolType: 'sftp' | 'smb';
  onConnect: (baseParams: any) => void;
  children?: React.ReactNode;
}

export const FormLabelText = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase', mb: 1, display: 'block' }}>
    {children}
  </Typography>
);

export default function BaseLoginForm({ initialIp, savedLogins, protocolName, protocolType, onConnect, children }: BaseLoginFormProps) {
  const [selectedIp, setSelectedIp] = useState(initialIp || '');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');

  const applyLogin = (e: any) => {
    const login = savedLogins.find(l => l.id === e.target.value);
    if (login) {
      setSelectedIp(login.ip);
      setUsername(login.loginUsername);
      setPassword(login.password);
    }
  };

  const handleConnect = () => {
    onConnect({
      ip: selectedIp || 'localhost',
      username,
      password
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {savedLogins.filter(l => l.type === protocolType).length > 0 && (
        <Box>
          <FormLabelText>Saved Logins</FormLabelText>
          <Select fullWidth size="small" value="" displayEmpty onChange={applyLogin}>
            <MenuItem value="" disabled>Select a saved server...</MenuItem>
            {savedLogins.filter(l => l.type === protocolType).map(l => <MenuItem key={l.id} value={l.id}>{l.name} ({l.ip})</MenuItem>)}
          </Select>
        </Box>
      )}

      <Box>
        <FormLabelText>Target IP / Hostname</FormLabelText>
        <TextField fullWidth size="small" placeholder="e.g. 192.168.1.10" value={selectedIp} onChange={e => setSelectedIp(e.target.value)} />
      </Box>

      {children}

      <Box>
        <FormLabelText>Username</FormLabelText>
        <TextField fullWidth size="small" value={username} onChange={e => setUsername(e.target.value)} />
      </Box>

      <Box>
        <FormLabelText>Password</FormLabelText>
        <TextField fullWidth size="small" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      </Box>

      <Button variant="contained" color="warning" onClick={handleConnect} sx={{ mt: 1, pt: 1.2, pb: 1.2, fontWeight: 'bold' }}>
        Connect {protocolName}
      </Button>
    </Box>
  );
}
