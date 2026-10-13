// Settings screens backed by the API: users, roles and company units (backend: /api/settings/*).
import { API_BASE_URL, apiRequest } from './apiClient';
import { prepareImage } from '../utils/imageCompress';
import { ActionPermissions, CompanyUnit, RoleDefinition, SubMenuKey, UserProfile } from '../types';
import { createCatalogApi } from '../components/catalog/createCatalogApi';
import type { RecordStamp } from '../components/common/RecordStamp';

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
  /** Granted per company unit (the voucher status rights ST_*): stored as "{key}@{unit}". */
  perUnit?: boolean;
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

/** A company unit row of the catalog screen (the list of signed-in users comes from the lookup, see lookupOptions.ts). */
export type CompanyUnitRow = CompanyUnit & { stamp: RecordStamp };

export const companyUnitsApi = createCatalogApi<CompanyUnitRow, SaveCompanyUnitInput>({
  url: '/api/settings/company-units', fileName: 'DanhMucDonViCoSo'
});

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

export type LanguageRow = Language & { stamp: RecordStamp };

export const languagesApi = createCatalogApi<LanguageRow, SaveLanguageInput>({
  url: '/api/settings/languages', fileName: 'DanhMucNgonNgu'
});

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
  /** "USD@2026-10-08": currency and day, the key of the rate in URLs. */
  code: string;
  currencyCode: string;
  /** yyyy-MM-dd */
  date: string;
  buyRate: number;
  sellRate: number;
  accountingRate: number;
  isActive: boolean;
  /** Row version from the backend; sent back when saving so a change made meanwhile by someone else is not overwritten. */
  version?: number;
}

export type SaveExchangeRateInput = Pick<ExchangeRate, 'currencyCode' | 'date' | 'buyRate' | 'sellRate' | 'accountingRate' | 'isActive' | 'version'>;

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

/** What a picker needs of a department (GET /api/lookups/departments). */
export interface DepartmentOption {
  code: string;
  name: string;
  isActive: boolean;
}

export type DepartmentRow = Department & { stamp: RecordStamp };

export const departmentsApi = createCatalogApi<DepartmentRow, SaveDepartmentInput>({
  url: '/api/settings/departments', fileName: 'DanhMucPhongBan'
});

export interface TaxRate {
  code: string;
  name: string;
  /** VAT, IMPORT or OTHER. */
  taxType: string;
  /** Percent, 0 to 100. */
  rate: number;
  isExempt: boolean;
  note?: string | null;
  isActive: boolean;
  version?: number;
}

export type TaxRateRow = TaxRate & { stamp: RecordStamp };
export type SaveTaxRateInput = Omit<TaxRate, 'note'> & { note: string };

export const taxRatesApi = createCatalogApi<TaxRateRow, SaveTaxRateInput>({
  url: '/api/settings/tax-rates', fileName: 'DanhMucMaThue'
});

export type CurrencyRow = Currency & { stamp: RecordStamp };

export const currenciesApi = createCatalogApi<CurrencyRow, Currency>({
  url: '/api/settings/currencies', fileName: 'DanhMucNgoaiTe'
});

export type ExchangeRateRow = ExchangeRate & { stamp: RecordStamp };

