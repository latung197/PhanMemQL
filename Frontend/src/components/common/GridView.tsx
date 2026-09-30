import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  CheckSquare,
  Square,
  MinusSquare,
  Inbox,
  RefreshCw,
  Plus
} from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import { Badge } from './Badge';
import { SearchInput } from './SearchInput';
import { Pagination } from './Pagination';
import { Checkbox } from './Checkbox';

export interface GridViewColumn<T> {
  key: string;
  header?: React.ReactNode;
  title?: React.ReactNode; // Alias for header
  accessor?: (item: T) => any;
  render?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  sortKey?: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  headerClassName?: string;
  className?: string;
  hidden?: boolean;
}

export type GridColumnDef<T> = GridViewColumn<T>;

export interface GridViewBatchAction<T> {
  label: string;
  icon?: React.ReactNode;
  onClick: (selectedItems: T[], selectedIds: (string | number)[]) => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'emerald';
}

export interface GridViewProps<T> {
  data: T[];
  columns: GridViewColumn<T>[];
  getItemId?: (item: T, index: number) => string | number;
  keyExtractor?: (item: T, index: number) => string | number; // Alias for getItemId

  // Header / Title banner
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  primaryAction?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'emerald' | 'amber' | 'rose';
  };

  // Search & Filter toolbar
  searchable?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  toolbarFilters?: React.ReactNode;
  toolbarActions?: React.ReactNode;

  // Sorting
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnKey: string, direction: 'asc' | 'desc') => void;

  // Selection
  selectable?: boolean;
  selectedIds?: (string | number)[];
  onSelectionChange?: (selectedIds: (string | number)[]) => void;
  batchActions?: GridViewBatchAction<T>[];

  // Pagination
  paginated?: boolean;
  currentPage?: number;
  pageSize?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];

  // Row Customization
  showIndex?: boolean;
  indexHeader?: string;
  actions?: (item: T, index: number) => React.ReactNode;
  actionsHeader?: string;
  onRowClick?: (item: T, index: number) => void;
  rowClassName?: (item: T, index: number) => string;

  // States & Layout
  loading?: boolean;
  emptyText?: string;
  emptyIcon?: React.ReactNode;
  emptyAction?: React.ReactNode;
  dense?: boolean;
  hoverable?: boolean;
  striped?: boolean;
  className?: string;
}

