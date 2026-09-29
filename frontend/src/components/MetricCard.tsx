import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  variant?: 'default' | 'rose' | 'emerald' | 'amber';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtext,
  icon,
  variant = 'default'
}) => {
  let borderClass = 'border-slate-200 dark:border-slate-800';
  let iconBg = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';

  if (variant === 'rose') {
    borderClass = 'border-rose-200 dark:border-rose-900/50 bg-gradient-to-br from-white to-rose-50/40 dark:from-slate-900 dark:to-rose-950/20';
    iconBg = 'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300';
  } else if (variant === 'emerald') {
    borderClass = 'border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-br from-white to-emerald-50/40 dark:from-slate-900 dark:to-emerald-950/20';
    iconBg = 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300';
  } else if (variant === 'amber') {
    borderClass = 'border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-white to-amber-50/40 dark:from-slate-900 dark:to-amber-950/20';
    iconBg = 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300';
  }

  return (
    <div className={`p-5 rounded-2xl border ${borderClass} shadow-sm bg-white dark:bg-slate-900 flex items-start justify-between`}>
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{value}</p>
        {subtext && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtext}</p>}
      </div>
      <div className={`p-2.5 rounded-xl ${iconBg}`}>
        {icon}
      </div>
    </div>
  );
};
