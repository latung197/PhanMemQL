import React from 'react';
import { cn } from '../../lib/utils';

export type TabTone = 'indigo' | 'emerald' | 'amber' | 'cyan' | 'purple' | 'blue' | 'rose';

export interface TabItem<K extends string> {
  key: K;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Kept for compatibility; every active tab uses the brand colour. */
  tone?: TabTone;
  hidden?: boolean;
}

interface TabsProps<K extends string> {
  /** NoInfer: the key type comes from `value` (e.g. a union type of the screen), not from items / onChange. */
  items: TabItem<NoInfer<K>>[];
  value: K;
  onChange: (key: NoInfer<K>) => void;
  className?: string;
}

/** One brand colour for every active tab (minimal UI); `tone` is kept for existing callers only. */
const ACTIVE = 'bg-brand-50 dark:bg-slate-800 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-slate-700';

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
                ? cn('font-extrabold', ACTIVE)
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
