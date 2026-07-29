import BaseLoginForm from './BaseLoginForm';

interface SftpLoginProps {
  initialIp?: string;
  savedLogins: any[];
  onConnect: (params: any) => void;
}

export default function SftpLogin({ initialIp, savedLogins, onConnect }: SftpLoginProps) {
  return (
    <BaseLoginForm 
      initialIp={initialIp}
      savedLogins={savedLogins}
      protocolName="SFTP"
      protocolType="sftp"
      onConnect={(baseParams) => onConnect({ type: 'connect_sftp', ...baseParams })}
    />
  );
}
