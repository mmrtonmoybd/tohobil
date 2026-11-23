import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

export interface User {
  id: string | number;
  phone: string;
  name: string;
  email: string | null;
  occupation: string | null;
  birth_date: string | null;
  city: string | null;
  country: string;
  currency: string;
  language: 'en' | 'bn';
  photo_path: string | null;
  status: string;
  status_reason: string | null;
  marketing_push_opt_in?: boolean;
}

export type AccessCode =
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_BLOCKED'
  | 'DEVICE_BLOCKED'
  | 'ACCESS_BLOCKED'
  | 'MAINTENANCE'
  | 'UPDATE_REQUIRED';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const TOKEN_KEY = 'tohobil.auth.token';
const INSTALL_KEY = 'tohobil.installation.id';

export const isAccessCode = (value: string): value is AccessCode =>
  [
    'ACCOUNT_DISABLED',
    'ACCOUNT_BLOCKED',
    'DEVICE_BLOCKED',
    'ACCESS_BLOCKED',
    'MAINTENANCE',
    'UPDATE_REQUIRED',
  ].includes(value);

export async function token(): Promise<string | null> {
  return SecureStorage.getItem(TOKEN_KEY);
}

export async function saveToken(value: string): Promise<void> {
  await SecureStorage.setItem(TOKEN_KEY, value);
}

export async function clearToken(): Promise<void> {
  await SecureStorage.removeItem(TOKEN_KEY);
}

export async function installationId(): Promise<string> {
  let id = await SecureStorage.getItem(INSTALL_KEY);
  if (!id) {
    id = crypto.randomUUID();
    await SecureStorage.setItem(INSTALL_KEY, id);
  }
  return id;
}

export function getApiBaseUrl(): string {
  if (Capacitor.isNativePlatform()) {
    const configured = import.meta.env.VITE_API_URL || '';
    if (configured.startsWith('https://')) return configured;
    return import.meta.env.MODE === 'android-dev' && configured.startsWith('http://') ? configured : '';
  }
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && !envUrl.includes('10.0.2.2')) {
    return envUrl;
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const authToken = await token();
  const installId = await installationId();
  let deviceUid = installId;

  if (Capacitor.isNativePlatform()) {
    try {
      const dev = await Device.getId();
      if (dev?.identifier) deviceUid = dev.identifier;
    } catch {
      // fallback
    }
  }

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new ApiError('API_NOT_CONFIGURED', 'An HTTPS API URL is required for this build');
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const url = `${baseUrl}/api/v1/${cleanPath}`;

  const headers: Record<string, string> = {
    'X-Device-Id': deviceUid,
    'X-Installation-Id': installId,
    'X-App-Version': '0.1.0',
    ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(init.headers as Record<string, string>),
  };

  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    response = await fetch(url, { ...init, headers, signal: controller.signal });
  } catch {
    throw new ApiError('OFFLINE', 'Network connection unavailable');
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      data.error?.code || 'HTTP_ERROR',
      data.error?.message || response.statusText,
      response.status,
    );
  }

  return data as T;
}

export async function registerDevice(): Promise<{ device_id: number }> {
  const installId = await installationId();
  let deviceUid = installId;
  let info: { manufacturer?: string; model?: string; osVersion?: string } | null = null;

  if (Capacitor.isNativePlatform()) {
    try {
      const dev = await Device.getId();
      if (dev?.identifier) deviceUid = dev.identifier;
      info = await Device.getInfo();
    } catch {
      // fallback
    }
  }

  return api<{ device_id: number }>('devices/register', {
    method: 'POST',
    body: JSON.stringify({
      device_uid: deviceUid,
      installation_id: installId,
      platform: Capacitor.getPlatform(),
      manufacturer: info?.manufacturer,
      model: info?.model,
      os_version: info?.osVersion,
      app_version: '0.1.0',
      language: localStorage.getItem('tohobil.language') || 'en',
    }),
  });
}