export function GridView<T extends Record<string, any>>({
  data = [],
  columns = [],
  getItemId: customGetItemId,
  keyExtractor,

  title,
  subtitle,
  icon,
  badge,
  primaryAction,

  searchable = true,
  searchValue: controlledSearchValue,
  onSearchChange: controlledOnSearchChange,
  searchPlaceholder = 'Tìm kiếm dữ liệu...',
  toolbarFilters,
  toolbarActions,

  sortColumn: controlledSortColumn,
  sortDirection: controlledSortDirection = 'asc',
  onSort: controlledOnSort,

  selectable = false,
  selectedIds: controlledSelectedIds,
  onSelectionChange: controlledOnSelectionChange,
  batchActions = [],

  paginated = true,
  currentPage: controlledCurrentPage,
  pageSize: controlledPageSize,
  totalItems: controlledTotalItems,
  onPageChange: controlledOnPageChange,
  onPageSizeChange: controlledOnPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50, 100],

  showIndex = true,
  indexHeader = 'STT',
  actions,
  actionsHeader = 'Thao Tác',
  onRowClick,
  rowClassName,

  loading = false,
  emptyText = 'Chưa có dữ liệu. Hãy thêm mới hoặc thay đổi bộ lọc.',
  emptyIcon,
  emptyAction,
  dense = false,
  hoverable = true,
  striped = false,
  className = ''
}: GridViewProps<T>) {
  const getItemId = customGetItemId || keyExtractor || ((item: any, index: number) => item?.id ?? item?.code ?? index);

  // Local states for uncontrolled usage
  const [localSearchValue, setLocalSearchValue] = useState('');
  const [localSortColumn, setLocalSortColumn] = useState<string | undefined>(undefined);
  const [localSortDirection, setLocalSortDirection] = useState<'asc' | 'desc'>('asc');
  const [localSelectedIds, setLocalSelectedIds] = useState<(string | number)[]>([]);
  const [localCurrentPage, setLocalCurrentPage] = useState(1);
  const [localPageSize, setLocalPageSize] = useState(10);

  // Determine controlled vs uncontrolled
  const isSearchControlled = controlledSearchValue !== undefined;
  const searchValue = isSearchControlled ? controlledSearchValue : localSearchValue;
  const handleSearchChange = (val: string) => {
    if (isSearchControlled) {
      controlledOnSearchChange?.(val);
    } else {
      setLocalSearchValue(val);
      setLocalCurrentPage(1);
    }
  };

  const isSortControlled = controlledSortColumn !== undefined;
  const sortColumn = isSortControlled ? controlledSortColumn : localSortColumn;
  const sortDirection = isSortControlled ? controlledSortDirection : localSortDirection;

  const handleSortClick = (col: GridViewColumn<T>) => {
    if (!col.sortable) return;
    const key = col.sortKey || col.key;
    let nextDir: 'asc' | 'desc' = 'asc';
    if (sortColumn === key) {
      nextDir = sortDirection === 'asc' ? 'desc' : 'asc';
    }
    if (isSortControlled) {
      controlledOnSort?.(key, nextDir);
    } else {
      setLocalSortColumn(key);
      setLocalSortDirection(nextDir);
    }
  };

  // Selection handlers
  const isSelectionControlled = controlledSelectedIds !== undefined;
  const selectedIds = isSelectionControlled ? controlledSelectedIds : localSelectedIds;

  const handleSelectionChange = (newIds: (string | number)[]) => {
    if (isSelectionControlled) {
      controlledOnSelectionChange?.(newIds);
    } else {
      setLocalSelectedIds(newIds);
    }
  };

  // Filter data locally if uncontrolled search/sort is active and controlled arrays aren't provided
  const processedData = useMemo(() => {
    if (isSearchControlled && isSortControlled) {
      return data;
    }

    let result = [...data];

    // Local filter if uncontrolled
    if (!isSearchControlled && searchValue.trim()) {
      const q = searchValue.toLowerCase().trim();
      result = result.filter(item => {
        return Object.values(item).some(val => {
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(q);
        });
      });
    }

    // Local sort if uncontrolled
    if (!isSortControlled && sortColumn) {
      const colDef = columns.find(c => (c.sortKey || c.key) === sortColumn);
      result.sort((a, b) => {
        let valA = colDef?.accessor ? colDef.accessor(a) : a[sortColumn];
        let valB = colDef?.accessor ? colDef.accessor(b) : b[sortColumn];

        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = String(valB).toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, columns, isSearchControlled, searchValue, isSortControlled, sortColumn, sortDirection]);

  // Pagination processing
  const isPaginationControlled = controlledCurrentPage !== undefined;
  const currentPage = isPaginationControlled ? controlledCurrentPage : localCurrentPage;
  const pageSize = controlledPageSize ?? localPageSize;
  const totalItems = controlledTotalItems ?? processedData.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  const displayData = useMemo(() => {
    if (!paginated || isPaginationControlled) {
      return processedData;
    }
    const start = (currentPage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [paginated, isPaginationControlled, processedData, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    if (isPaginationControlled) {
      controlledOnPageChange?.(page);
    } else {
      setLocalCurrentPage(page);
    }
  };

  const handlePageSizeChange = (size: number) => {
    if (controlledOnPageSizeChange) {
      controlledOnPageSizeChange(size);
    } else {
      setLocalPageSize(size);
      setLocalCurrentPage(1);
    }
  };

  // Row selection toggle
  const visibleItemIds = useMemo(() => {
    return displayData.map((item, idx) => getItemId(item, idx));
  }, [displayData, getItemId]);

  const isAllSelected = useMemo(() => {
    if (visibleItemIds.length === 0) return false;
    return visibleItemIds.every(id => selectedIds.includes(id));
  }, [visibleItemIds, selectedIds]);

  const isSomeSelected = useMemo(() => {
    if (visibleItemIds.length === 0) return false;
    return visibleItemIds.some(id => selectedIds.includes(id)) && !isAllSelected;
  }, [visibleItemIds, selectedIds, isAllSelected]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      handleSelectionChange(selectedIds.filter(id => !visibleItemIds.includes(id)));
    } else {
      const combined = Array.from(new Set([...selectedIds, ...visibleItemIds]));
      handleSelectionChange(combined);
    }
  };

  const handleToggleSelectRow = (id: string | number) => {
    if (selectedIds.includes(id)) {
      handleSelectionChange(selectedIds.filter(s => s !== id));
    } else {
      handleSelectionChange([...selectedIds, id]);
    }
  };

  const visibleColumns = columns.filter(c => !c.hidden);

  const selectedItemsList = useMemo(() => {
    return data.filter((item, idx) => selectedIds.includes(getItemId(item, idx)));
  }, [data, selectedIds, getItemId]);

  return (
    <div className={`w-full min-w-0 flex-1 flex flex-col min-h-0 space-y-3 ${className}`}>
      {/* Module / View Title Header Banner */}
      {(title || subtitle || primaryAction) && (
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-[9px] border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="p-2.5 rounded-[7px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                {icon}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                {title && (
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {title}
                  </h2>
                )}
                {badge}
              </div>
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>

          {primaryAction && (
            <Button
              variant={primaryAction.variant || 'primary'}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="flex items-center gap-1.5 self-start sm:self-auto shrink-0"
            >
              {primaryAction.icon || <Plus className="h-4 w-4" />}
              <span>{primaryAction.label}</span>
            </Button>
          )}
        </div>
      )}

      {/* Grid Container Card */}
      <Card className="w-full min-w-0 flex-1 flex flex-col min-h-0">
        <div className="p-3 sm:p-4 space-y-3 w-full min-w-0 flex-1 flex flex-col min-h-0">
          {/* Top Toolbar: Search + Filters + Actions (Fixed at top of Card) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 shrink-0">
            <div className="flex flex-1 items-center gap-2.5 flex-wrap">
              {searchable && (
                <div className="max-w-md w-full">
                  <SearchInput
                    value={searchValue}
                    onChange={handleSearchChange}
                    placeholder={searchPlaceholder}
                  />
                </div>
              )}

              {toolbarFilters && <div className="flex items-center gap-2 flex-wrap">{toolbarFilters}</div>}
            </div>

            {toolbarActions && (
              <div className="flex items-center gap-2 self-end md:self-auto shrink-0">{toolbarActions}</div>
            )}
          </div>

          {/* Batch Actions Bar (shown when items are selected) */}
          {selectable && selectedIds.length > 0 && (
            <div className="shrink-0 flex items-center justify-between bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-3.5 py-2 rounded-[8px] text-xs text-indigo-900 dark:text-indigo-200 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 font-medium">
                <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>
                  Đã chọn <strong>{selectedIds.length}</strong> dòng
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectionChange([])}
                  className="text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800 dark:hover:text-indigo-200 ml-2"
                >
                  Bỏ chọn tất cả
                </button>
              </div>

              {batchActions.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {batchActions.map((action, idx) => (
                    <Button
                      key={idx}
                      size="sm"
                      variant={action.variant || 'secondary'}
                      onClick={() => action.onClick(selectedItemsList, selectedIds)}
                      className="flex items-center gap-1 text-xs"
                    >
                      {action.icon}
                      <span>{action.label}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Table Element - Flex grow with overflow auto */}
          <div className="flex-1 min-h-[300px] max-h-[calc(100vh-250px)] overflow-auto border border-slate-200 dark:border-slate-800 rounded-[8px] relative custom-scrollbar w-full min-w-0">
            {loading && (
              <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xs z-20 flex items-center justify-center">
                <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-[8px] shadow-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Đang tải dữ liệu...</span>
                </div>
              </div>
            )}

            <table className="w-full min-w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 shadow-2xs">
                <tr>
                  {selectable && (
                    <th className={`w-10 text-center ${dense ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
                      <Checkbox
                        checked={isAllSelected}
                        indeterminate={isSomeSelected}
                        onChange={handleToggleSelectAll}
                      />
                    </th>
                  )}

                  {showIndex && (
                    <th className={`w-12 text-center text-slate-500 font-medium ${dense ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
                      {indexHeader}
                    </th>
                  )}

                  {visibleColumns.map((col) => {
                    const colSortKey = col.sortKey || col.key;
                    const isSorted = sortColumn === colSortKey;

                    return (
                      <th
                        key={col.key}
                        style={{ width: col.width }}
                        className={`${dense ? 'px-2 py-1.5' : 'px-3 py-2'} transition-colors ${
                          col.align === 'center'
                            ? 'text-center'
                            : col.align === 'right'
                            ? 'text-right'
                            : 'text-left'
                        } ${col.sortable ? 'cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 select-none' : ''} ${
                          col.headerClassName || ''
                        }`}
                        onClick={() => col.sortable && handleSortClick(col)}
                      >
                        <div
                          className={`inline-flex items-center gap-1 ${
                            col.align === 'center'
                              ? 'justify-center'
                              : col.align === 'right'
                              ? 'justify-end'
                              : 'justify-start'
                          }`}
                        >
                          <span>{col.header ?? col.title}</span>
                          {col.sortable && (
                            <span className="text-slate-400">
                              {isSorted ? (
                                sortDirection === 'asc' ? (
                                  <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                ) : (
                                  <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}

                  {actions && (
                    <th className={`text-right font-semibold text-slate-700 dark:text-slate-300 ${dense ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
                      {actionsHeader}
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={
                        visibleColumns.length +
                        (selectable ? 1 : 0) +
                        (showIndex ? 1 : 0) +
                        (actions ? 1 : 0)
                      }
                      className="p-10 text-center text-slate-400 dark:text-slate-500"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        {emptyIcon || <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600 stroke-[1.5]" />}
                        <p className="text-xs">{emptyText}</p>
                        {emptyAction && <div className="mt-2">{emptyAction}</div>}
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayData.map((item, idx) => {
                    const rowId = getItemId(item, idx);
                    const isRowSelected = selectedIds.includes(rowId);
                    const globalIdx = (currentPage - 1) * pageSize + idx + 1;

                    return (
                      <tr
                        key={rowId}
                        onClick={() => onRowClick?.(item, idx)}
                        className={`transition-colors ${
                          dense ? 'py-1.5' : 'py-2.5'
                        } ${
                          isRowSelected
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/30'
                            : striped && idx % 2 === 1
                            ? 'bg-slate-50/50 dark:bg-slate-800/20'
                            : ''
                        } ${
                          hoverable ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''
                        } ${onRowClick ? 'cursor-pointer' : ''} ${
                          rowClassName ? rowClassName(item, idx) : ''
                        }`}
                      >
                        {selectable && (
                          <td
                            className={`${dense ? 'px-2 py-1' : 'px-3 py-1.5'} text-center`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={isRowSelected}
                              onChange={() => handleToggleSelectRow(rowId)}
                            />
                          </td>
                        )}

                        {showIndex && (
                          <td className={`${dense ? 'px-2 py-1' : 'px-3 py-1.5'} text-center text-slate-400 font-mono text-[11px]`}>
                            {globalIdx}
                          </td>
                        )}

                        {visibleColumns.map((col) => {
                          const val = col.accessor
                            ? col.accessor(item)
                            : item[col.key];

                          return (
                            <td
                              key={col.key}
                              className={`${dense ? 'px-2 py-1' : 'px-3 py-1.5'} ${
                                col.align === 'center'
                                  ? 'text-center'
                                  : col.align === 'right'
                                  ? 'text-right'
                                  : 'text-left'
                              } ${col.className || ''}`}
                            >
                              {col.render
                                ? col.render(item, idx)
                                : val !== undefined && val !== null
                                ? String(val)
                                : '—'}
                            </td>
                          );
                        })}

                        {actions && (
                          <td
                            className={`${dense ? 'px-2 py-1' : 'px-3 py-1.5'} text-right`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1">
                              {actions(item, idx)}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination */}
          {paginated && totalItems > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              pageSizeOptions={pageSizeOptions}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
