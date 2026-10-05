// One screen for every catalog (danh mục), driven by a CatalogDefinition: toolbar (reload, search, filters, Excel import
// / export, add), grid with selection and bulk delete, add / edit form with record stamps and lost-update protection
// (useCatalog), all shown or hidden by the function's rights (view / create / edit / delete / export).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { GridView } from '../common/GridView';
import { CategoryHeaderToolbar } from '../common/CategoryHeaderToolbar';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { SelectInput } from '../common/FormField';
import { ErrorState } from '../common/StateViews';
import { RecordStampLine, type RecordStamp } from '../common/RecordStamp';
import { useConfirm } from '../common/ConfirmDialog';
import { useCatalog } from '../../hooks/useCatalog';
import { useDebounced } from '../../hooks/useDebounced';
import { clampPageSize, PAGE_SIZE_OPTIONS, type PagedQuery } from '../../services/paging';
import { useLanguage } from '../../context/LanguageContext';
import { getErrorMessage } from '../../services/apiClient';
import { showToast } from '../../utils/toast';
import { getActionPermission } from '../../utils/permissions';
import type { UserProfile } from '../../types';
import type { CatalogDefinition } from './catalogTypes';
import { exportExcel } from './excel';
import { ImportExcelDialog } from './ImportExcelDialog';
import { ColumnChooser } from './ColumnChooser';
import { useGridLayout } from './useGridLayout';

const STATUS_FILTER = 'status';

/** Text searched by default: every text / number value of the record (nested objects such as stamps excluded). */
const defaultSearchText = (item: object) =>
  Object.values(item).filter(v => typeof v === 'string' || typeof v === 'number').join(' ');

const fold = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

