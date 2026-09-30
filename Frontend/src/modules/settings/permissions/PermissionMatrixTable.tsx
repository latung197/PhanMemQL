import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Sparkles, X } from 'lucide-react';
import { Checkbox } from '../../../components/common/Checkbox';
import { Button } from '../../../components/common/Button';
import { ActionPermissions, SubMenuKey } from '../../../types';
import { SpecialRightDef } from '../../../services/settingsApi';
import { cn } from '../../../lib/utils';
import {
  ACTIONS, FUNCTIONS, FullMatrix, FunctionItem, GROUP_LABELS, MODULE_NAMES, ModuleName, uniformMatrix
} from './permissionCatalog';

interface PermissionMatrixTableProps {
  value: FullMatrix;
  onChange: (next: FullMatrix) => void;
  /** Granted special rights "{function}:{code}". */
  rights: string[];
  onRightsChange: (next: string[]) => void;
  rightDefs: SpecialRightDef[];
  rightGroupLabels: Record<string, string>;
  readOnly?: boolean;
  /** Matrix / rights to compare with (e.g. the user's role); differences are highlighted. */
  baseline?: FullMatrix;
  baselineRights?: string[];
  baselineLabel?: string;
}

type ActionKey = keyof ActionPermissions;
const RIGHT_GROUP_ORDER: SpecialRightDef['group'][] = ['data', 'scope', 'status', 'feature'];

/** Checkbox state for a set of (function, action) cells. */
const stateOf = (value: FullMatrix, items: FunctionItem[], actions: ActionKey[]) => {
  const cells = items.flatMap(fn => actions.map(a => value[fn.subKey]?.[a] ?? false));
  const on = cells.filter(Boolean).length;
  return { checked: cells.length > 0 && on === cells.length, indeterminate: on > 0 && on < cells.length };
};

/**
 * Permission matrix grouped by module: functions × the five actions, plus the function's special
 * rights (xem giá, sửa phiếu đã duyệt, ...). Granting any action also grants "Xem"; removing "Xem"
 * removes everything on that function, including its special rights.
 */
