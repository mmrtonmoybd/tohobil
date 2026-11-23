export interface ApiResponse<T = unknown> {
  status?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  [key: string]: unknown;
}

const BASE_URL = '/admin-api/v1';

export async function adminFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (options.method && !['GET', 'HEAD'].includes(options.method.toUpperCase()) && !['auth/login', 'auth/2fa/verify'].includes(endpoint)) {
    const csrf = sessionStorage.getItem('tohobil_admin_csrf');
    if (csrf) headers['X-Admin-CSRF'] = csrf;
  }

  const url = `${BASE_URL}/${endpoint.replace(/^\//, '')}`;
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && !['auth/login', 'auth/2fa/verify', 'auth/me'].includes(endpoint)) {
      sessionStorage.removeItem('tohobil_admin_csrf');
      window.location.href = '/admin/login';
    }
    const message = json?.error?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return json as T;
}

export async function adminUpload<T = unknown>(endpoint: string, body: FormData): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const csrf = sessionStorage.getItem('tohobil_admin_csrf');
  if (csrf) headers['X-Admin-CSRF'] = csrf;
  const response = await fetch(`${BASE_URL}/${endpoint.replace(/^\//, '')}`, {
    method: 'POST',
    headers,
    body,
    credentials: 'include',
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error?.message || `Request failed with status ${response.status}`);
  }
  return json as T;
}

export async function adminDownload(endpoint: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/${endpoint.replace(/^\//, '')}`, { credentials: 'include' });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json?.error?.message || `Request failed with status ${response.status}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'audit.csv';
  link.click();
  URL.revokeObjectURL(url);
}
