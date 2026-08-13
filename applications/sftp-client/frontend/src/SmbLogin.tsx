import { useState } from 'react';
import { Box, TextField } from '@mui/material';
import BaseLoginForm, { FormLabelText } from './BaseLoginForm';

interface SmbLoginProps {
  initialIp?: string;
  savedLogins: any[];
  onConnect: (params: any) => void;
}

export default function SmbLogin({ initialIp, savedLogins, onConnect }: SmbLoginProps) {
  const [share, setShare] = useState('C$');
  const [domain, setDomain] = useState('WORKGROUP');

  const handleConnect = (baseParams: any) => {
    onConnect({
      type: 'connect_smb',
      ...baseParams,
      share: share || 'C$',
      domain: domain || 'WORKGROUP'
    });
  };

  return (
    <BaseLoginForm 
      initialIp={initialIp}
      savedLogins={savedLogins}
      protocolName="SMB"
      protocolType="smb"
      onConnect={handleConnect}
    >
      <Box>
        <FormLabelText>Share Name</FormLabelText>
        <TextField fullWidth size="small" placeholder="e.g. C$ or share" value={share} onChange={e => setShare(e.target.value)} className="fileapp-input" />
      </Box>
      <Box>
        <FormLabelText>Domain / Workgroup</FormLabelText>
        <TextField fullWidth size="small" placeholder="e.g. WORKGROUP" value={domain} onChange={e => setDomain(e.target.value)} className="fileapp-input" />
      </Box>
    </BaseLoginForm>
  );
}
