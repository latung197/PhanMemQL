// HTTP client for the ERP backend (ServerService). Every backend call goes through apiRequest.
import { storedLanguage, translate } from '../utils/i18n';

// import.meta.env is missing outside Vite (e.g. scripts/export-seed.ts run by tsx).
const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:2512').replace(/\/$/, '');
const TOKEN_KEY = 's_erp_auth_token';

/** Backend base URL, for the few callers that cannot use apiRequest (streams). */
export const API_BASE_URL = API_URL;

/** Fired when the backend rejects the token; App logs the user out. */
export const UNAUTHORIZED_EVENT = 'erp:unauthorized';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // The session still works until the page is reloaded.
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Ignore unavailable storage.
    }
  }
};

/** Messages for answers without a { message } body (texts: locales/<lang>/common.json, section api). */
const STATUS_MESSAGES: Record<number, string> = {
  401: 'api.sessionExpired',
  403: 'api.forbidden',
  404: 'api.notFound',
  429: 'api.tooManyRequests'
};

export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  options: { anonymous?: boolean } = {}
): Promise<T> {
  // The backend answers (messages, translated names) in the user's language.
  const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': storedLanguage() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = tokenStore.get();
  if (token && !options.anonymous) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError(0, translate('api.connectionFailed'));
  }

  if (!response.ok) throw await failure(response, options.anonymous);

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** The error for a rejected answer: the backend's { message }, or a generic text; a 401 signs the user out. */
async function failure(response: Response, anonymous?: boolean): Promise<ApiError> {
  let message = STATUS_MESSAGES[response.status]
    ? translate(STATUS_MESSAGES[response.status]) : translate('api.serverError', { status: response.status });
  try {
    const data = await response.json();
    if (data && typeof data.message === 'string') message = data.message;
  } catch {
    // Keep the generic message when the body is not JSON.
  }
  if (response.status === 401 && !anonymous) {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
  return new ApiError(response.status, message);
}

/** Downloads a file the backend generates (e.g. an Excel export) and saves it under `fileName`. */
export async function apiDownload(path: string, fileName: string): Promise<void> {
  const headers: Record<string, string> = { Accept: '*/*', 'Accept-Language': storedLanguage() };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { method: 'GET', headers });
  } catch {
    throw new ApiError(0, translate('api.connectionFailed'));
  }
  if (!response.ok) throw await failure(response);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Message to show in a toast for any error thrown by an API call. */
export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : translate('api.unknownError');
