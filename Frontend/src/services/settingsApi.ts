// Settings screens backed by the API: users, roles and company units (backend: /api/settings/*).
import { apiRequest } from './apiClient';
import { ActionPermissions, CompanyUnit, RoleDefinition, SubMenuKey, UserProfile } from '../types';

export type PermissionMatrix = Partial<Record<SubMenuKey, ActionPermissions>>;

export interface CreateUserInput {
  username: string;
  password: string;
  fullName: string;
  email?: string;
  phone?: string;
  departmentCode?: string | null;
  avatar?: string;
  employeeCode?: string;
  roleId?: string | null;
  ma_dvcs: string;
  ds_ma_dvcs?: string[];
  permissions?: PermissionMatrix;
}

export interface UpdateUserInput {
  fullName: string;
  email?: string;
  phone?: string;
  departmentCode?: string | null;
  avatar?: string;
  themePref: 'light' | 'dark';
  notificationsEnabled: boolean;
  employeeCode?: string;
  isActive: boolean;
  ma_dvcs: string;
  ds_ma_dvcs: string[];
  /** UserProfile.version of the record being edited. */
  version?: number;
}

export interface SaveRoleInput {
  code: string;
  name: string;
  description?: string;
  permissions: PermissionMatrix;
  specialRights?: string[];
  /** RoleDefinition.version of the role being edited. */
  version?: number;
}

/** One special right of the backend catalog (GET /api/settings/permission-catalog). */
export interface SpecialRightDef {
  function: SubMenuKey;
  code: string;
  key: string;
  name: string;
  group: 'data' | 'scope' | 'status' | 'feature';
  description: string;
}

export interface PermissionCatalog {
  specialRights: SpecialRightDef[];
  groups: Record<SpecialRightDef['group'], string>;
}

export type RequesterType = 'ANY' | 'USER' | 'ROLE' | 'DEPARTMENT';
export type ApproverType = 'USER' | 'ROLE';

export interface ApprovalRule {
  id: string;
  function: SubMenuKey;
  unitCode?: string | null;
  level: number;
  requesterType: RequesterType;
  requesterValue?: string | null;
  minAmount?: number | null;
  approverType: ApproverType;
  approverValue: string;
  note?: string | null;
  isActive: boolean;
  /** Row version from the backend; sent back when saving so a change made meanwhile by someone else is not overwritten. */
  version?: number;
}

export type SaveApprovalRuleInput = Omit<ApprovalRule, 'id'>;

export interface ApproverUser { id: string; username: string; fullName: string }

export interface ApprovalPreview {
  usesDefaultApprovers: boolean;
  levels: { level: number; label: string; approvers: ApproverUser[] }[];
}

export type SaveCompanyUnitInput = Omit<CompanyUnit, 'id'>;

export const usersApi = {
  getAll: () => apiRequest<UserProfile[]>('GET', '/api/settings/users'),
  create: (input: CreateUserInput) => apiRequest<UserProfile>('POST', '/api/settings/users', input),
  update: (id: string, input: UpdateUserInput) => apiRequest<UserProfile>('PUT', `/api/settings/users/${id}`, input),
  /** Assigns the role (null = none) and replaces the user's permission matrix and special rights. */
  setPermissions: (id: string, roleId: string | null | undefined, permissions: PermissionMatrix, specialRights?: string[],
    version?: number) =>
    apiRequest<UserProfile>('PUT', `/api/settings/users/${id}/permissions`, { roleId: roleId ?? null, permissions, specialRights, version }),
  resetPassword: (id: string, newPassword: string) =>
    apiRequest<void>('PUT', `/api/settings/users/${id}/password`, { newPassword }),
  remove: (id: string) => apiRequest<void>('DELETE', `/api/settings/users/${id}`)
};

export const rolesApi = {
  getAll: () => apiRequest<RoleDefinition[]>('GET', '/api/settings/roles'),
  create: (input: SaveRoleInput) => apiRequest<RoleDefinition>('POST', '/api/settings/roles', input),
  update: (id: string, input: SaveRoleInput) => apiRequest<RoleDefinition>('PUT', `/api/settings/roles/${id}`, input),
  /** Removes the individual exceptions of every holder of the role; returns the number of users. */
  syncUsers: async (id: string) =>
    (await apiRequest<{ count: number }>('POST', `/api/settings/roles/${id}/sync-users`)).count,
  /** Refused while the role is assigned to an account or used by an approval rule. */
  remove: (id: string) => apiRequest<void>('DELETE', `/api/settings/roles/${id}`)
};

export const permissionCatalogApi = {
  get: () => apiRequest<PermissionCatalog>('GET', '/api/settings/permission-catalog')
};