export const exchangeRatesApi = {
  ...createCatalogApi<ExchangeRateRow, SaveExchangeRateInput>({ url: '/api/settings/exchange-rates', fileName: 'DanhMucTyGia' }),
  /** Accounting rate for a voucher dated `date` (yyyy-MM-dd); 1 for the base currency. Open to every signed-in user. */
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

/** One status of one voucher type in one company unit (Settings › Trạng thái chứng từ). */
export interface VoucherStatusRow {
  unitCode: string;
  voucherType: string;
  voucherName: string;
  function: string;
  /** Draft, Pending, Approved, Posted or Cancelled. */
  status: 'Draft' | 'Pending' | 'Approved' | 'Posted' | 'Cancelled';
  /** Name this unit set (empty = default) and its English name. */
  name?: string | null;
  nameEn?: string | null;
  defaultName: string;
  /** The name in the user's language. */
  displayName: string;
  isEnabled: boolean;
  /** Only the approval step can be switched off. */
  canDisable: boolean;
  order: number;
  version: number;
}

export interface SaveVoucherStatusInput {
  name: string | null;
  nameEn: string | null;
  isEnabled: boolean;
  version: number;
}

export const voucherStatusesApi = {
  getAll: (unitCode: string) => apiRequest<VoucherStatusRow[]>('GET', `/api/voucher-statuses?unit=${encodeURIComponent(unitCode)}`),
  update: (unitCode: string, row: Pick<VoucherStatusRow, 'voucherType' | 'status'>, input: SaveVoucherStatusInput) =>
    apiRequest<VoucherStatusRow>('PUT', `/api/voucher-statuses/${encodeURIComponent(row.voucherType)}/${row.status}?unit=${encodeURIComponent(unitCode)}`, input)
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

export type LoginNoticeKind = 'INFO' | 'WELCOME' | 'MAINTENANCE' | 'RULE' | 'BACKGROUND';

export interface LoginNotice {
  code: string;
  title: string;
  content: string;
  titleEn?: string | null;
  contentEn?: string | null;
  kind: LoginNoticeKind;
  /** yyyy-MM-dd, inclusive; empty = already shown / no end. */
  startDate?: string | null;
  endDate?: string | null;
  /** A pinned notice keeps the big slot of the login screen. */
  pinned: boolean;
  /** Code of the picture (see loginNoticeImagesApi); empty = text only. */
  loginImageCode?: string | null;
  sortOrder: number;
  isActive: boolean;
  version?: number;
}

export type LoginNoticeRow = LoginNotice & { stamp: RecordStamp };
export type SaveLoginNoticeInput = Omit<LoginNotice, 'titleEn' | 'contentEn' | 'loginImageCode'> & { titleEn: string; contentEn: string; loginImageCode: string };

export const loginNoticesApi = createCatalogApi<LoginNoticeRow, SaveLoginNoticeInput>({
  url: '/api/settings/login-notices', fileName: 'ThongBaoTrangDangNhap'
});

/** The picture of a login notice is read without signing in (the login screen shows it). */
export const loginImageUrl = (code: string): string => `${API_BASE_URL}/api/auth/notice-images/${encodeURIComponent(code)}`;

export const loginNoticeImagesApi = {
  /** Shrinks the picture in the browser, uploads it and returns its code. */
  async upload(file: File): Promise<string> {
    const image = await prepareImage(file);
    const result = await apiRequest<{ code: string }>('POST', '/api/settings/login-notice-images',
      { contentType: image.contentType, dataBase64: image.dataBase64 });
    return result.code;
  }
};

export type BannerLevel = 'INFO' | 'WARNING' | 'URGENT';

export interface Banner {
  code: string;
  message: string;
  messageEn?: string | null;
  level: BannerLevel;
  /** ISO instants (UTC); empty = already shown / until switched off. */
  startAt?: string | null;
  endAt?: string | null;
  /** Company unit codes separated by commas; empty = every unit. */
  unitCodes: string;
  sortOrder: number;
  isActive: boolean;
  version?: number;
}

export type BannerRow = Banner & { stamp: RecordStamp };
export type SaveBannerInput = Omit<Banner, 'messageEn' | 'startAt' | 'endAt'> & { messageEn: string; startAt: string | null; endAt: string | null };

export const bannersApi = createCatalogApi<BannerRow, SaveBannerInput>({
  url: '/api/settings/banners', fileName: 'ThanhThongBaoHeThong'
});

/** A notice in force for the working unit, text already in the user's language. `version` changes when it is edited. */
export interface ActiveBanner {
  code: string;
  level: BannerLevel;
  message: string;
  endAt?: string | null;
  version: number;
}

export const activeBannersApi = {
  list: () => apiRequest<ActiveBanner[]>('GET', '/api/banners/active')
};
