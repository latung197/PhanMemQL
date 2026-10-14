// How the detail grids of the vouchers are shown (GET /api/voucher-grids), shared by the whole system and kept after sign-in like the
// voucher statuses. The code declares what the columns are (voucherGridConfigs.ts: field, type, lookups, required); the server table
// sys_voucher_grid keeps order, headers, widths, decimals, visibility and how many columns are pinned on the left (Settings › Cấu hình
// lưới chứng từ). VoucherDetailGrid applies it over the code's own declaration; until it is loaded (or when the call fails) the
// grids show the declaration of the code.
import { useSyncExternalStore } from 'react';
import { apiRequest } from './apiClient';
import type { VoucherColumnConfig, VoucherGridInfo } from '../types/voucherGrid';

export interface VoucherGridColumnRow {
  field: string;
  header: string;
  headerEn?: string | null;
  type: string;
  width?: number | null;
  minWidth?: number | null;
  align: string;
  decimals?: number | null;
  required: boolean;
  readOnly: boolean;
  visible: boolean;
  /** A required column cannot be hidden. */
  locked: boolean;
  summary?: string | null;
  summaryFormat?: string | null;
  sortOrder: number;
}

export interface VoucherGridRow {
  code: string;
  voucherType: string;
  voucherName: string;
  name: string;
  nameEn?: string | null;
  tabKey: string;
  tabOrder: number;
  allowAddRow: boolean;
  allowDeleteRow: boolean;
  pinCount: number;
  columns: VoucherGridColumnRow[];
  version: number;
}

export interface SaveVoucherGridInput {
  pinCount: number;
  columns: { field: string; header: string; headerEn: string | null; width: number | null; minWidth: number | null; decimals: number | null; visible: boolean }[];
  version?: number;
}

export const voucherGridsApi = {
  getAll: () => apiRequest<VoucherGridRow[]>('GET', '/api/voucher-grids'),
  update: (code: string, input: SaveVoucherGridInput) => apiRequest<VoucherGridRow>('PUT', `/api/voucher-grids/${encodeURIComponent(code)}`, input)
};

let grids = new Map<string, VoucherGridRow>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

export const voucherGridService = {
  /** Loads the configuration of every grid (call again after the administrator saves one). */
  load: async () => {
    try {
      grids = new Map((await voucherGridsApi.getAll()).map(row => [row.code, row]));
    } catch {
      grids = new Map();
    }
    notify();
  },
  clear: () => { grids = new Map(); notify(); },
  get: (code: string) => grids.get(code)
};

/** Re-renders the screen when the configuration changes. */
export const useVoucherGrids = () => {
  useSyncExternalStore(callback => { listeners.add(callback); return () => { listeners.delete(callback); }; }, () => grids);
  return voucherGridService;
};

/**
 * The grid as the system configured it over the declaration of the code: columns in the configured order (a column the code has and the
 * table does not yet goes to the end), without the hidden ones (a required column is always shown), with the configured header
 * (English one when the language is English), width, minimum width and decimals, and the number of pinned columns.
 */
export const applyVoucherGrid = (base: VoucherGridInfo, language: string): VoucherGridInfo => {
  const row = grids.get(base.gridId);
  if (!row) return base;
  const rest = new Map(base.columns.map(column => [column.field, column]));
  const columns: VoucherColumnConfig[] = [];
  for (const configured of row.columns) {
    const declared = rest.get(configured.field);
    if (!declared) continue;
    rest.delete(configured.field);
    if (!configured.visible && !declared.required) continue;
    columns.push({
      ...declared,
      headerName: language === 'en' && configured.headerEn ? configured.headerEn : configured.header,
      width: configured.width ?? declared.width,
      minWidth: configured.minWidth ?? declared.minWidth,
      decimals: configured.decimals ?? declared.decimals
    });
  }
  columns.push(...rest.values());
  return { ...base, columns, allowAddRow: row.allowAddRow, allowDeleteRow: row.allowDeleteRow, pinCount: Math.min(row.pinCount, columns.length) };
};
