import { useEffect, useState } from 'react';
import { Preferences } from '@capacitor/preferences';

export interface FeatureFlags {
  receiptOcr: boolean;
  widget: boolean;
  sharedBooks: boolean;
  push: boolean;
  pro: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  receiptOcr: false,
  widget: false,
  sharedBooks: false,
  push: false,
  pro: false,
};

const STORAGE_KEY = 'tohobil.feature_flags';
let cachedFlags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
let isLoaded = false;
const listeners = new Set<(flags: FeatureFlags) => void>();

function notify(): void {
  for (const listener of listeners) {
    try {
      listener({ ...cachedFlags });
    } catch {
      // ignore listener errors
    }
  }
}

export async function loadFeatureFlags(): Promise<FeatureFlags> {
  if (isLoaded) return { ...cachedFlags };
  try {
    const res = await Preferences.get({ key: STORAGE_KEY });
    if (res.value) {
      const parsed = JSON.parse(res.value) as Partial<FeatureFlags>;
      cachedFlags = { ...DEFAULT_FEATURE_FLAGS, ...parsed };
    }
  } catch {
    // fallback to defaults on error
  }
  isLoaded = true;
  notify();
  return { ...cachedFlags };
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  if (!isLoaded) {
    return loadFeatureFlags();
  }
  return { ...cachedFlags };
}

export async function isFeatureEnabled(flag: keyof FeatureFlags): Promise<boolean> {
  const flags = await getFeatureFlags();
  return Boolean(flags[flag]);
}

export async function setFeatureFlag(flag: keyof FeatureFlags, enabled: boolean): Promise<void> {
  if (!isLoaded) {
    await loadFeatureFlags();
  }
  cachedFlags = { ...cachedFlags, [flag]: enabled };
  try {
    await Preferences.set({
      key: STORAGE_KEY,
      value: JSON.stringify(cachedFlags),
    });
  } catch {
    // ignore preference storage errors
  }
  notify();
}

export async function syncFeatureFlags(remoteFlags: Partial<FeatureFlags>): Promise<FeatureFlags> {
  if (!isLoaded) {
    await loadFeatureFlags();
  }
  cachedFlags = {
    ...cachedFlags,
    ...remoteFlags,
  };
  try {
    await Preferences.set({
      key: STORAGE_KEY,
      value: JSON.stringify(cachedFlags),
    });
  } catch {
    // ignore
  }
  notify();
  return { ...cachedFlags };
}

export function subscribeFeatureFlags(listener: (flags: FeatureFlags) => void): () => void {
  listeners.add(listener);
  listener({ ...cachedFlags });
  return () => {
    listeners.delete(listener);
  };
}

export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => cachedFlags[flag] ?? false);

  useEffect(() => {
    // Trigger initial load if not yet loaded
    if (!isLoaded) {
      void loadFeatureFlags();
    }
    const unsub = subscribeFeatureFlags((flags) => {
      setEnabled(Boolean(flags[flag]));
    });
    return unsub;
  }, [flag]);

  return enabled;
}
