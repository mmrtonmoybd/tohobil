import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_FEATURE_FLAGS,
  getFeatureFlags,
  isFeatureEnabled,
  setFeatureFlag,
  syncFeatureFlags,
  subscribeFeatureFlags,
} from './featureFlags';

describe('featureFlags module', () => {
  beforeEach(async () => {
    // Reset flags to defaults
    await syncFeatureFlags(DEFAULT_FEATURE_FLAGS);
  });

  it('provides default feature flags initially false', async () => {
    const flags = await getFeatureFlags();
    expect(flags.receiptOcr).toBe(false);
    expect(flags.widget).toBe(false);
    expect(flags.sharedBooks).toBe(false);
    expect(flags.push).toBe(false);
  });

  it('updates a specific flag and persists', async () => {
    expect(await isFeatureEnabled('receiptOcr')).toBe(false);
    await setFeatureFlag('receiptOcr', true);
    expect(await isFeatureEnabled('receiptOcr')).toBe(true);

    const flags = await getFeatureFlags();
    expect(flags.receiptOcr).toBe(true);
  });

  it('syncs remote flags correctly', async () => {
    await syncFeatureFlags({
      widget: true,
      sharedBooks: true,
    });

    const flags = await getFeatureFlags();
    expect(flags.widget).toBe(true);
    expect(flags.sharedBooks).toBe(true);
    expect(flags.push).toBe(false);
  });

  it('notifies subscribers on flag change', async () => {
    let observed: boolean | null = null;
    const unsub = subscribeFeatureFlags((flags) => {
      observed = flags.push;
    });

    expect(observed).toBe(false);
    await setFeatureFlag('push', true);
    expect(observed).toBe(true);

    unsub();
  });
});
