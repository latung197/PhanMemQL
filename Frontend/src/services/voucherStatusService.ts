// Names and "in use" flags of the voucher statuses of the company unit of the session (GET /api/voucher-statuses/current),
// kept after sign-in like the settings sections. A unit may rename a status or switch the approval step off in
// Settings › Trạng thái chứng từ; voucher screens show these names instead of fixed texts. Until loaded (or when the call
// fails) the screens fall back to their own default texts.
import { useSyncExternalStore } from 'react';
import { apiRequest } from './apiClient';
import { APPROVAL_CHAIN, type DocumentStatus } from '../utils/documentPolicy';

type StatusNames = Record<string, Partial<Record<DocumentStatus, { name: string; isEnabled: boolean }>>>;

let names: StatusNames = {};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

export const voucherStatusService = {
  /** Loads the names of the unit of the current token (call again after switching unit or changing a status). */
  load: async () => {
    try {
      names = await apiRequest<StatusNames>('GET', '/api/voucher-statuses/current');
    } catch {
      names = {};
    }
    notify();
  },
  clear: () => { names = {}; notify(); },
  /** Name of a status of a voucher type (PNK, PXK, YCX...) in the user's language; `fallback` when the unit has none. */
  name: (voucherType: string, status: DocumentStatus, fallback: string) => names[voucherType]?.[status]?.name || fallback,
  /**
   * False when the unit switched the status off (only the approval steps can be). The two intermediate approval levels are off
   * until the unit switches them on, and only count while the approval step (Chờ duyệt) is in use.
   */
  isEnabled: (voucherType: string, status: DocumentStatus): boolean => {
    const own = (s: DocumentStatus) => names[voucherType]?.[s]?.isEnabled ?? (s !== 'Approved1' && s !== 'Approved2');
    return status === 'Approved1' || status === 'Approved2' ? own(status) && own('Pending') : own(status);
  },
  /** The approval steps the unit uses for the voucher type, in order (Approved last); empty without the approval step. */
  approvalLevels: (voucherType: string): DocumentStatus[] =>
    !voucherStatusService.isEnabled(voucherType, 'Pending') ? []
      : APPROVAL_CHAIN.filter(s => s === 'Approved' || voucherStatusService.isEnabled(voucherType, s))
};

/** Re-renders the screen when the names change; use the returned object's methods like voucherStatusService. */
export const useVoucherStatuses = () => {
  useSyncExternalStore(callback => { listeners.add(callback); return () => { listeners.delete(callback); }; }, () => names);
  return voucherStatusService;
};
