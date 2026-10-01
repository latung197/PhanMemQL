// Functions shown in the permission matrix, grouped by module, and helpers on matrices.
// The functions come from config/functions.ts (same codes as the backend FunctionCatalog).
import { ActionPermissions, ModuleCategoryKey, SubMenuKey, UserProfile } from '../../../types';
import { getActionPermission } from '../../../utils/permissions';
import { FUNCTION_KEYS, FUNCTION_REGISTRY, FunctionKind } from '../../../config/functions';
import { translate } from '../../../utils/i18n';

/** Module of the matrix; its name is permissions.module.<key>. */
export type ModuleName = 'inventory' | 'sales' | 'finance' | 'hr' | 'system';
export type FunctionGroup = 'danh_muc' | 'chung_tu' | 'bao_cao' | 'he_thong';

export interface FunctionItem {
  subKey: SubMenuKey;
  module: ModuleName;
  group: FunctionGroup;
}

export type FullMatrix = Record<SubMenuKey, ActionPermissions>;

/** The five actions; names are permissions.action.<key> (label) and permissions.actionShort.<key> (column). */
export const ACTIONS: { key: keyof ActionPermissions }[] = [
  { key: 'view' }, { key: 'createEdit' }, { key: 'delete' }, { key: 'approve' }, { key: 'printExport' }
];

export const actionLabel = (key: keyof ActionPermissions) => translate(`permissions.action.${key}`);
export const actionShortLabel = (key: keyof ActionPermissions) => translate(`permissions.actionShort.${key}`);

const GROUP_ORDER: FunctionGroup[] = ['danh_muc', 'chung_tu', 'bao_cao', 'he_thong'];
export const groupLabel = (group: FunctionGroup) => translate(`permissions.group.${group}`);

export const MODULE_NAMES: ModuleName[] = ['inventory', 'sales', 'finance', 'hr', 'system'];
export const moduleLabel = (module: ModuleName) => translate(`permissions.module.${module}`);

const MODULE_OF: Record<ModuleCategoryKey, ModuleName> = {
  inventory: 'inventory', sales: 'sales', finance: 'finance', hr: 'hr',
  overview: 'system', reports: 'system', ai: 'system', settings: 'system'
};

const GROUP_OF: Record<FunctionKind, FunctionGroup> = {
  catalog: 'danh_muc', voucher: 'chung_tu', process: 'chung_tu', report: 'bao_cao', system: 'he_thong'
};

/** Every function of the registry (config/functions.ts), grouped by module then kind. */
export const FUNCTIONS: FunctionItem[] = FUNCTION_KEYS
  .map((subKey): FunctionItem => {
    const def = FUNCTION_REGISTRY[subKey];
    const module = MODULE_OF[def.category];
    return { subKey, module, group: module === 'system' ? 'he_thong' : GROUP_OF[def.kind] };
  })
  .sort((a, b) => MODULE_NAMES.indexOf(a.module) - MODULE_NAMES.indexOf(b.module)
    || GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));

const NONE: ActionPermissions = { view: false, createEdit: false, delete: false, approve: false, printExport: false };
const ALL: ActionPermissions = { view: true, createEdit: true, delete: true, approve: true, printExport: true };

/** Matrix with every function of the catalog, from a user or a role. */
export const toFullMatrix = (source: Pick<UserProfile, 'isSystemAdmin' | 'permissions'>): FullMatrix =>
  Object.fromEntries(FUNCTIONS.map(fn => [fn.subKey, getActionPermission(source, fn.subKey)])) as FullMatrix;

/** Same value on every function; the landing page stays viewable even with 'none'. */
export const uniformMatrix = (value: 'none' | 'all' | 'view'): FullMatrix =>
  Object.fromEntries(FUNCTIONS.map(fn => [fn.subKey,
    value === 'all' ? ALL : value === 'view' || fn.subKey === 'overview_main' ? { ...NONE, view: true } : NONE])) as FullMatrix;

/** Number of checkboxes that differ between two matrices. */
export const countDifferences = (a: FullMatrix, b: FullMatrix): number =>
  FUNCTIONS.reduce((sum, fn) => sum + ACTIONS.filter(ac => a[fn.subKey]?.[ac.key] !== b[fn.subKey]?.[ac.key]).length, 0);

export const matrixEquals = (a: FullMatrix, b: FullMatrix) => countDifferences(a, b) === 0;

/** Number of functions the matrix can at least view. */
export const countViewable = (m: FullMatrix): number => FUNCTIONS.filter(fn => m[fn.subKey]?.view).length;

/** Special rights are compared as sets of "{function}:{code}". */
export const normalizeRights = (rights?: string[]): string[] => [...new Set(rights ?? [])].sort();

/** The landing page: always viewable (backend PermissionMatrix.LandingFunction), so its "view" is locked on. */
export const LANDING_FUNCTION: SubMenuKey = 'overview_main';

/**
 * Special rights only count on functions the matrix may view (backend PermissionMatrix.VisibleRights): the profile
 * leaves the others out, and the backend stores no exception for them, so they keep following the role.
 */
export const visibleRights = (rights: string[] | undefined, matrix: FullMatrix): string[] =>
  normalizeRights((rights ?? []).filter(key => matrix[key.slice(0, key.indexOf(':')) as SubMenuKey]?.view));

export const countRightDifferences = (a: string[], b: string[]): number => {
  const setA = new Set(a);
  const setB = new Set(b);
  return a.filter(x => !setB.has(x)).length + b.filter(x => !setA.has(x)).length;
};
