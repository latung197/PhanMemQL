// Functions shown in the permission matrix, grouped by module, and helpers on matrices.
// The functions come from config/functions.ts (same codes as the backend FunctionCatalog).
import { ActionPermissions, ModuleCategoryKey, SubMenuKey, UserProfile } from '../../../types';
import { getActionPermission } from '../../../utils/permissions';
import { FUNCTION_KEYS, FUNCTION_REGISTRY, FunctionKind } from '../../../config/functions';

export type ModuleName = 'Kho Hàng' | 'Bán Hàng' | 'Tài Chính' | 'Nhân Sự' | 'Hệ Thống';
export type FunctionGroup = 'danh_muc' | 'chung_tu' | 'bao_cao' | 'he_thong';

export interface FunctionItem {
  subKey: SubMenuKey;
  label: string;
  module: ModuleName;
  group: FunctionGroup;
}

export type FullMatrix = Record<SubMenuKey, ActionPermissions>;

export const ACTIONS: { key: keyof ActionPermissions; label: string; short: string }[] = [
  { key: 'view', label: 'Xem', short: 'Xem' },
  { key: 'createEdit', label: 'Thêm & Sửa', short: 'Thêm/Sửa' },
  { key: 'delete', label: 'Xóa', short: 'Xóa' },
  { key: 'approve', label: 'Phê duyệt', short: 'Duyệt' },
  { key: 'printExport', label: 'In & Xuất file', short: 'In/Xuất' }
];

export const GROUP_LABELS: Record<FunctionGroup, string> = {
  danh_muc: 'Danh mục',
  chung_tu: 'Chứng từ',
  bao_cao: 'Báo cáo',
  he_thong: 'Hệ thống'
};

export const MODULE_NAMES: ModuleName[] = ['Kho Hàng', 'Bán Hàng', 'Tài Chính', 'Nhân Sự', 'Hệ Thống'];

const MODULE_OF: Record<ModuleCategoryKey, ModuleName> = {
  inventory: 'Kho Hàng', sales: 'Bán Hàng', finance: 'Tài Chính', hr: 'Nhân Sự',
  overview: 'Hệ Thống', reports: 'Hệ Thống', ai: 'Hệ Thống', settings: 'Hệ Thống'
};

const GROUP_OF: Record<FunctionKind, FunctionGroup> = {
  catalog: 'danh_muc', voucher: 'chung_tu', process: 'chung_tu', report: 'bao_cao', system: 'he_thong'
};

/** Every function of the registry (config/functions.ts), grouped by module then kind. */
export const FUNCTIONS: FunctionItem[] = FUNCTION_KEYS
  .map((subKey): FunctionItem => {
    const def = FUNCTION_REGISTRY[subKey];
    const module = MODULE_OF[def.category];
    return { subKey, label: def.label, module, group: module === 'Hệ Thống' ? 'he_thong' : GROUP_OF[def.kind] };
  })
  .sort((a, b) => MODULE_NAMES.indexOf(a.module) - MODULE_NAMES.indexOf(b.module)
    || Object.keys(GROUP_LABELS).indexOf(a.group) - Object.keys(GROUP_LABELS).indexOf(b.group));

const NONE: ActionPermissions = { view: false, createEdit: false, delete: false, approve: false, printExport: false };
const ALL: ActionPermissions = { view: true, createEdit: true, delete: true, approve: true, printExport: true };

/** Matrix with every function of the catalog, from a user or a role. */
export const toFullMatrix = (source: Pick<UserProfile, 'isSystemAdmin' | 'permissions'>): FullMatrix =>
  Object.fromEntries(FUNCTIONS.map(fn => [fn.subKey, getActionPermission(source, fn.subKey)])) as FullMatrix;

export const uniformMatrix = (value: 'none' | 'all' | 'view'): FullMatrix =>
  Object.fromEntries(FUNCTIONS.map(fn => [fn.subKey,
    value === 'all' ? ALL : value === 'view' ? { ...NONE, view: true } : NONE])) as FullMatrix;

/** Number of checkboxes that differ between two matrices. */
export const countDifferences = (a: FullMatrix, b: FullMatrix): number =>
  FUNCTIONS.reduce((sum, fn) => sum + ACTIONS.filter(ac => a[fn.subKey]?.[ac.key] !== b[fn.subKey]?.[ac.key]).length, 0);

export const matrixEquals = (a: FullMatrix, b: FullMatrix) => countDifferences(a, b) === 0;

/** Number of functions the matrix can at least view. */
export const countViewable = (m: FullMatrix): number => FUNCTIONS.filter(fn => m[fn.subKey]?.view).length;

/** Special rights are compared as sets of "{function}:{code}". */
export const normalizeRights = (rights?: string[]): string[] => [...new Set(rights ?? [])].sort();

export const countRightDifferences = (a: string[], b: string[]): number => {
  const setA = new Set(a);
  const setB = new Set(b);
  return a.filter(x => !setB.has(x)).length + b.filter(x => !setA.has(x)).length;
};
