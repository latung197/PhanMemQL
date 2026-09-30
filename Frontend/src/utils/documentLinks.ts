// "Open this document" requests, e.g. from a notification: App navigates to the function's screen,
// then the screen opens the document. The request is kept until the screen has mounted and read it.
import { useEffect, useRef } from 'react';
import { SubMenuKey } from '../types';

const OPEN_DOCUMENT_EVENT = 'erp:open-document';

interface OpenDocumentRequest { function: SubMenuKey; documentId: string }

let pending: OpenDocumentRequest | null = null;

/** Asks the screen of `fn` to open a document; works whether or not that screen is already shown. */
export function requestOpenDocument(fn: SubMenuKey, documentId: string) {
  pending = { function: fn, documentId };
  window.dispatchEvent(new CustomEvent<OpenDocumentRequest>(OPEN_DOCUMENT_EVENT, { detail: pending }));
}

/**
 * Used by a voucher screen: calls `open(documentId)` for requests addressed to its function, both the
 * one waiting when the screen mounts and those arriving while it is shown.
 */
export function useOpenDocumentRequest(fn: SubMenuKey, open: (documentId: string) => void) {
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const take = () => {
      if (pending?.function !== fn) return;
      const { documentId } = pending;
      pending = null;
      openRef.current(documentId);
    };
    take();
    window.addEventListener(OPEN_DOCUMENT_EVENT, take);
    return () => window.removeEventListener(OPEN_DOCUMENT_EVENT, take);
  }, [fn]);
}