export const approvalRulesApi = {
  getAll: (fn?: SubMenuKey) => apiRequest<ApprovalRule[]>('GET', `/api/settings/approval-rules${fn ? `?function=${fn}` : ''}`),
  create: (input: SaveApprovalRuleInput) => apiRequest<ApprovalRule>('POST', '/api/settings/approval-rules', input),
  update: (id: string, input: SaveApprovalRuleInput) => apiRequest<ApprovalRule>('PUT', `/api/settings/approval-rules/${id}`, input),
  remove: (id: string) => apiRequest<void>('DELETE', `/api/settings/approval-rules/${id}`),
  /** Who approves a document of this function created by this user for this amount. */
  preview: (fn: SubMenuKey, requesterUserId: number, amount?: number | null, unitCode?: string | null) =>
    apiRequest<ApprovalPreview>('POST', '/api/settings/approval-rules/preview', { function: fn, requesterUserId, amount, unitCode })
};

export const companyUnitsApi = {
  getAll: () => apiRequest<CompanyUnit[]>('GET', '/api/settings/company-units'),
  create: (input: SaveCompanyUnitInput) => apiRequest<CompanyUnit>('POST', '/api/settings/company-units', input),
  update: (code: string, input: SaveCompanyUnitInput) =>
    apiRequest<CompanyUnit>('PUT', `/api/settings/company-units/${encodeURIComponent(code)}`, input),
  remove: (code: string) => apiRequest<void>('DELETE', `/api/settings/company-units/${encodeURIComponent(code)}`)
};

// ----- Organization and accounting settings (tables on the backend) -----

export interface Department {
  code: string;
  name: string;
  note?: string | null;
  isActive: boolean;
  /** Accounts in the department. */
  userCount: number;
  /** Row version from the backend; sent back when saving so a change made meanwhile by someone else is not overwritten. */
  version?: number;
}

export type SaveDepartmentInput = Omit<Department, 'userCount'>;

/** Language of the catalog (Settings › Ngôn ngữ). UserCount = accounts that chose it themselves. */
export interface Language {
  code: string;
  name: string;
  nativeName: string;
  isActive: boolean;
  isDefault: boolean;
  userCount: number;
  /** Row version from the backend; sent back when saving so a change made meanwhile by someone else is not overwritten. */
  version?: number;
}

export type SaveLanguageInput = Omit<Language, 'userCount'>;

export const languagesApi = {
  getAll: () => apiRequest<Language[]>('GET', '/api/settings/languages'),
  create: (input: SaveLanguageInput) => apiRequest<Language>('POST', '/api/settings/languages', input),
  update: (code: string, input: SaveLanguageInput) =>
    apiRequest<Language>('PUT', `/api/settings/languages/${encodeURIComponent(code)}`, input),
  /** Refused for the default language and while accounts use it. */
  remove: (code: string) => apiRequest<void>('DELETE', `/api/settings/languages/${encodeURIComponent(code)}`)
};

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  /** The accounting (base) currency; exactly one. */
  isBase: boolean;
  isActive: boolean;
  /** Row version from the backend; sent back when saving so a change made meanwhile by someone else is not overwritten. */
  version?: number;
}

export interface ExchangeRate {
  id: string;
  currencyCode: string;
  /** yyyy-MM-dd */
  date: string;
  buyRate: number;
  sellRate: number;
  accountingRate: number;
  updatedBy?: string | null;
  updatedAt: string;
  /** Row version from the backend; sent back when saving so a change made meanwhile by someone else is not overwritten. */
  version?: number;
}

export type SaveExchangeRateInput = Pick<ExchangeRate, 'currencyCode' | 'date' | 'buyRate' | 'sellRate' | 'accountingRate' | 'version'>;

export interface FiscalMonth {
  year: number;
  month: number;
  isLocked: boolean;
  lockedBy?: string | null;
  lockedAt?: string | null;
}

export interface VoucherNumbering {
  voucherType: string;
  function: SubMenuKey;
  name: string;
  prefix: string;
  pattern: string;
  digits: number;
  /** Number the next voucher of the current unit would get today. */
  nextNumber: string;
  /** Row version from the backend; sent back when saving so a change made meanwhile by someone else is not overwritten. */
  version?: number;
}

export type SaveVoucherNumberingInput = Pick<VoucherNumbering, 'prefix' | 'pattern' | 'digits' | 'version'>;

export const departmentsApi = {
  getAll: () => apiRequest<Department[]>('GET', '/api/settings/departments'),
  create: (input: SaveDepartmentInput) => apiRequest<Department>('POST', '/api/settings/departments', input),
  update: (code: string, input: SaveDepartmentInput) =>
    apiRequest<Department>('PUT', `/api/settings/departments/${encodeURIComponent(code)}`, input),
  /** Refused while users or approval rules use the department. */
  remove: (code: string) => apiRequest<void>('DELETE', `/api/settings/departments/${encodeURIComponent(code)}`)
};

export const currenciesApi = {
  getAll: () => apiRequest<Currency[]>('GET', '/api/settings/currencies'),
  create: (input: Currency) => apiRequest<Currency>('POST', '/api/settings/currencies', input),
  update: (code: string, input: Currency) =>
    apiRequest<Currency>('PUT', `/api/settings/currencies/${encodeURIComponent(code)}`, input),
  remove: (code: string) => apiRequest<void>('DELETE', `/api/settings/currencies/${encodeURIComponent(code)}`)
};

