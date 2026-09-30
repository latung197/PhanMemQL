import React from 'react';
import { Layers } from 'lucide-react';
import { SubMenuKey, UserProfile } from '../../types';

export interface ModuleNavItem {
  subKey: SubMenuKey;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface ModuleNavGroup {
  id: 'danh_muc' | 'chung_tu' | 'bao_cao';
  title: string;
  badgeText: string;
  icon: React.ReactNode;
  items: ModuleNavItem[];
}

interface ModuleHeaderProps {
  moduleTitle: string;
  moduleDescription: string;
  moduleIcon?: React.ReactNode;
  activeSubKey: SubMenuKey;
  groups?: ModuleNavGroup[];
  onSelectSubKey?: (subKey: SubMenuKey) => void;
  currentUser?: UserProfile;
}

export const ModuleHeader: React.FC<ModuleHeaderProps> = ({
  moduleTitle,
  moduleDescription,
  moduleIcon,
  activeSubKey,
  groups,
  onSelectSubKey,
  currentUser
}) => {
  // Find current active item title if groups is passed
  let activeItemLabel = '';
  if (groups) {
    for (const grp of groups) {
      const found = grp.items.find(i => i.subKey === activeSubKey);
      if (found) {
        activeItemLabel = found.label;
        break;
      }
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[9px] p-4 sm:p-5 shadow-xs space-y-2 mb-4">
      {/* Title & Description Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-[7px] border border-indigo-100 dark:border-indigo-900/50 shrink-0">
            {moduleIcon || <Layers className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              {moduleTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {moduleDescription}
            </p>
          </div>
        </div>

        {/* Active Screen Tag */}
        {activeItemLabel && (
          <div className="text-right hidden sm:block shrink-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Màn hình hiện tại</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {activeItemLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
