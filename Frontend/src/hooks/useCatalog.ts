// Loading and saving an API-backed catalog (danh mục): list, create / update in a form, delete with
// confirmation, with the usual toasts. Catalog screens only declare their columns and form.
import { useCallback, useEffect, useState } from 'react';
import { useConfirm } from '../components/common/ConfirmDialog';
import { getErrorMessage } from '../services/apiClient';
import { showToast } from '../utils/toast';
import { useLanguage } from '../context/LanguageContext';

export interface CatalogApi<T, TInput> {
  getAll: () => Promise<T[]>;
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
}

export function useCatalog<T, TInput>(api: CatalogApi<T, TInput>, options: CatalogOptions<T>) {
  const confirm = useConfirm();
  const { t } = useLanguage();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { keyOf, noun, describe } = options;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.getAll());
      setError('');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
    // api is a module-level object; reload only when it changes.
  }, [api]);

  useEffect(() => { void reload(); }, [reload]);

  /** Creates (no `existing`) or updates a record; returns true on success so the form can close. */
  const save = async (input: TInput, existing?: T): Promise<boolean> => {
    try {
      if (existing) await api.update(keyOf(existing), input);
      else await api.create(input);
      showToast.success(t(existing ? 'catalog.saved' : 'catalog.added', { noun }));
      // Reload: a save may change other rows too (e.g. a new base currency).
      await reload();
      return true;
    } catch (e) {
      showToast.error(getErrorMessage(e));
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
    } catch (e) {
      showToast.error(getErrorMessage(e));
    }
  };

  return { items, loading, error, reload, save, remove };
}
