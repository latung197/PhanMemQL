import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral';
  colorTheme?: 'indigo' | 'emerald' | 'rose' | 'amber' | 'sky';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  colorTheme = 'indigo'
}) => {
  const themeStyles = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 border-indigo-500',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-500',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border-rose-500',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border-amber-500',
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400 border-sky-500'
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-[9px] border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700">
      <div className="space-y-1">
        <p className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">{title}</p>
        <h4 className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">{value}</h4>
        {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
        {trend && (
          <span className="inline-block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
            {trend}
          </span>
        )}
      </div>

      <div className={`p-3.5 rounded-[7px] shrink-0 ${themeStyles[colorTheme].split(' ')[0]} ${themeStyles[colorTheme].split(' ')[1]}`}>
        {icon}
      </div>

      <div className={`absolute top-0 right-0 h-full w-1 ${themeStyles[colorTheme].split(' ')[4]}`}></div>
    </div>
  );
};