export function CatalogScreen<T extends object, TInput extends object>({ definition, currentUser, onChanged }: {
  definition: CatalogDefinition<T, TInput>;
  currentUser?: UserProfile;
  onChanged?: () => void | Promise<void>;
}) {
  const { t, language } = useLanguage();
  const confirm = useConfirm();
  const d = definition;
  const perms = getActionPermission(currentUser, d.functionCode);
  // Columns shown, order, widths, sort and rows per page, saved per user (sys_grid_layout).
  const layout = useGridLayout(d.functionCode, 'main', d.columns);

  // Server-paged catalog (api.list): the server sorts, filters and cuts the page; only the page is kept here.
  const serverPaged = !!d.api.list;
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const [showFilter, setShowFilter] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const pageSize = clampPageSize(layout.pageSize);
  const serverFilters = useMemo(
    () => Object.fromEntries(Object.entries(filterValues).filter(([, v]) => v !== '')), [filterValues]);
  // A new search, filter, sort or page size starts again from the first page (in the same render, so no extra request).
  const resetKey = JSON.stringify([debouncedSearch, serverFilters, layout.sortKey, layout.sortDir, pageSize]);
  const [pageState, setPageState] = useState({ key: resetKey, page: 1 });
  const page = pageState.key === resetKey ? pageState.page : 1;
  const setPage = (next: number) => setPageState({ key: resetKey, page: next });
  const listQuery = useMemo((): PagedQuery | null => serverPaged && layout.ready ? {
    page, pageSize, sort: layout.sortKey, dir: layout.sortDir, search: debouncedSearch, filters: serverFilters
  } : null, [serverPaged, layout.ready, page, pageSize, layout.sortKey, layout.sortDir, debouncedSearch, serverFilters]);

  const catalog = useCatalog(d.api, { keyOf: d.keyOf, noun: d.texts.noun, describe: d.describe, onChanged, query: listQuery });
  // After deleting the last rows of a page, go back to the last page that still exists.
  useEffect(() => {
    if (!serverPaged || catalog.loading || catalog.total === 0) return;
    const lastPage = Math.max(1, Math.ceil(catalog.total / pageSize));
    if (page > lastPage) setPage(lastPage);
  }, [serverPaged, catalog.loading, catalog.total, pageSize, page]);
  const loadedLanguage = useRef(language);
  useEffect(() => {
    if (loadedLanguage.current !== language) {
      loadedLanguage.current = language;
      void catalog.reload();
    }
  }, [language, catalog.reload]);
  const [selected, setSelected] = useState<(string | number)[]>([]);
  const [form, setForm] = useState<TInput | null>(null);
  const [editing, setEditing] = useState<T>();
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  // Remembered once seen, so the status filter stays when a filter leaves the page empty.
  const seenStatus = useRef(false);
  if (catalog.items.length > 0) seenStatus.current = 'isActive' in catalog.items[0];
  const hasStatus = seenStatus.current;
  const filters = useMemo(() => [
    ...(hasStatus ? [{
      key: STATUS_FILTER, label: t('catalog.filter.status'),
      options: [{ value: 'active', label: t('catalog.filter.active') }, { value: 'inactive', label: t('catalog.filter.inactive') }],
      match: (item: T, value: string) => (item as { isActive?: boolean }).isActive === (value === 'active')
    }] : []),
    ...(d.filters ?? [])
  ], [hasStatus, d.filters, t]);

  const activeFilters = Object.entries(filterValues).filter(([, v]) => v !== '');
  const visible = useMemo(() => {
    if (serverPaged) return catalog.items;
    const q = fold(search.trim());
    return catalog.items.filter(item =>
      (!q || fold((d.searchText ?? defaultSearchText)(item)).includes(q))
      && activeFilters.every(([key, value]) => filters.find(f => f.key === key)?.match?.(item, value) ?? true));
  }, [serverPaged, catalog.items, search, activeFilters, filters, d.searchText]);

  const open = (item?: T) => {
    setEditing(item);
    setForm(item ? d.toInput(item) : d.emptyInput);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    if (await catalog.save(d.normalize ? d.normalize(form) : form, editing)) setForm(null);
    setSaving(false);
  };

  const removeSelected = async (items: T[]) => {
    if (!d.api.removeMany || items.length === 0) return;
    const ok = await confirm({
      title: t('catalog.deleteManyTitle', { n: items.length, noun: d.texts.noun }),
      message: t('catalog.deleteManyMessage'),
      confirmLabel: t('catalog.delete'),
      tone: 'danger'
    });
    if (!ok) return;
    let changed = false;
    try {
      const result = await d.api.removeMany(items.map(d.keyOf));
      if (result.errors.length > 0) {
        showToast.error(t('catalog.deleteManyFailed'), result.errors.slice(0, 5).map(x => x.message).join('\n'));
      } else {
        showToast.success(t('catalog.deletedMany', { n: result.deleted, noun: d.texts.noun }));
        setSelected([]);
        changed = true;
      }
    } catch (error) {
      showToast.error(getErrorMessage(error));
    }
    await catalog.reload();
    if (changed) await onChanged?.();
  };

  // Server-paged: the server makes the file from every row the filters match (not just this page).
  const exportVisible = () => void (serverPaged && d.api.exportAll
    ? d.api.exportAll({ page: 1, pageSize, sort: layout.sortKey, dir: layout.sortDir, search: debouncedSearch, filters: serverFilters })
    : exportExcel(d.texts.fileName, d.texts.title, d.excel.columns, visible.map(d.excel.toRow))
  ).catch(error => showToast.error(getErrorMessage(error)));

  if (catalog.error) return <ErrorState message={catalog.error} onRetry={() => void catalog.reload()} />;

  const canBulkDelete = perms.delete && !!d.api.removeMany;

  return (
    // Fills the content area: the toolbar stays on top, the list scrolls inside and its pager stays in view.
    <div className="flex flex-col gap-2 flex-1 min-h-0">
      <CategoryHeaderToolbar
        icon={d.icon}
        title={d.texts.title}
        subtitle={d.texts.subtitle}
        count={serverPaged ? catalog.total : visible.length}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={d.texts.searchPlaceholder}
        showAdvancedFilter={showFilter}
        onToggleAdvancedFilter={filters.length > 0 ? () => setShowFilter(v => !v) : undefined}
        activeFilterCount={activeFilters.length}
        filterPanelContent={filters.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {filters.map(f => (
              <SelectInput key={f.key} label={f.label} value={filterValues[f.key] ?? ''} placeholder={t('catalog.filter.all')}
                options={f.options} onChange={e => setFilterValues(prev => ({ ...prev, [f.key]: e.target.value }))} />
            ))}
          </div>
        ) : undefined}
        onClearFilter={activeFilters.length > 0 ? () => setFilterValues({}) : undefined}
        onRefresh={() => void catalog.reload()}
        onExportExcel={perms.export ? exportVisible : undefined}
        onImportExcel={perms.create && d.api.importMany ? () => setImporting(true) : undefined}
        extraActions={<ColumnChooser layout={layout} isAdmin={!!currentUser?.isSystemAdmin} />}
        addLabel={d.texts.add}
        onOpenAdd={() => open()}
        canCreate={perms.create}
      />

      <GridView
        data={visible}
        columns={layout.columns}
        getItemId={item => d.keyOf(item)}
        {...(serverPaged ? {
          serverSide: true,
          sortColumn: layout.sortKey ?? '',
          sortDirection: layout.sortDir ?? 'asc',
          onSort: layout.sort,
          currentPage: page,
          totalItems: catalog.total,
          onPageChange: setPage,
          pageSizeOptions: PAGE_SIZE_OPTIONS
        } : {
          defaultSortColumn: layout.sortKey,
          defaultSortDirection: layout.sortDir,
          onSortChange: layout.sort
        })}
        onColumnResize={layout.resize}
        pageSize={serverPaged ? pageSize : layout.pageSize}
        onPageSizeChange={layout.setPageSize}
        loading={catalog.loading}
        searchable={false}
        fillHeight
        paginated
        selectable={canBulkDelete}
        selectedIds={selected}
        onSelectionChange={setSelected}
        batchActions={canBulkDelete ? [{
          label: t('catalog.deleteSelected'), variant: 'danger', icon: <Trash2 className="h-3.5 w-3.5" />,
          onClick: items => void removeSelected(items)
        }] : []}
        actions={(perms.edit || perms.delete) ? item => (
          <div className="flex justify-end gap-1">
            {perms.edit && <Button variant="ghost" size="sm" title={t('catalog.edit')} onClick={() => open(item)} icon={<Edit2 className="h-3.5 w-3.5" />} />}
            {perms.delete && <Button variant="ghost" size="sm" title={t('catalog.delete')} onClick={() => void catalog.remove(item)} icon={<Trash2 className="h-3.5 w-3.5 text-rose-600" />} />}
          </div>
        ) : undefined}
        onRowClick={perms.edit ? item => open(item) : undefined}
      />

      {form && (
        <Modal isOpen onClose={() => setForm(null)} maxWidth={d.formWidth ?? 'lg'} title={editing ? d.texts.editTitle(editing) : d.texts.addTitle}>
          <form onSubmit={submit} className="space-y-3">
            {d.renderForm({ form, setForm, editing })}
            <RecordStampLine stamp={(editing as { stamp?: RecordStamp } | undefined)?.stamp} />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={() => setForm(null)}>{t('catalog.cancel')}</Button>
              <Button type="submit" size="sm" disabled={saving}>{saving ? t('catalog.saving') : t('catalog.save')}</Button>
            </div>
          </form>
        </Modal>
      )}

      {importing && d.api.importMany && (
        <ImportExcelDialog
          title={t('catalog.import.title', { name: d.texts.title })}
          fileName={d.texts.fileName}
          sheetName={d.texts.title}
          columns={d.excel.columns}
          empty={d.emptyInput}
          normalize={d.normalize}
          canUpdate={perms.edit}
          importMany={d.api.importMany}
          onClose={() => setImporting(false)}
          onImported={() => { setImporting(false); void catalog.reload(); void onChanged?.(); }}
        />
      )}
    </div>
  );
}
