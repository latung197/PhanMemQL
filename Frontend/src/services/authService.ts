// Login, the signed-in user's profile and the working company unit (backend: /api/auth).
import { apiRequest, tokenStore } from './apiClient';
import { UserProfile } from '../types';

/** A notice beside the login form, already in the visitor's language. */
export interface LoginNotice {
  code: string;
  kind: 'INFO' | 'WELCOME' | 'MAINTENANCE' | 'RULE' | 'BACKGROUND';
  title: string;
  content: string;
  pinned: boolean;
  /** Picture code; for the kind BACKGROUND it is the background of the login screen. */
  imageCode?: string | null;
}

/** Company name, slogan and footer of the login screen (company profile); an empty text = the built-in one. */
export interface LoginBranding {
  name: string;
  slogan: string;
  footer: string;
}

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

/** Active language for the language picker (backend sys_language). */
export interface LanguageOption {
  code: string;
  nativeName: string;
  isDefault: boolean;
}

export interface UpdateMyProfileInput {
  fullName: string;
  email?: string;
  phone?: string;
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

  getLoginBranding: () => apiRequest<LoginBranding>('GET', '/api/auth/branding', undefined, { anonymous: true }),

  getLoginNotices: () => apiRequest<LoginNotice[]>('GET', '/api/auth/notices', undefined, { anonymous: true }),

  getLoginUnits: () => apiRequest<LoginUnitOption[]>('GET', '/api/auth/company-units', undefined, { anonymous: true }),

  async login(username: string, password: string, unitCode: string): Promise<UserProfile> {
    return acceptSession(await apiRequest<AuthResult>('POST', '/api/auth/login',
      { username, password, unitCode }, { anonymous: true }));
  },

  getMe: () => apiRequest<UserProfile>('GET', '/api/auth/me'),

  /** Also before login (language picker of the login screen). */
  getLanguages: () => apiRequest<LanguageOption[]>('GET', '/api/auth/languages', undefined, { anonymous: true }),

  /** The user's own language; null = the default language of the company. */
  setMyLanguage: (language: string | null) => apiRequest<UserProfile>('PUT', '/api/auth/me/language', { language }),

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
