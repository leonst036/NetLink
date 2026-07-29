import { useState, type ReactNode } from 'react';
import { Rnd } from 'react-rnd';
import { X, Minus, Maximize2 } from 'lucide-react';
import { Box, Paper, IconButton, Typography } from '@mui/material';
import './Window.css';

interface WindowProps {
  id: string;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  isActive: boolean;
  onFocus: () => void;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number | string; height: number | string };
}

export default function Window({
  title,
  icon,
  children,
  onClose,
  onMinimize,
  isMinimized = false,
  isActive,
  onFocus,
  defaultPosition = { x: 50, y: 50 },
  defaultSize = { width: 800, height: 500 }
}: WindowProps) {
  const [size, setSize] = useState<{ width: number | string; height: number | string }>(defaultSize);
  const [position, setPosition] = useState<{ x: number; y: number }>(defaultPosition);
  const [isMaximized, setIsMaximized] = useState(false);
  const [prevSize, setPrevSize] = useState<{ width: number | string; height: number | string }>(defaultSize);
  const [prevPosition, setPrevPosition] = useState<{ x: number; y: number }>(defaultPosition);

  const toggleMaximize = () => {
    if (isMaximized) {
      setSize(prevSize);
      setPosition(prevPosition);
      setIsMaximized(false);
    } else {
      setPrevSize(size);
      setPrevPosition(position);
      setSize({ width: '100%', height: '100%' });
      setPosition({ x: 0, y: 0 });
      setIsMaximized(true);
    }
  };

  return (
    <Rnd
      size={size}
      position={position}
      onDragStop={(_e, d) => {
        if (!isMaximized) {
          setPosition({ x: d.x, y: d.y });
        }
      }}
      onResizeStop={(_e, _direction, ref, _delta, pos) => {
        if (!isMaximized) {
          setSize({
            width: ref.style.width,
            height: ref.style.height,
          });
          setPosition(pos);
        }
      }}
      minWidth={300}
      minHeight={200}
      bounds="parent"
      dragHandleClassName="window-handle"
      disableDragging={isMaximized}
      enableResizing={isMaximized ? {
        top: false, right: false, bottom: false, left: false,
        topRight: false, bottomRight: false, bottomLeft: false, topLeft: false
      } : undefined}
      onMouseDownCapture={onFocus}
      style={{
        zIndex: isActive ? 100 : 10,
        display: isMinimized ? 'none' : 'flex',
        flexDirection: 'column',
      }}
    >
      <Paper
        className={`window-paper ${isMaximized ? 'window-paper-maximized' : 'window-paper-normal'}`}
        elevation={isActive ? 12 : 4}
        style={{
          boxShadow: isActive ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 10px 30px -5px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Window Header */}
        <Box
          className={`window-handle window-header ${isMaximized ? 'window-header-maximized' : 'window-header-normal'}`}
        >
          <Box className="header-title-section">
            {icon}
            <Typography variant="body2" className="header-title-text" color="textPrimary">
              {title}
            </Typography>
          </Box>

          <Box className="header-controls">
            <IconButton className="header-icon-button" size="small" onClick={onMinimize} title="Minimize">
              <Minus size={14} />
            </IconButton>
            <IconButton className="header-icon-button" size="small" onClick={toggleMaximize} title={isMaximized ? "Restore" : "Maximize"}>
              <Maximize2 size={12} />
            </IconButton>
            <IconButton size="small" onClick={onClose} title="Close" color="error">
              <X size={14} />
            </IconButton>
          </Box>
        </Box>

        {/* Window Content */}
        <Box className="window-content">
          {children}
        </Box>
      </Paper>
    </Rnd>
  );
}