export const exchangeRatesApi = {
  getAll: (currency?: string) =>
    apiRequest<ExchangeRate[]>('GET', `/api/settings/exchange-rates${currency ? `?currency=${encodeURIComponent(currency)}` : ''}`),
  create: (input: SaveExchangeRateInput) => apiRequest<ExchangeRate>('POST', '/api/settings/exchange-rates', input),
  update: (id: string, input: SaveExchangeRateInput) => apiRequest<ExchangeRate>('PUT', `/api/settings/exchange-rates/${id}`, input),
  remove: (id: string) => apiRequest<void>('DELETE', `/api/settings/exchange-rates/${id}`),
  /** Accounting rate for a voucher dated `date` (yyyy-MM-dd); 1 for the base currency. */
  getRate: async (currency: string, date: string) =>
    (await apiRequest<{ rate: number }>('GET', `/api/settings/exchange-rates/rate?currency=${encodeURIComponent(currency)}&date=${date}`)).rate
};

/** Month locks of the company unit of the session. */
export const fiscalPeriodsApi = {
  getYear: (year: number) => apiRequest<FiscalMonth[]>('GET', `/api/settings/fiscal-periods/${year}`),
  setLock: (year: number, months: number[], isLocked: boolean) =>
    apiRequest<FiscalMonth[]>('PUT', `/api/settings/fiscal-periods/${year}`, { months, isLocked }),
  /** Whether a voucher of that date (yyyy-MM-dd) may be created, with the reason when not. */
  check: (date: string) => apiRequest<{ locked: boolean; reason?: string | null }>('GET', `/api/settings/fiscal-periods/check?date=${date}`)
};

export const voucherNumberingApi = {
  getAll: () => apiRequest<VoucherNumbering[]>('GET', '/api/settings/voucher-numbering'),
  update: (voucherType: string, input: SaveVoucherNumberingInput) =>
    apiRequest<VoucherNumbering>('PUT', `/api/settings/voucher-numbering/${encodeURIComponent(voucherType)}`, input),
  /** Number a new voucher would get (the backend takes the real number when the voucher is saved). */
  preview: async (voucherType: string, date?: string) =>
    (await apiRequest<{ number: string }>('GET',
      `/api/settings/voucher-numbering/${encodeURIComponent(voucherType)}/preview${date ? `?date=${date}` : ''}`)).number
};

/** Whole-settings backup file (administrators only). */
export interface SettingsBackup {
  version: number;
  exportedAt: string;
  sections: Record<string, unknown>;
  currencies: Currency[];
  exchangeRates: SaveExchangeRateInput[];
  departments: SaveDepartmentInput[];
  numbering: (SaveVoucherNumberingInput & { voucherType: string })[];
  /** Own sections of each company unit (unit code → section → value). */
  unitSections?: Record<string, Record<string, unknown>>;
}

export const settingsBackupApi = {
  export: () => apiRequest<SettingsBackup>('GET', '/api/settings/system-config/backup'),
  /** Adds or updates everything in the file in one transaction; nothing is deleted. */
  restore: (backup: SettingsBackup) => apiRequest<void>('POST', '/api/settings/system-config/restore', backup)
};

// Settings › Nhật ký thay đổi (sys_audit_log): change log of every function (backend sys_audit_log).

/** One changed field; null = no value. Field conventions: AuditDiff in the backend (permission:…, right:…). */
export interface AuditChange {
  field: string;
  before: string | null;
  after: string | null;
}

export interface AuditLogEntry {
  id: string;
  /** Local time of the server, "2026-10-01T15:04:45". */
  time: string;
  functionCode: SubMenuKey;
  /** user, role, department... or a function code for its documents (texts audit.objectType.*). */
  objectType: string;
  objectId: string;
  objectLabel: string | null;
  /** CREATE, UPDATE, DELETE, PERMISSIONS, RESET_PASSWORD, SYNC... (texts audit.action.*). */
  action: string;
  changes: AuditChange[];
  note: string | null;
  actorId: string | null;
  actorUsername: string | null;
  actorName: string | null;
  unitCode: string | null;
  ipAddress: string | null;
}

export interface AuditPage {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

/** All optional. actor: part of the username or name; search: part of the object's name or id; from / to: yyyy-MM-dd, to included. */
export interface AuditQuery {
  functionCode?: SubMenuKey | '';
  objectType?: string;
  action?: string;
  actor?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/** Functions, object types and actions present in the log (choices of the filters). */
export interface AuditFilters {
  functions: SubMenuKey[];
  objectTypes: string[];
  actions: string[];
}

/** How long the change log is kept; older rows are deleted automatically (0 = forever). */
export interface AuditLogSettings { retentionMonths: number }

export const auditLogApi = {
  filters: () => apiRequest<AuditFilters>('GET', '/api/audit-logs/filters'),
  settings: () => apiRequest<AuditLogSettings>('GET', '/api/audit-logs/settings'),
  saveSettings: (settings: AuditLogSettings) => apiRequest<AuditLogSettings>('PUT', '/api/audit-logs/settings', settings),
  query: (query: AuditQuery) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== '') params.set(key, String(value));
    return apiRequest<AuditPage>('GET', `/api/audit-logs?${params}`);
  }
};
