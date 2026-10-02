// How a list is shown for the signed-in user: columns shown and their order, widths, sort and rows per page, saved on
// the server (sys_grid_layout) so it follows the user to any computer. Precedence: the user's own layout, then the
// company default (set by an administrator), then the columns as the code declares them. Column keys that no longer
// exist are ignored and new columns appear at the end, so changing a screen never breaks a saved layout.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../services/apiClient';
import { showToast } from '../../utils/toast';
import { getErrorMessage } from '../../services/apiClient';
import { translate } from '../../utils/i18n';
import type { GridViewColumn } from '../common/GridView';
import type { SubMenuKey } from '../../types';

export interface GridLayoutColumn { key: string; visible: boolean; width?: number }
export interface GridLayout {
  columns?: GridLayoutColumn[];
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  pageSize?: number;
}

const url = (fn: SubMenuKey, grid: string, who = '') =>
  `/api/grid-layouts/${encodeURIComponent(fn)}/${encodeURIComponent(grid)}${who ? `/${who}` : ''}`;

export const gridLayoutApi = {
  get: (fn: SubMenuKey, grid: string) => apiRequest<{ user: GridLayout | null; company: GridLayout | null }>('GET', url(fn, grid)),
  saveMine: (fn: SubMenuKey, grid: string, layout: GridLayout) => apiRequest<void>('PUT', url(fn, grid, 'me'), layout),
  resetMine: (fn: SubMenuKey, grid: string) => apiRequest<void>('DELETE', url(fn, grid, 'me')),
  saveCompany: (fn: SubMenuKey, grid: string, layout: GridLayout) => apiRequest<void>('PUT', url(fn, grid, 'company'), layout),
  resetCompany: (fn: SubMenuKey, grid: string) => apiRequest<void>('DELETE', url(fn, grid, 'company'))
};

/** Text of a column for the column chooser (headers are usually strings). */
const titleOf = <T,>(c: GridViewColumn<T>) =>
  typeof c.header === 'string' ? c.header : typeof c.title === 'string' ? c.title : c.key;

export interface GridLayoutControl<T> {
  /** Columns to give GridView: order, visibility and widths applied. */
  columns: GridViewColumn<T>[];
  /** Every column in the current order, for the chooser. */
  choices: { key: string; title: string; visible: boolean }[];
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  pageSize?: number;
  /** Where the layout comes from. */
  source: 'user' | 'company' | 'code';
  hasCompany: boolean;
  setVisible: (key: string, visible: boolean) => void;
  move: (key: string, step: -1 | 1) => void;
  resize: (key: string, width: number) => void;
  sort: (key: string, dir: 'asc' | 'desc') => void;
  setPageSize: (size: number) => void;
  resetMine: () => Promise<void>;
  saveAsCompany: () => Promise<void>;
  resetCompany: () => Promise<void>;
}

export function useGridLayout<T>(functionCode: SubMenuKey, gridKey: string, declared: GridViewColumn<T>[]): GridLayoutControl<T> {
  const [mine, setMine] = useState<GridLayout | null>(null);
  const [company, setCompany] = useState<GridLayout | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let alive = true;
    gridLayoutApi.get(functionCode, gridKey)
      .then(r => { if (alive) { setMine(r.user); setCompany(r.company); } })
      .catch(() => { /* the code's layout is used */ });
    return () => { alive = false; clearTimeout(saveTimer.current); };
  }, [functionCode, gridKey]);

  const effective: GridLayout = mine ?? company ?? {};

  /** Saved order and visibility, completed with the declared columns (new ones at the end, removed ones dropped). */
  const ordered = useMemo((): GridLayoutColumn[] => {
    const keys = new Set(declared.map(c => c.key));
    const saved = (effective.columns ?? []).filter(c => keys.has(c.key));
    const missing = declared.filter(c => !saved.some(s => s.key === c.key)).map(c => ({ key: c.key, visible: !c.hidden }));
    return [...saved, ...missing];
  }, [declared, effective.columns]);

  const columns = useMemo(() => ordered.filter(c => c.visible).flatMap(c => {
    const column = declared.find(d => d.key === c.key);
    return column ? [{ ...column, hidden: false, width: c.width ? `${c.width}px` : column.width }] : [];
  }), [ordered, declared]);

  /** Changes apply at once and are saved as the user's own layout shortly after (several clicks, one request). */
  const update = useCallback((change: (layout: GridLayout) => GridLayout) => {
    setMine(prev => {
      const next = change({ ...(prev ?? company ?? {}), columns: ordered });
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        gridLayoutApi.saveMine(functionCode, gridKey, next).catch(e => showToast.error(getErrorMessage(e)));
      }, 600);
      return next;
    });
  }, [company, ordered, functionCode, gridKey]);

  const withColumns = (map: (columns: GridLayoutColumn[]) => GridLayoutColumn[]) =>
    update(layout => ({ ...layout, columns: map(layout.columns ?? ordered) }));

  return {
    columns,
    choices: ordered.map(c => ({ key: c.key, visible: c.visible, title: titleOf(declared.find(d => d.key === c.key)!) })),
    sortKey: effective.sortKey,
    sortDir: effective.sortDir,
    pageSize: effective.pageSize,
    source: mine ? 'user' : company ? 'company' : 'code',
    hasCompany: !!company,
    setVisible: (key, visible) => withColumns(cols => {
      // Keep at least one column.
      if (!visible && cols.filter(c => c.visible).length <= 1) return cols;
      return cols.map(c => c.key === key ? { ...c, visible } : c);
    }),
    move: (key, step) => withColumns(cols => {
      const i = cols.findIndex(c => c.key === key);
      const j = i + step;
      if (i < 0 || j < 0 || j >= cols.length) return cols;
      const next = [...cols];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    }),
    resize: (key, width) => withColumns(cols => cols.map(c => c.key === key ? { ...c, width } : c)),
    sort: (key, dir) => update(layout => ({ ...layout, sortKey: key, sortDir: dir })),
    setPageSize: size => update(layout => ({ ...layout, pageSize: size })),
    resetMine: async () => {
      clearTimeout(saveTimer.current);
      await gridLayoutApi.resetMine(functionCode, gridKey);
      setMine(null);
      showToast.success(translate('catalog.layout.resetDone'));
    },
    saveAsCompany: async () => {
      await gridLayoutApi.saveCompany(functionCode, gridKey, { ...effective, columns: ordered });
      setCompany({ ...effective, columns: ordered });
      showToast.success(translate('catalog.layout.companySaved'));
    },
    resetCompany: async () => {
      await gridLayoutApi.resetCompany(functionCode, gridKey);
      setCompany(null);
      showToast.success(translate('catalog.layout.companyReset'));
    }
  };
}
