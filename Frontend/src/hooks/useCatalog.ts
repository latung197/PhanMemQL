// Loading and saving an API-backed catalog (danh mục): list, create / update in a form, delete with
// confirmation, with the usual toasts. Catalog screens only declare their columns and form.
import { useCallback, useEffect, useState } from 'react';
import { useConfirm } from '../components/common/ConfirmDialog';
import { ApiError, getErrorMessage } from '../services/apiClient';
import type { PagedQuery, PagedResult } from '../services/paging';
import { usePagedList } from './usePagedList';
import { showToast } from '../utils/toast';
import { useLanguage } from '../context/LanguageContext';

export interface CatalogApi<T, TInput> {
  /** Whole list in one call (older screens, filtered and cut into pages in the browser). */
  getAll?: () => Promise<T[]>;
  /** One page, sorted and filtered by the server (services/paging.ts): the standard way for every catalog. */
  list?: (query: PagedQuery) => Promise<PagedResult<T>>;
  create: (input: TInput) => Promise<unknown>;
  update: (key: string, input: TInput) => Promise<unknown>;
  remove: (key: string) => Promise<void>;
}

export interface CatalogOptions<T> {
  /** Key used in the update / delete URLs (code or id). */
  keyOf: (item: T) => string;
  /** Short name for messages, e.g. "phòng ban". */
  noun: string;
  /** Text naming one record in messages, e.g. `${x.code} - ${x.name}`. */
  describe: (item: T) => string;
  onChanged?: () => void | Promise<void>;
  /** The page wanted, when the api has `list`; null waits (e.g. until the saved layout is known). */
  query?: PagedQuery | null;
}

/** The loaded record's row version (IVersioned on the backend), when it has one. */
const withVersion = <TInput>(input: TInput, existing: unknown): TInput => {
  const version = (existing as { version?: unknown }).version;
  return typeof version === 'number' ? { ...input, version } : input;
};

export function useCatalog<T, TInput>(api: CatalogApi<T, TInput>, options: CatalogOptions<T>) {
  const confirm = useConfirm();
  const { t } = useLanguage();
  const [allItems, setAllItems] = useState<T[]>([]);
  const [allLoading, setAllLoading] = useState(!api.list);
  const [allError, setAllError] = useState('');
  const { keyOf, noun, describe, onChanged } = options;
  // Paged mode (api.list) or whole-list mode (api.getAll); a screen uses one of them.
  const paged = usePagedList<T>(api.list, options.query ?? null);

  const reloadAll = useCallback(async () => {
    if (!api.getAll) return;
    setAllLoading(true);
    try {
      setAllItems(await api.getAll());
      setAllError('');
    } catch (e) {
      setAllError(getErrorMessage(e));
    } finally {
      setAllLoading(false);
    }
    // api is a module-level object; reload only when it changes.
  }, [api]);

  useEffect(() => { if (!api.list) void reloadAll(); }, [api.list, reloadAll]);

  const items = api.list ? paged.items : allItems;
  const total = api.list ? paged.total : allItems.length;
  const loading = api.list ? paged.loading : allLoading;
  const error = api.list ? paged.error : allError;
  const reload = api.list ? paged.reload : reloadAll;

  /**
   * Creates (no `existing`) or updates a record; returns true on success so the form can close. An update sends back
   * the version of the record as it was loaded, so the backend refuses it (409) when someone else changed it meanwhile.
   */
  const save = async (input: TInput, existing?: T): Promise<boolean> => {
    try {
      if (existing) await api.update(keyOf(existing), withVersion(input, existing));
      else await api.create(input);
      showToast.success(t(existing ? 'catalog.saved' : 'catalog.added', { noun }));
      // Reload: a save may change other rows too (e.g. a new base currency).
      await reload();
      await onChanged?.();
      return true;
    } catch (e) {
      showToast.error(getErrorMessage(e));
      // Changed or deleted by someone else: show the current data (the form stays open with the user's input).
      if (e instanceof ApiError && e.status === 409) void reload();
      return false;
    }
  };

  const remove = async (item: T): Promise<void> => {
    const ok = await confirm({
      title: t('catalog.deleteTitle', { noun, item: describe(item) }),
      message: t('catalog.deleteMessage'),
      confirmLabel: t('catalog.delete'),
      tone: 'danger'
    });
    if (!ok) return;
    try {
      await api.remove(keyOf(item));
      showToast.success(t('catalog.deleted', { noun, item: describe(item) }));
      await reload();
      await onChanged?.();
    } catch (e) {
      showToast.error(getErrorMessage(e));
    }
  };

  return { items, total, loading, error, reload, save, remove };
}
