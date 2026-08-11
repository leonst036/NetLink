import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  unit?: string;
  subtitle?: string;
  icon: LucideIcon;
  colorTheme?: 'cyan' | 'indigo' | 'emerald' | 'amber' | 'rose';
  trend?: string;
}

// Card component for telemetry metrics
export default function MetricCard({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  colorTheme = 'cyan',
  trend
}: MetricCardProps) {
  const themeClasses = {
    cyan: 'border-cyan-500/20 text-cyan-400 bg-cyan-500/10',
    indigo: 'border-indigo-500/20 text-indigo-400 bg-indigo-500/10',
    emerald: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10',
    amber: 'border-amber-500/20 text-amber-400 bg-amber-500/10',
    rose: 'border-rose-500/20 text-rose-400 bg-rose-500/10'
  };

  return (
    <div className="glass-panel flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-lg border ${themeClasses[colorTheme]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-slate-100 font-mono tracking-tight">{value}</span>
          {unit && <span className="text-xs font-medium text-slate-400">{unit}</span>}
        </div>
        
        <div className="flex items-center justify-between mt-1 text-xs">
          {subtitle && <span className="text-slate-400">{subtitle}</span>}
          {trend && <span className="text-emerald-400 font-medium ml-auto">{trend}</span>}
        </div>
      </div>
    </div>
  );
}
