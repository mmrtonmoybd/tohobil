import { Capacitor } from '@capacitor/core';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { PrivacyScreen } from '@capacitor-community/privacy-screen';

export interface SecuritySettings {
  appLockEnabled: boolean;
  pinSalt: string;
  pinHash: string;
  biometricsEnabled: boolean;
  autoLockSeconds: number; // 0 (immediately), 30, 60, 300 (5m), 900 (15m)
  privacyScreenEnabled: boolean;
  hideBalances: boolean;
}

const SETTINGS_KEY = 'tohobil.security';

const DEFAULT_SETTINGS: SecuritySettings = {
  appLockEnabled: false,
  pinSalt: '',
  pinHash: '',
  biometricsEnabled: false,
  autoLockSeconds: 60, // default 1 minute
  privacyScreenEnabled: false,
  hideBalances: false,
};

let inMemorySettings: SecuritySettings = loadSettings();
let isAppLocked = inMemorySettings.appLockEnabled;
let lastBackgroundTimestamp = 0;
const lockListeners = new Set<(isLocked: boolean) => void>();
const balanceListeners = new Set<(hide: boolean) => void>();

function loadSettings(): SecuritySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function getSecuritySettings(): SecuritySettings {
  return { ...inMemorySettings };
}

export function saveSecuritySettings(settings: Partial<SecuritySettings>): void {
  inMemorySettings = { ...inMemorySettings, ...settings };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(inMemorySettings));
  } catch {
    // Ignore storage quota errors
  }

  // Update privacy screen on native device
  if (settings.privacyScreenEnabled !== undefined) {
    void applyPrivacyScreen(settings.privacyScreenEnabled);
  }

  if (settings.hideBalances !== undefined) {
    balanceListeners.forEach((fn) => fn(settings.hideBalances ?? false));
  }
}

export function subscribeHideBalances(cb: (hide: boolean) => void): () => void {
  balanceListeners.add(cb);
  return () => {
    balanceListeners.delete(cb);
  };
}

export function isHideBalances(): boolean {
  return inMemorySettings.hideBalances;
}

export function toggleHideBalances(): boolean {
  const next = !inMemorySettings.hideBalances;
  saveSecuritySettings({ hideBalances: next });
  return next;
}

export function formatMasked(valueFormatted: string): string {
  if (!inMemorySettings.hideBalances) return valueFormatted;
  // If starts with ৳, preserve the sign
  if (valueFormatted.trim().startsWith('৳')) {
    return '৳ ••••••';
  }
  return '••••••';
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey'],
  );
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 50000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt'],
  );
  const exported = await crypto.subtle.exportKey('raw', derivedKey);
  return Array.from(new Uint8Array(exported))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function setAppPin(pin: string): Promise<void> {
  const salt = generateSalt();
  const hash = await hashPin(pin, salt);
  saveSecuritySettings({
    appLockEnabled: true,
    pinSalt: salt,
    pinHash: hash,
  });
  isAppLocked = false;
  notifyLockListeners();
}

export function removeAppPin(): void {
  saveSecuritySettings({
    appLockEnabled: false,
    pinSalt: '',
    pinHash: '',
    biometricsEnabled: false,
  });
  isAppLocked = false;
  notifyLockListeners();
}

export async function verifyAppPin(pin: string): Promise<boolean> {
  if (!inMemorySettings.appLockEnabled || !inMemorySettings.pinHash) {
    return true;
  }
  const hash = await hashPin(pin, inMemorySettings.pinSalt);
  const ok = hash === inMemorySettings.pinHash;
  if (ok) {
    isAppLocked = false;
    notifyLockListeners();
  }
  return ok;
}

export async function checkBiometrics(): Promise<{ available: boolean; biometryType?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { available: false };
  }
  try {
    const result = await BiometricAuth.checkBiometry();
    return {
      available: result.isAvailable,
      biometryType: result.biometryType ? String(result.biometryType) : undefined,
    };
  } catch {
    return { available: false };
  }
}

export async function authenticateWithBiometrics(reason = 'Unlock Tohobil'): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  try {
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'Cancel',
      allowDeviceCredential: true,
      iosFallbackTitle: 'Use PIN',
      androidTitle: 'Unlock Tohobil',
      androidSubtitle: 'Confirm your identity to open the app',
    });
    isAppLocked = false;
    notifyLockListeners();
    return true;
  } catch {
    return false;
  }
}

export async function applyPrivacyScreen(enabled: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (enabled) {
      await PrivacyScreen.enable();
    } else {
      await PrivacyScreen.disable();
    }
  } catch {
    // Unsupported platform or simulator
  }
}

export function getIsAppLocked(): boolean {
  return inMemorySettings.appLockEnabled && isAppLocked;
}

export function unlockApp(): void {
  isAppLocked = false;
  notifyLockListeners();
}

export function lockApp(): void {
  if (inMemorySettings.appLockEnabled) {
    isAppLocked = true;
    notifyLockListeners();
  }
}

export function handleAppPause(): void {
  lastBackgroundTimestamp = Date.now();
  if (inMemorySettings.appLockEnabled && inMemorySettings.autoLockSeconds === 0) {
    isAppLocked = true;
    notifyLockListeners();
  }
}

export function handleAppResume(): void {
  if (!inMemorySettings.appLockEnabled) return;
  if (lastBackgroundTimestamp > 0) {
    const elapsedSeconds = (Date.now() - lastBackgroundTimestamp) / 1000;
    if (elapsedSeconds >= inMemorySettings.autoLockSeconds) {
      isAppLocked = true;
      notifyLockListeners();
    }
  }
}

export function subscribeLockState(cb: (isLocked: boolean) => void): () => void {
  lockListeners.add(cb);
  return () => {
    lockListeners.delete(cb);
  };
}

function notifyLockListeners(): void {
  const locked = inMemorySettings.appLockEnabled && isAppLocked;
  lockListeners.forEach((fn) => fn(locked));
}
