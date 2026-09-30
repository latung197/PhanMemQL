import React from 'react';
import { cn } from '../../lib/utils';

export type TabTone = 'indigo' | 'emerald' | 'amber' | 'cyan' | 'purple' | 'blue' | 'rose';

export interface TabItem<K extends string> {
  key: K;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Colour of the active tab. Default indigo. */
  tone?: TabTone;
  hidden?: boolean;
}

interface TabsProps<K extends string> {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
}

const ACTIVE_TONES: Record<TabTone, string> = {
  indigo: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
  emerald: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  amber: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  cyan: 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
  purple: 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  blue: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  rose: 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
};

/** Horizontal tab bar that scrolls on narrow screens. The caller renders the active panel. */
export function Tabs<K extends string>({ items, value, onChange, className }: TabsProps<K>) {
  return (
    <div
      role="tablist"
      className={cn('flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto pb-1 custom-scrollbar', className)}
    >
      {items.filter(item => !item.hidden).map(item => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              'px-3 py-2 text-xs font-bold transition-all rounded-[5px] cursor-pointer flex items-center gap-1.5 shrink-0 border',
              active
                ? cn('font-extrabold', ACTIVE_TONES[item.tone ?? 'indigo'])
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
          >
            {item.icon && <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
