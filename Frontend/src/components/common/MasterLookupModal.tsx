import React, { useState, useMemo } from 'react';
import { Search, Filter, Check, X, CheckSquare, Square, ChevronRight } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import { Pagination } from './Pagination';
import { useLanguage } from '../../context/LanguageContext';

export interface ColumnDef<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: { label: string; value: string }[];
}

export interface MasterLookupModalProps<T extends Record<string, any>> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  data: T[];
  columns: ColumnDef<T>[];
  idField?: keyof T;
  displayField?: keyof T;
  searchFields?: (keyof T | string)[];
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  selectionMode?: 'single' | 'multiple';
  selectedIds?: string[];
  onConfirm: (selectedItems: T[]) => void;
  pageSize?: number;
}

export function MasterLookupModal<T extends Record<string, any>>({
  isOpen,
  onClose,
  title,
  subtitle: subtitleProp,
  data = [],
  columns,
  idField = 'id',
  displayField = 'name',
  searchFields = ['code', 'name', 'title'],
  searchPlaceholder: searchPlaceholderProp,
  filters = [],
  selectionMode = 'single',
  selectedIds = [],
  onConfirm,
  pageSize: initialPageSize = 8
}: MasterLookupModalProps<T>) {
  const { t } = useLanguage();
  const subtitle = subtitleProp ?? t('controls.masterLookup.subtitle');
  const searchPlaceholder = searchPlaceholderProp ?? t('controls.masterLookup.search');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Synchronize initial selected IDs when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setTempSelectedIds(selectedIds);
      setSearchTerm('');
      setCurrentPage(1);
    }
  }, [isOpen, selectedIds]);

  // Filter & Search Logic
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Search term matching
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesSearch = searchFields.some(field => {
          const val = item[field];
          if (val === undefined || val === null) return false;
          return String(val).toLowerCase().includes(query);
        });
        if (!matchesSearch) return false;
      }

      // Dropdown filter matching
      for (const [filterKey, filterVal] of Object.entries(activeFilters)) {
        if (filterVal && filterVal !== 'ALL') {
          if (String(item[filterKey]) !== filterVal) {
            return false;
          }
        }
      }

      return true;
    });
  }, [data, searchTerm, searchFields, activeFilters]);

  // Pagination calculation
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handleToggleSelect = (item: T) => {
    const id = String(item[idField]);
    if (selectionMode === 'single') {
      setTempSelectedIds([id]);
    } else {
      if (tempSelectedIds.includes(id)) {
        setTempSelectedIds(prev => prev.filter(i => i !== id));
      } else {
        setTempSelectedIds(prev => [...prev, id]);
      }
    }
  };

  const handleSelectRowDirectly = (item: T) => {
    onConfirm([item]);
    onClose();
  };

  const handleSelectAllCurrentPage = () => {
    const pageIds = paginatedData.map(item => String(item[idField]));
    const allSelected = pageIds.every(id => tempSelectedIds.includes(id));

    if (allSelected) {
      setTempSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setTempSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleConfirm = () => {
    const selectedMap = new Map(data.map(item => [String(item[idField]), item]));
    const selectedObjects = tempSelectedIds
      .map(id => selectedMap.get(id))
      .filter((item): item is T => Boolean(item));
    onConfirm(selectedObjects);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="4xl">
      <div className="space-y-3.5 text-xs">
        {/* Header Subtitle & Quick Tip */}
        {subtitle && (
          <div className="flex items-center justify-between gap-2 text-slate-500 dark:text-slate-400 -mt-2">
            <p>{subtitle}</p>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded font-medium shrink-0">
              {t('controls.masterLookup.tip')}
            </span>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-[8px] border border-slate-200 dark:border-slate-700">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-8 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-[5px] text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-slate-100 font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Optional Dropdown Filters */}
          {filters.map(filter => (
            <div key={filter.key} className="flex items-center gap-1.5 min-w-[140px]">
              <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={activeFilters[filter.key] || 'ALL'}
                onChange={(e) => {
                  setActiveFilters(prev => ({ ...prev, [filter.key]: e.target.value }));
                  setCurrentPage(1);
                }}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-slate-200 font-medium"
              >
                <option value="ALL">{t('controls.masterLookup.all', { label: filter.label })}</option>
                {filter.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Selected Count & Multi-Select Quick Actions Bar */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Badge variant="indigo" size="sm" className="font-bold">
              {t('controls.masterLookup.selected', { n: tempSelectedIds.length })}
            </Badge>
            {tempSelectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setTempSelectedIds([])}
                className="text-slate-500 hover:text-rose-500 text-[11px] underline cursor-pointer"
              >
                {t('controls.masterLookup.clearAll')}
              </button>
            )}
          </div>

          {selectionMode === 'multiple' && paginatedData.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAllCurrentPage}
              className="text-indigo-600 dark:text-indigo-400 hover:underline text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              {t('controls.masterLookup.selectPage')}
            </button>
          )}
        </div>

        {/* Standard ERP Grid Table */}
        <div className="border border-slate-300 dark:border-slate-700 rounded-[8px] overflow-x-auto overflow-y-auto max-h-[360px] shadow-inner bg-white dark:bg-slate-900 custom-scrollbar">
          <table className="w-full min-w-[600px] text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b-2 border-slate-300 dark:border-slate-700 text-[11px] z-10 uppercase tracking-wider">
              <tr className="divide-x divide-slate-200 dark:divide-slate-700">
                <th className="p-2.5 w-10 text-center bg-slate-200/60 dark:bg-slate-800/80">
                  #
                </th>
                {columns.map(col => (
                  <th key={col.key} className={`p-2.5 ${col.className || ''}`}>
                    {col.label}
                  </th>
                ))}
                <th className="p-2.5 w-24 text-center bg-slate-200/60 dark:bg-slate-800/80">{t('controls.masterLookup.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="p-8 text-center text-slate-400">
                    {t('controls.masterLookup.noResult')}
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => {
                  const id = String(item[idField]);
                  const isSelected = tempSelectedIds.includes(id);

                  return (
                    <tr
                      key={id}
                      onClick={() => handleToggleSelect(item)}
                      onDoubleClick={() => handleSelectRowDirectly(item)}
                      className={`divide-x divide-slate-200 dark:divide-slate-800 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50 dark:bg-indigo-950/60 font-medium' : ''
                      }`}
                    >
                      <td className="p-2 text-center text-slate-400 text-[11px] bg-slate-50/50 dark:bg-slate-800/20">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      {columns.map(col => (
                        <td key={col.key} className={`p-2 ${col.className || ''}`}>
                          {col.render ? col.render(item) : item[col.key]}
                        </td>
                      ))}
                      <td className="p-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectionMode === 'single') {
                              handleSelectRowDirectly(item);
                            } else {
                              handleToggleSelect(item);
                            }
                          }}
                          className={
                            isSelected
                              ? "px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[5px] text-[11px] font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto w-full"
                              : "px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-700 dark:text-slate-200 hover:text-indigo-600 rounded-[5px] text-[11px] font-medium border border-slate-300 dark:border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto w-full"
                          }
                        >
                          <Check className={`h-3 w-3 ${isSelected ? 'block' : 'hidden'}`} />
                          {isSelected ? t('controls.masterLookup.isSelected') : t('controls.masterLookup.select')}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalItems > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 8, 15, 30]}
          />
        )}

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose} size="sm">
            {t('controls.masterLookup.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={tempSelectedIds.length === 0}
            size="sm"
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
          >
            <Check className="h-4 w-4" />
            {t('controls.masterLookup.confirm', { n: tempSelectedIds.length })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
