// Loads one page of a server-paged list (see services/paging.ts) whenever the query changes. Answers that arrive
// out of order (the user typed or clicked on) are ignored; `query === null` waits (e.g. for the saved layout).
import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../services/apiClient';
import { pagedQueryString, type PagedQuery, type PagedResult } from '../services/paging';

export function usePagedList<T>(
  fetchPage: ((query: PagedQuery) => Promise<PagedResult<T>>) | undefined,
  query: PagedQuery | null
) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const latest = useRef(0);
  const key = query ? pagedQueryString(query) : '';

  useEffect(() => {
    if (!fetchPage || !query) return;
    const id = ++latest.current;
    setLoading(true);
    fetchPage(query)
      .then(result => {
        if (id !== latest.current) return;
        setItems(result.items);
        setTotal(result.total);
        setError('');
      })
      .catch(e => { if (id === latest.current) setError(getErrorMessage(e)); })
      .finally(() => { if (id === latest.current) setLoading(false); });
    // The query is read through its string, so an equal query does not load twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage, key, tick]);

  /** Loads the current page again (after a save or delete). */
  const reload = useCallback(async () => { setTick(n => n + 1); }, []);

  return { items, total, loading, error, reload };
}
