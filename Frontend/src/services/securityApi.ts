// Sign-in security (backend: /api/auth/password-rules, /api/auth/activity, /api/settings/security/...): the password rules, the heartbeat
// that keeps a working session alive, the policy screen and the login history.
import { apiRequest } from './apiClient';
import type { PagedResult } from './paging';

export interface PasswordRules {
  minLength: number;
  requireLetter: boolean;
  requireDigit: boolean;
  requireUpper: boolean;
  requireSpecial: boolean;
  history: number;
  /** Minutes without activity before the automatic sign-out (0 = off). */
  idleTimeoutMinutes: number;
}

export interface SecurityPolicy {
  passwordMinLength: number;
  passwordRequireLetter: boolean;
  passwordRequireDigit: boolean;
  passwordRequireUpper: boolean;
  passwordRequireSpecial: boolean;
  passwordExpiryDays: number;
  passwordHistory: number;
  mustChangeAfterReset: boolean;
  loginMaxFailures: number;
  loginFailureWindowMinutes: number;
  loginBlockMinutes: number;
  idleTimeoutMinutes: number;
}

export type LoginResult = 'SUCCESS' | 'WRONG_PASSWORD' | 'UNKNOWN_USER' | 'UNIT_DENIED' | 'BLOCKED' | 'LOGOUT' | 'IDLE_TIMEOUT';
export const LOGIN_RESULTS: LoginResult[] = ['SUCCESS', 'WRONG_PASSWORD', 'UNKNOWN_USER', 'UNIT_DENIED', 'BLOCKED', 'LOGOUT', 'IDLE_TIMEOUT'];

export interface LoginHistoryRow {
  id: number;
  /** UTC */
  time: string;
  userName: string;
  fullName?: string | null;
  unitCode?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  result: LoginResult;
}

export interface LoginHistoryQuery { page: number; pageSize: number; search?: string; result?: string; from?: string; to?: string }

export const securityApi = {
  passwordRules: () => apiRequest<PasswordRules>('GET', '/api/auth/password-rules'),
  /** The user works: restarts the idle time of the session on the server. */
  activity: () => apiRequest<void>('POST', '/api/auth/activity'),
  getPolicy: () => apiRequest<SecurityPolicy>('GET', '/api/settings/security/policy'),
  savePolicy: (policy: SecurityPolicy) => apiRequest<SecurityPolicy>('PUT', '/api/settings/security/policy', policy),
  loginHistory: (query: LoginHistoryQuery) => {
    const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
    for (const key of ['search', 'result', 'from', 'to'] as const) if (query[key]) params.set(key, query[key]!);
    return apiRequest<PagedResult<LoginHistoryRow>>('GET', `/api/settings/security/login-history?${params}`);
  }
};
