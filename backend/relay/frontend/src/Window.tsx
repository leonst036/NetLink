import type { ReactNode } from 'react';
import { Rnd } from 'react-rnd';
import { X, Minus, Maximize2 } from 'lucide-react';

interface WindowProps {
  id: string;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  onClose: () => void;
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
  isActive,
  onFocus,
  defaultPosition = { x: 50, y: 50 },
  defaultSize = { width: 800, height: 500 }
}: WindowProps) {
  return (
    <Rnd
      default={{
        ...defaultPosition,
        ...defaultSize,
      }}
      minWidth={300}
      minHeight={200}
      bounds="parent"
      dragHandleClassName="window-handle"
      onMouseDownCapture={onFocus}
      style={{
        zIndex: isActive ? 100 : 10,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: isActive
          ? '0 0 30px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.1)'
          : '0 10px 20px rgba(0,0,0,0.5)',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        transition: 'box-shadow 0.2s',
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
          cursor: 'grab',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontSize: '0.9rem', fontWeight: 500 }}>
          {icon}
          <span>{title}</span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={btnStyle} title="Minimize"><Minus size={14} /></button>
          <button style={btnStyle} title="Maximize"><Maximize2 size={12} /></button>
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
