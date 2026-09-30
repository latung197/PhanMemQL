import React, { useMemo, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { RoleDefinition, UserProfile } from '../../../types';
import { cn } from '../../../lib/utils';
import { EmptyState } from '../../../components/common/StateViews';

interface UserListPanelProps {
  users: UserProfile[];
  roles: RoleDefinition[];
  selectedId?: string;
  onSelect: (user: UserProfile) => void;
}

const selectClass = 'h-7 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 text-[11px] focus:outline-hidden focus:border-indigo-500 cursor-pointer';

export const initials = (name: string) =>
  name.replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(-1)[0]?.charAt(0).toUpperCase() || '?';

/** Searchable list of accounts, filterable by role and status. */
export const UserListPanel: React.FC<UserListPanelProps> = ({ users, roles, selectedId, onSelect }) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked'>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u =>
      (!q || [u.fullName, u.username, u.email, u.department, u.employeeCode].some(v => v?.toLowerCase().includes(q)))
      && (!roleFilter || (roleFilter === '-' ? !u.roleId : u.roleId === roleFilter))
      && (statusFilter === 'all' || (statusFilter === 'locked') === (u.isActive === false)));
  }, [users, search, roleFilter, statusFilter]);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="p-2 space-y-1.5 border-b border-slate-200 dark:border-slate-800">
        <div className="relative">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên, tài khoản, email, mã NV..."
            className="h-7 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-[5px] pl-8 pr-2 text-xs focus:outline-hidden focus:border-indigo-500"
          />
        </div>
        <div className="flex gap-1.5">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={cn(selectClass, 'flex-1 min-w-0')}>
            <option value="">Tất cả vai trò</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            <option value="-">Chưa gán vai trò</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={selectClass}>
            <option value="all">Mọi trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="locked">Đã khóa</option>
          </select>
        </div>
      </div>

      <div className="overflow-y-auto grow custom-scrollbar">
        {filtered.length === 0 && <EmptyState title="Không tìm thấy người dùng" className="py-6" />}
        {filtered.map(u => {
          const active = u.id === selectedId;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelect(u)}
              className={cn(
                'w-full text-left px-3 py-2 flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 transition-colors cursor-pointer',
                active ? 'bg-indigo-50 dark:bg-indigo-950/50 border-l-2 border-l-indigo-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-2 border-l-transparent'
              )}
            >
              <span className={cn('h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                u.isActive === false ? 'bg-slate-200 text-slate-500 dark:bg-slate-700' : 'bg-indigo-600 text-white')}>
                {initials(u.fullName)}
              </span>
              <span className="min-w-0 grow">
                <span className="flex items-center gap-1">
                  <span className={cn('text-xs font-bold truncate', active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-100')}>
                    {u.fullName}
                  </span>
                  {u.isSystemAdmin && <ShieldCheck className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-label="Quản trị viên" />}
                </span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  @{u.username} · {u.role || 'Chưa gán vai trò'}
                </span>
              </span>
              <span className={cn('h-2 w-2 rounded-full shrink-0', u.isActive === false ? 'bg-rose-500' : 'bg-emerald-500')}
                title={u.isActive === false ? 'Đã khóa' : 'Hoạt động'} />
            </button>
          );
        })}
      </div>
      <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
        {filtered.length} / {users.length} người dùng
      </div>
    </div>
  );
};
