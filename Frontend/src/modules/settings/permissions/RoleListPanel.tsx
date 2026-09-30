import React, { useMemo, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { RoleDefinition } from '../../../types';
import { cn } from '../../../lib/utils';
import { EmptyState } from '../../../components/common/StateViews';

interface RoleListPanelProps {
  roles: RoleDefinition[];
  userCounts: Record<string, number>;
  selectedId?: string;
  onSelect: (role: RoleDefinition) => void;
}

export const RoleListPanel: React.FC<RoleListPanelProps> = ({ roles, userCounts, selectedId, onSelect }) => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roles.filter(r => !q || [r.name, r.code, r.description].some(v => v?.toLowerCase().includes(q)));
  }, [roles, search]);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="p-2 border-b border-slate-200 dark:border-slate-800">
        <div className="relative">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm mã hoặc tên vai trò..."
            className="h-7 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-[5px] pl-8 pr-2 text-xs focus:outline-hidden focus:border-indigo-500"
          />
        </div>
      </div>
      <div className="overflow-y-auto grow custom-scrollbar">
        {filtered.length === 0 && <EmptyState title="Không tìm thấy vai trò" className="py-6" />}
        {filtered.map(r => {
          const active = r.id === selectedId;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r)}
              className={cn(
                'w-full text-left px-3 py-2 border-b border-slate-100 dark:border-slate-800 transition-colors cursor-pointer',
                active ? 'bg-indigo-50 dark:bg-indigo-950/50 border-l-2 border-l-indigo-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-2 border-l-transparent'
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">{r.code}</span>
                  <span className={cn('text-xs font-bold truncate', active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-100')}>{r.name}</span>
                  {r.isSystemRole && <ShieldCheck className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                </span>
                <span className="text-[10px] text-slate-500 shrink-0">{userCounts[r.id] ?? 0} người</span>
              </span>
              {r.description && <span className="block text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{r.description}</span>}
            </button>
          );
        })}
      </div>
      <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
        {filtered.length} / {roles.length} vai trò
      </div>
    </div>
  );
};
