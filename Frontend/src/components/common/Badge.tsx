import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Status pill. Meaning colours: success (emerald), warning (amber), danger (rose); info / indigo = brand;
 * slate / neutral / secondary / outline = gray. The colour-named aliases are accepted for older screens.
 */
export type BadgeVariant =
  | 'success' | 'warning' | 'danger' | 'info' | 'slate' | 'indigo'
  | 'neutral' | 'secondary' | 'outline' | 'emerald' | 'amber' | 'rose' | 'purple';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

const SUCCESS = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
const WARNING = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
const DANGER = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
const BRAND = 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-800';
const GRAY = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';

const STYLES: Record<BadgeVariant, string> = {
  success: SUCCESS, emerald: SUCCESS,
  warning: WARNING, amber: WARNING,
  danger: DANGER, rose: DANGER,
  info: BRAND, indigo: BRAND, purple: BRAND,
  slate: GRAY, neutral: GRAY, secondary: GRAY,
  outline: 'bg-transparent text-slate-600 border-slate-300 dark:text-slate-300 dark:border-slate-600'
};

const SIZES = {
  sm: 'px-2.5 py-0.5 text-[11px]',
  md: 'px-3 py-1 text-xs'
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'info', size = 'sm', className, ...props }) => (
  <span {...props} className={cn('inline-flex items-center gap-1.5 font-bold rounded-full border', STYLES[variant], SIZES[size], className)}>
    {children}
  </span>
);