export const PermissionMatrixTable: React.FC<PermissionMatrixTableProps> = ({
  value, onChange, rights, onRightsChange, rightDefs, rightGroupLabels, readOnly, baseline, baselineRights,
  baselineLabel = 'vai trò'
}) => {
  const [search, setSearch] = useState('');
  const [onlyGranted, setOnlyGranted] = useState(false);
  const [collapsed, setCollapsed] = useState<Partial<Record<ModuleName, boolean>>>({});
  const [openRights, setOpenRights] = useState<Set<SubMenuKey>>(new Set());

  const rightSet = useMemo(() => new Set(rights), [rights]);
  const baselineRightSet = useMemo(() => baselineRights ? new Set(baselineRights) : undefined, [baselineRights]);
  const defsByFunction = useMemo(() => rightDefs.reduce((acc: Partial<Record<SubMenuKey, SpecialRightDef[]>>, d: SpecialRightDef) => {
    (acc[d.function] ??= []).push(d);
    return acc;
  }, {} as Partial<Record<SubMenuKey, SpecialRightDef[]>>), [rightDefs]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return FUNCTIONS.filter(fn =>
      (!q || fn.label.toLowerCase().includes(q) || fn.subKey.includes(q)
        || (defsByFunction[fn.subKey] ?? []).some(d => d.name.toLowerCase().includes(q)))
      && (!onlyGranted || ACTIONS.some(a => value[fn.subKey]?.[a.key])));
  }, [search, onlyGranted, value, defsByFunction]);

  /** Sets the given actions on the given functions, keeping "Xem" and the special rights consistent. */
  const apply = (items: FunctionItem[], actions: ActionKey[], on: boolean) => {
    const next = { ...value };
    const lostView: SubMenuKey[] = [];
    for (const fn of items) {
      const cell = { ...next[fn.subKey] };
      for (const a of actions) cell[a] = on;
      if (on && actions.some(a => a !== 'view')) cell.view = true;
      if (!on && actions.includes('view')) {
        ACTIONS.forEach(a => { cell[a.key] = false; });
        lostView.push(fn.subKey);
      }
      next[fn.subKey] = cell;
    }
    onChange(next);
    if (lostView.length > 0) onRightsChange(rights.filter(r => !lostView.some(fn => r.startsWith(`${fn}:`))));
  };

  const toggleRight = (fn: SubMenuKey, key: string, on: boolean) => {
    onRightsChange(on ? [...new Set([...rights, key])] : rights.filter(r => r !== key));
    // A special right is useless without seeing the function.
    if (on && !value[fn]?.view) onChange({ ...value, [fn]: { ...value[fn], view: true } });
  };

  const quickSet = (mode: 'all' | 'view' | 'none') => {
    onChange(uniformMatrix(mode));
    onRightsChange(mode === 'all' ? rightDefs.map(d => d.key) : []);
  };

  const allKeys = ACTIONS.map(a => a.key);
  const differs = (key: SubMenuKey, action: ActionKey) =>
    baseline !== undefined && (baseline[key]?.[action] ?? false) !== (value[key]?.[action] ?? false);
  const rightDiffers = (key: string) => baselineRightSet !== undefined && baselineRightSet.has(key) !== rightSet.has(key);
  const toggleOpen = (fn: SubMenuKey) => setOpenRights(prev => {
    const next = new Set(prev);
    next.has(fn) ? next.delete(fn) : next.add(fn);
    return next;
  });
  const functionsWithRights = visible.filter(fn => defsByFunction[fn.subKey]?.length);
  const allOpen = functionsWithRights.length > 0 && functionsWithRights.every(fn => openRights.has(fn.subKey));

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm chức năng hoặc quyền..."
              className="h-7 w-56 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-[5px] pl-8 pr-7 text-xs focus:outline-hidden focus:border-indigo-500"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <Checkbox label="Chỉ hiện chức năng đã cấp quyền" checked={onlyGranted} onChange={setOnlyGranted} />
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" icon={<Sparkles className="h-3.5 w-3.5 text-amber-500" />}
            onClick={() => setOpenRights(allOpen ? new Set() : new Set(functionsWithRights.map(fn => fn.subKey)))}>
            {allOpen ? 'Thu gọn quyền đặc biệt' : 'Mở tất cả quyền đặc biệt'}
          </Button>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 mr-1">Thiết lập nhanh:</span>
            <Button variant="outline" size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => quickSet('all')}>Toàn quyền</Button>
            <Button variant="outline" size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => quickSet('view')}>Chỉ xem</Button>
            <Button variant="outline" size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => quickSet('none')}>Bỏ hết</Button>
          </div>
        )}
      </div>

      {/* Matrix */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-[5px] overflow-auto max-h-[calc(100vh-360px)] min-h-[240px]">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="text-left font-semibold px-3 py-2 min-w-[220px]">Chức năng</th>
              {ACTIONS.map(action => {
                const s = stateOf(value, visible, [action.key]);
                return (
                  <th key={action.key} className="w-[72px] px-1 py-2 font-semibold whitespace-nowrap" title={`Chọn / bỏ "${action.label}" cho mọi chức năng đang hiển thị`}>
                    <div className="flex flex-col items-center gap-1">
                      <span>{action.short}</span>
                      <Checkbox checked={s.checked} indeterminate={s.indeterminate} disabled={readOnly}
                        onChange={(on) => apply(visible, [action.key], on)} />
                    </div>
                  </th>
                );
              })}
              <th className="w-14 px-1 py-2 font-semibold whitespace-nowrap">Tất cả</th>
              <th className="w-24 px-1 py-2 font-semibold whitespace-nowrap">Đặc biệt</th>
            </tr>
          </thead>
          <tbody>
            {MODULE_NAMES.map(module => {
              const items = visible.filter(fn => fn.module === module);
              if (items.length === 0) return null;
              const isCollapsed = collapsed[module] && !search;
              const granted = items.filter(fn => value[fn.subKey]?.view).length;
              const moduleAll = stateOf(value, items, allKeys);
              const moduleRights = items.flatMap(fn => defsByFunction[fn.subKey] ?? []);
              return (
                <React.Fragment key={module}>
                  <tr className="bg-brand-50 dark:bg-slate-800/70 border-y border-slate-200 dark:border-slate-700">
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => setCollapsed(prev => ({ ...prev, [module]: !prev[module] }))}
                        className="flex items-center gap-1.5 font-extrabold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide text-[11px] cursor-pointer whitespace-nowrap"
                      >
                        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {module}
                        <span className="normal-case tracking-normal font-semibold text-slate-500">({granted}/{items.length} chức năng)</span>
                      </button>
                    </td>
                    {ACTIONS.map(action => {
                      const s = stateOf(value, items, [action.key]);
                      return (
                        <td key={action.key} className="text-center px-2 py-1.5">
                          <Checkbox checked={s.checked} indeterminate={s.indeterminate} disabled={readOnly}
                            onChange={(on) => apply(items, [action.key], on)} />
                        </td>
                      );
                    })}
                    <td className="text-center px-2 py-1.5">
                      <Checkbox checked={moduleAll.checked} indeterminate={moduleAll.indeterminate} disabled={readOnly}
                        onChange={(on) => apply(items, allKeys, on)} />
                    </td>
                    <td className="text-center px-1 py-1.5 text-[10px] text-slate-500 whitespace-nowrap">
                      {moduleRights.length > 0 && `${moduleRights.filter(d => rightSet.has(d.key)).length}/${moduleRights.length}`}
                    </td>
                  </tr>

                  {!isCollapsed && items.map(fn => {
                    const row = stateOf(value, [fn], allKeys);
                    const defs = defsByFunction[fn.subKey] ?? [];
                    const grantedRights = defs.filter(d => rightSet.has(d.key)).length;
                    const rowDiffers = ACTIONS.some(a => differs(fn.subKey, a.key)) || defs.some(d => rightDiffers(d.key));
                    const isOpen = openRights.has(fn.subKey);
                    return (
                      <React.Fragment key={fn.subKey}>
                        <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-3 py-1.5 pl-8">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-slate-800 dark:text-slate-200">{fn.label}</span>
                              <span className="text-[10px] px-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">{GROUP_LABELS[fn.group]}</span>
                              {rowDiffers && (
                                <span className="text-[10px] px-1.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                                  title={`Khác với quyền của ${baselineLabel}`}>
                                  Khác {baselineLabel}
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[10px] text-slate-400">{fn.subKey}</span>
                          </td>
                          {ACTIONS.map(action => (
                            <td key={action.key} className={cn('text-center px-2 py-1.5', differs(fn.subKey, action.key) && 'bg-amber-50 dark:bg-amber-950/30')}>
                              <Checkbox checked={value[fn.subKey]?.[action.key] ?? false} disabled={readOnly}
                                onChange={(on) => apply([fn], [action.key], on)} />
                            </td>
                          ))}
                          <td className="text-center px-2 py-1.5">
                            <Checkbox checked={row.checked} indeterminate={row.indeterminate} disabled={readOnly}
                              onChange={(on) => apply([fn], allKeys, on)} />
                          </td>
                          <td className="text-center px-1 py-1.5">
                            {defs.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleOpen(fn.subKey)}
                                className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold cursor-pointer',
                                  grantedRights > 0
                                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500')}
                                title="Quyền đặc biệt của chức năng"
                              >
                                <Sparkles className="h-3 w-3" /> {grantedRights}/{defs.length}
                                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              </button>
                            )}
                          </td>
                        </tr>
                        {isOpen && defs.length > 0 && (
                          <tr className="border-b border-slate-100 dark:border-slate-800 bg-amber-50/40 dark:bg-amber-950/10">
                            <td colSpan={ACTIONS.length + 3} className="px-3 py-2 pl-8">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {RIGHT_GROUP_ORDER.map(group => {
                                  const groupDefs = defs.filter(d => d.group === group);
                                  if (groupDefs.length === 0) return null;
                                  return (
                                    <div key={group} className="space-y-1.5">
                                      <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{rightGroupLabels[group] ?? group}</p>
                                      {groupDefs.map(d => (
                                        <div key={d.key} className={cn('rounded px-1', rightDiffers(d.key) && 'bg-amber-100/70 dark:bg-amber-950/40')}>
                                          <Checkbox checked={rightSet.has(d.key)} disabled={readOnly} label={d.name} subLabel={d.description}
                                            onChange={(on) => toggleRight(fn.subKey, d.key, on)} />
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={ACTIONS.length + 3} className="text-center py-8 text-slate-400">Không có chức năng nào khớp bộ lọc.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
