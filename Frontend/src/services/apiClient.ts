// HTTP client for the ERP backend (ServerService). Every backend call goes through apiRequest.

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:2512').replace(/\/$/, '');
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

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Tài khoản của bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu yêu cầu.',
  429: 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.'
};

export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  options: { anonymous?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
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
    throw new ApiError(0, 'Không kết nối được máy chủ. Kiểm tra backend và cấu hình VITE_API_URL.');
  }

  if (!response.ok) {
    let message = STATUS_MESSAGES[response.status] || `Máy chủ trả về lỗi ${response.status}.`;
    try {
      const data = await response.json();
      if (data && typeof data.message === 'string') message = data.message;
    } catch {
      // Keep the generic message when the body is not JSON.
    }
    if (response.status === 401 && !options.anonymous) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Message to show in a toast for any error thrown by an API call. */
export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
