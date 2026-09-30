// Login, the signed-in user's profile and the working company unit (backend: /api/auth).
import { apiRequest, tokenStore } from './apiClient';
import { UserProfile } from '../types';

export interface LoginUnitOption {
  id: string;
  code: string;
  name: string;
  shortName?: string;
  isDefault: boolean;
}

interface AuthResult {
  token: string;
  expiresAt: string;
  user: UserProfile;
}

export interface UpdateMyProfileInput {
  fullName: string;
  email?: string;
  phone?: string;
  department?: string;
  avatar?: string;
  themePref: 'light' | 'dark';
  notificationsEnabled: boolean;
}

const acceptSession = (result: AuthResult): UserProfile => {
  tokenStore.set(result.token);
  return result.user;
};

export const authService = {
  hasSession: () => tokenStore.get() !== null,

  getLoginUnits: () => apiRequest<LoginUnitOption[]>('GET', '/api/auth/company-units', undefined, { anonymous: true }),

  async login(username: string, password: string, unitCode: string): Promise<UserProfile> {
    return acceptSession(await apiRequest<AuthResult>('POST', '/api/auth/login',
      { username, password, unitCode }, { anonymous: true }));
  },

  getMe: () => apiRequest<UserProfile>('GET', '/api/auth/me'),

  async switchUnit(unitCode: string): Promise<UserProfile> {
    return acceptSession(await apiRequest<AuthResult>('POST', '/api/auth/switch-unit', { unitCode }));
  },

  updateMyProfile: (input: UpdateMyProfileInput) => apiRequest<UserProfile>('PUT', '/api/auth/me/profile', input),

  /** Other sessions of the account stop working; this one receives a new token. */
  async changePassword(currentPassword: string, newPassword: string): Promise<UserProfile> {
    return acceptSession(await apiRequest<AuthResult>('PUT', '/api/auth/me/password',
      { currentPassword, newPassword }));
  },

  logout() {
    tokenStore.clear();
  }
};
