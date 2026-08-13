import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  unit?: string;
  subtitle?: string;
  iconName: string;
  colorTheme?: 'cyan' | 'indigo' | 'emerald' | 'amber' | 'rose';
  trend?: string;
}

// Card component for telemetry metrics
export default function MetricCard({
  title,
  value,
  unit,
  subtitle,
  iconName,
  colorTheme = 'cyan',
  trend
}: MetricCardProps) {
  return (
    <div className="tm-glass-card tm-metric-card">
      <div className="tm-metric-header">
        <span className="tm-metric-title">{title}</span>
        <div className={`tm-metric-icon ${colorTheme}`}>
          <span className="material-symbols-outlined">{iconName}</span>
        </div>
      </div>

      <div>
        <div className="tm-metric-val">
          {value} {unit && <span style={{ fontSize: '0.8rem', color: 'var(--tm-text-muted)', fontWeight: 500 }}>{unit}</span>}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          {subtitle && <span className="tm-metric-sub">{subtitle}</span>}
          {trend && <span className="tm-metric-sub" style={{ color: 'var(--tm-emerald)' }}>{trend}</span>}
        </div>
      </div>
    </div>
  );
}
