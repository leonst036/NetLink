import { useState, type ReactNode } from 'react';
import { Rnd } from 'react-rnd';
import { X, Minus, Maximize2 } from 'lucide-react';

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
      onDragStop={(e, d) => {
        if (!isMaximized) {
          setPosition({ x: d.x, y: d.y });
        }
      }}
      onResizeStop={(e, direction, ref, delta, pos) => {
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
        borderRadius: isMaximized ? '0px' : '12px',
        overflow: 'hidden',
        boxShadow: isActive
          ? '0 0 30px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.1)'
          : '0 10px 20px rgba(0,0,0,0.5)',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(10px)',
        border: isMaximized ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
        transition: 'box-shadow 0.2s, border-radius 0.2s',
      }}
    >
      {/* Window Header */}
      <div
        className="window-handle"
        style={{
          height: '40px',
          background: 'rgba(2, 6, 23, 0.8)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 15px',
          cursor: isMaximized ? 'default' : 'grab',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontSize: '0.9rem', fontWeight: 500 }}>
          {icon}
          <span>{title}</span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onMinimize} style={btnStyle} title="Minimize"><Minus size={14} /></button>
          <button onClick={toggleMaximize} style={btnStyle} title={isMaximized ? "Restore" : "Maximize"}><Maximize2 size={12} /></button>
          <button onClick={onClose} style={{ ...btnStyle, color: '#ef4444' }} title="Close"><X size={14} /></button>
        </div>
      </div>

      {/* Window Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>
    </Rnd>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#94a3b8',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px',
  borderRadius: '4px',
  transition: 'all 0.2s'
};
