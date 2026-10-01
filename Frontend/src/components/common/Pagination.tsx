import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { interpolate } from '../../utils/interpolate';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50]
}) => {
  const { t } = useLanguage();
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 shrink-0 border-t border-slate-200/80 dark:border-slate-800 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
      {/* Items range display & Page size selector */}
      <div className="flex items-center gap-2">
        <span>
          {interpolate(t('controls.pagination.showing'), { range: <strong>{startItem} - {endItem}</strong>, total: <strong>{totalItems}</strong> })}
        </span>

        <div className="flex items-center gap-1 ml-1">
          <span className="text-[10px]">{t('controls.pagination.perPage')}</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-[5px] px-1.5 py-0.5 text-[11px] font-semibold focus:outline-hidden"
          >
            {pageSizeOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
          className="p-1 rounded-[5px] border border-slate-200 dark:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          title={t('controls.pagination.first')}
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1 rounded-[5px] border border-slate-200 dark:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer flex items-center gap-1"
          title={t('controls.pagination.previous')}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <span className="px-2 py-0.5 font-mono font-bold text-[11px] text-slate-800 dark:text-slate-200">
          {currentPage}/{Math.max(1, totalPages)}
        </span>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1 rounded-[5px] border border-slate-200 dark:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer flex items-center gap-1"
          title={t('controls.pagination.next')}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="p-1 rounded-[5px] border border-slate-200 dark:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          title={t('controls.pagination.last')}
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
