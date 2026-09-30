import { useCallback, useEffect, useState } from 'react';

/**
 * Local editable copy of saved data. `dirty` tells whether it differs from the saved value;
 * `reset` discards the edits (or loads a new saved value after a successful save).
 */
export function useDraft<T>(saved: T, isEqual: (a: T, b: T) => boolean) {
  const [base, setBase] = useState(saved);
  const [draft, setDraft] = useState(saved);

  // A different record was selected (or reloaded): start again from it.
  useEffect(() => {
    setBase(saved);
    setDraft(saved);
  }, [saved]);

  const reset = useCallback((next?: T) => {
    const value = next === undefined ? base : next;
    setBase(value);
    setDraft(value);
  }, [base]);

  return { base, draft, setDraft, dirty: !isEqual(base, draft), reset };
}
