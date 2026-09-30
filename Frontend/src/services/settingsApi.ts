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
  department?: string;
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
  department?: string;
  avatar?: string;
  themePref: 'light' | 'dark';
  notificationsEnabled: boolean;
  employeeCode?: string;
  isActive: boolean;
  ma_dvcs: string;
  ds_ma_dvcs: string[];
}

export interface SaveRoleInput {
  code: string;
  name: string;
  description?: string;
  permissions: PermissionMatrix;
  specialRights?: string[];
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
  setPermissions: (id: string, roleId: string | null | undefined, permissions: PermissionMatrix, specialRights?: string[]) =>
    apiRequest<UserProfile>('PUT', `/api/settings/users/${id}/permissions`, { roleId: roleId ?? null, permissions, specialRights }),
  resetPassword: (id: string, newPassword: string) =>
    apiRequest<void>('PUT', `/api/settings/users/${id}/password`, { newPassword }),
  remove: (id: string) => apiRequest<void>('DELETE', `/api/settings/users/${id}`)
};

export const rolesApi = {
  getAll: () => apiRequest<RoleDefinition[]>('GET', '/api/settings/roles'),
  create: (input: SaveRoleInput) => apiRequest<RoleDefinition>('POST', '/api/settings/roles', input),
  update: (id: string, input: SaveRoleInput) => apiRequest<RoleDefinition>('PUT', `/api/settings/roles/${id}`, input),
  /** Copies the role matrix to every user holding the role; returns the number of users. */
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
