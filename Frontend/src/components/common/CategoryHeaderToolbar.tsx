import React from 'react';
import { Filter, RefreshCw, Download, Upload, Plus, X } from 'lucide-react';
import { Button } from './Button';

export interface CategoryHeaderToolbarProps {
  icon: React.ReactNode;
  title: string;
  count: number;
  countLabel?: string;
  subtitle: string;

  // Advanced Filter state
  showAdvancedFilter?: boolean;
  onToggleAdvancedFilter?: () => void;
  activeFilterCount?: number;

  // Common Actions
  onRefresh?: () => void;
  onExportExcel?: () => void;
  onImportExcel?: () => void;

  // Primary Action
  addLabel?: string;
  onOpenAdd?: () => void;
  canCreate?: boolean;

  // Filter Panel Content
  filterPanelContent?: React.ReactNode;
  onApplyFilter?: () => void;
  onClearFilter?: () => void;

  // Optional Extra Action Buttons
  extraActions?: React.ReactNode;
}

export const CategoryHeaderToolbar: React.FC<CategoryHeaderToolbarProps> = ({
  icon,
  title,
  count,
  countLabel = 'Mục',
  subtitle,
  showAdvancedFilter = false,
  onToggleAdvancedFilter,
  activeFilterCount = 0,
  onRefresh,
  onExportExcel,
  onImportExcel,
  addLabel,
  onOpenAdd,
  canCreate = true,
  filterPanelContent,
  onApplyFilter,
  onClearFilter,
  extraActions
}) => {
  return (
    <div className="w-full min-w-0 shrink-0 px-3 py-1.5 sm:px-3 sm:py-2 bg-white dark:bg-slate-900 rounded-lg text-slate-900 dark:text-white border border-slate-200/90 dark:border-slate-800 shadow-2xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        
        {/* Title, Badge & Subtitle */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 sm:p-1.5 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 rounded-md border border-indigo-200/80 dark:border-indigo-800/80 shrink-0 [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="font-extrabold text-xs sm:text-sm tracking-tight text-slate-900 dark:text-slate-100 truncate">{title}</h2>
              <span className="px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 text-[10px] rounded-full font-bold shrink-0">
                {count} {countLabel}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-none mt-0.5 truncate">{subtitle}</p>
          </div>
        </div>

        {/* Toolbar Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto min-w-0 justify-start sm:justify-end">
          {onToggleAdvancedFilter && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleAdvancedFilter}
              className={`h-7 px-2.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                activeFilterCount > 0 ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300' : ''
              }`}
              icon={<Filter className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />}
            >
              Bộ Lọc
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-indigo-600 text-white text-[9px] rounded-full font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          )}

          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="h-7 px-2.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              icon={<RefreshCw className="h-3.5 w-3.5 text-indigo-500" />}
            >
              Nạp Lại
            </Button>
          )}

          {onImportExcel && (
            <Button
              variant="outline"
              size="sm"
              onClick={onImportExcel}
              className="h-7 px-2.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              icon={<Upload className="h-3.5 w-3.5 text-emerald-500" />}
            >
              Nhập Excel
            </Button>
          )}

          {onExportExcel && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportExcel}
              className="h-7 px-2.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              icon={<Download className="h-3.5 w-3.5 text-amber-500" />}
            >
              Xuất Excel
            </Button>
          )}

          {extraActions}

          {canCreate && onOpenAdd && addLabel && (
            <Button
              size="sm"
              onClick={onOpenAdd}
              className="h-7 px-3 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs"
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              {addLabel}
            </Button>
          )}
        </div>

      </div>

      {/* Collapsible Advanced Filter Panel */}
      {showAdvancedFilter && filterPanelContent && (
        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 animate-fade-in text-xs space-y-2">
          {filterPanelContent}
          {(onApplyFilter || onClearFilter) && (
            <div className="flex justify-end gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800">
              {onClearFilter && (
                <Button size="sm" variant="outline" onClick={onClearFilter} className="h-7 px-2.5 text-[11px] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="h-3.5 w-3.5 mr-1" /> Xóa bộ lọc
                </Button>
              )}
              {onApplyFilter && (
                <Button size="sm" onClick={onApplyFilter} className="h-7 px-3 text-[11px] font-bold bg-indigo-600 text-white" icon={<Filter className="h-3.5 w-3.5" />}>
                  Áp Dụng Lọc
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
