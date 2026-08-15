import React, { useState } from 'react';
import { Box, Avatar } from '@mui/material';
import { User } from 'lucide-react';

interface PlayerAvatarProps {
  name: string;
  size?: number;
  borderRadius?: number | string;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  name,
  size = 40,
  borderRadius = 1.5,
}) => {
  const [imgError, setImgError] = useState(false);

  const cleanName = name?.trim() || 'Steve';
  const avatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(cleanName)}/${size * 2}`;

  if (imgError || !cleanName) {
    return (
      <Avatar
        sx={{
          width: size,
          height: size,
          borderRadius,
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          color: '#10b981',
          fontSize: size * 0.45,
          fontWeight: 700,
        }}
      >
        {cleanName.charAt(0).toUpperCase() || <User size={size * 0.5} />}
      </Avatar>
    );
  }

  return (
    <Box
      component="img"
      src={avatarUrl}
      alt={cleanName}
      onError={() => setImgError(true)}
      sx={{
        width: size,
        height: size,
        borderRadius,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'inline-block',
        imageRendering: 'pixelated',
        objectFit: 'cover',
        flexShrink: 0,
      }}
    />
  );
};
