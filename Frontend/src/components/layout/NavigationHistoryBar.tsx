import React from 'react';
import { History, X, ChevronRight, Home, CheckCircle2, RotateCcw } from 'lucide-react';
import { ModuleCategoryKey, SubMenuKey } from '../../types';
import { NavHistoryItem } from '../../utils/navigationHelper';

interface NavigationHistoryBarProps {
  history: NavHistoryItem[];
  activeCategory: ModuleCategoryKey;
  activeSubMenu: SubMenuKey;
  onSelectStep: (category: ModuleCategoryKey, subKey: SubMenuKey) => void;
  onRemoveStep: (subKey: SubMenuKey, e: React.MouseEvent) => void;
  onClearHistory: () => void;
}

export const NavigationHistoryBar: React.FC<NavigationHistoryBarProps> = ({
  history,
  activeCategory,
  activeSubMenu,
  onSelectStep,
  onRemoveStep,
  onClearHistory
}) => {
  const currentItem = history.find(item => item.subKey === activeSubMenu) || history[0];

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800 px-3 sm:px-6 py-1.5 shadow-2xs flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 text-xs shrink-0 min-w-0 z-10 transition-colors">
      
      {/* Current Location / Breadcrumb Indicator */}
      <div className="flex items-center gap-1.5 min-w-0 max-w-full text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1 font-semibold text-slate-400 text-[11px]">
          <Home className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span className="hidden sm:inline">Hệ Thống</span> ERP
        </span>
        <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600 shrink-0" />
        {currentItem && (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">
              {currentItem.moduleName}
            </span>
            <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600 shrink-0" />
            <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-xs flex items-center gap-1 min-w-0 truncate">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">{currentItem.label}</span>
            </span>
          </div>
        )}
      </div>

      {/* Visited History Steps Tabs List */}
      <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto custom-scrollbar scroll-smooth py-0.5 grow min-w-0 justify-end">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 hidden xl:flex items-center gap-1 mr-1 shrink-0">
          <History className="h-3 w-3 text-indigo-500" />
          Đã xem:
        </span>

        {history.map((step) => {
          const isActive = step.subKey === activeSubMenu;

          return (
            <div
              key={step.subKey}
              onClick={() => onSelectStep(step.category, step.subKey)}
              className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-[11px] font-semibold transition-all cursor-pointer border shrink-0 ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                  : 'bg-[#edf4fb] dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-[#cbdcf0] dark:border-slate-700 hover:bg-[#dbeaf8] dark:hover:bg-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600'
              }`}
            >
              <span className={`text-[9px] font-extrabold px-1 py-0.1 rounded-[5px] ${
                isActive
                  ? 'bg-indigo-700/80 text-indigo-100'
                  : 'bg-[#d8e8f8] dark:bg-slate-700 text-indigo-900 dark:text-slate-300'
              }`}>
                {step.moduleName}
              </span>

              <span className="whitespace-nowrap max-w-[150px] truncate">
                {step.label}
              </span>

              {isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              )}

              {history.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => onRemoveStep(step.subKey, e)}
                  className={`p-0.5 rounded transition-colors ${
                    isActive
                      ? 'hover:bg-indigo-700 text-indigo-200 hover:text-white'
                      : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                  title="Xóa khỏi lịch sử"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          );
        })}

        {history.length > 1 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="text-[10px] font-medium text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0 ml-1"
            title="Xóa toàn bộ lịch sử truy cập"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
};
