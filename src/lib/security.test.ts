import { describe, it, expect, beforeEach } from 'vitest';
import {
  setAppPin,
  verifyAppPin,
  removeAppPin,
  getSecuritySettings,
  saveSecuritySettings,
  toggleHideBalances,
  formatMasked,
  hashPin,
  generateSalt,
  getIsAppLocked,
  lockApp,
  unlockApp,
  handleAppPause,
  handleAppResume,
} from './security';

describe('security', () => {
  beforeEach(() => {
    localStorage.clear();
    removeAppPin();
  });

  it('generates unique salts and hashes pin reliably', async () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    expect(salt1).not.toBe(salt2);

    const hashA = await hashPin('1234', salt1);
    const hashB = await hashPin('1234', salt1);
    const hashC = await hashPin('5678', salt1);

    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(hashC);
  });

  it('sets, verifies, and removes app PIN', async () => {
    await setAppPin('9876');
    expect(getSecuritySettings().appLockEnabled).toBe(true);

    const valid = await verifyAppPin('9876');
    expect(valid).toBe(true);

    const invalid = await verifyAppPin('0000');
    expect(invalid).toBe(false);

    removeAppPin();
    expect(getSecuritySettings().appLockEnabled).toBe(false);
  });

  it('toggles hideBalances and masks amounts correctly', () => {
    saveSecuritySettings({ hideBalances: false });
    expect(formatMasked('৳ 1,500.00')).toBe('৳ 1,500.00');

    toggleHideBalances();
    expect(formatMasked('৳ 1,500.00')).toBe('৳ ••••••');
    expect(formatMasked('500')).toBe('••••••');

    toggleHideBalances();
    expect(formatMasked('৳ 1,500.00')).toBe('৳ 1,500.00');
  });

  it('handles lock and unlock state with auto-lock timer', async () => {
    await setAppPin('1111');
    lockApp();
    expect(getIsAppLocked()).toBe(true);

    unlockApp();
    expect(getIsAppLocked()).toBe(false);

    // Test immediate lock on pause (autoLockSeconds = 0)
    saveSecuritySettings({ autoLockSeconds: 0 });
    handleAppPause();
    handleAppResume();
    expect(getIsAppLocked()).toBe(true);
  });
});
