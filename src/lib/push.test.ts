import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncPushToken, removePushToken, trackPushOpened, updateMarketingOptIn } from './push';
import * as featureFlags from './featureFlags';
import * as identity from '../app/identity';

vi.mock('../app/identity', () => ({
  api: vi.fn(),
}));

describe('push token synchronization and tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips token registration when feature flag is disabled', async () => {
    vi.spyOn(featureFlags, 'isFeatureEnabled').mockResolvedValue(false);
    const result = await syncPushToken('test-token-123');
    expect(result).toBe(false);
    expect(identity.api).not.toHaveBeenCalled();
  });

  it('updates push token when flag is enabled', async () => {
    vi.spyOn(featureFlags, 'isFeatureEnabled').mockResolvedValue(true);
    vi.mocked(identity.api).mockResolvedValue({ ok: true });

    const result = await syncPushToken('test-token-123');
    expect(result).toBe(true);
    expect(identity.api).toHaveBeenCalledWith('devices/push-token', {
      method: 'PUT',
      body: JSON.stringify({ push_token: 'test-token-123' }),
    });
  });

  it('removes push token on logout', async () => {
    vi.mocked(identity.api).mockResolvedValue({ ok: true });
    const result = await removePushToken();
    expect(result).toBe(true);
    expect(identity.api).toHaveBeenCalledWith('devices/push-token', {
      method: 'DELETE',
    });
  });

  it('tracks push opened events', async () => {
    vi.mocked(identity.api).mockResolvedValue({ tracked: true });
    const result = await trackPushOpened(42);
    expect(result).toBe(true);
    expect(identity.api).toHaveBeenCalledWith('push/opened', {
      method: 'POST',
      body: JSON.stringify({ campaign_id: 42 }),
    });
  });

  it('updates marketing push opt-in status', async () => {
    vi.mocked(identity.api).mockResolvedValue({ ok: true });
    const result = await updateMarketingOptIn(true);
    expect(result).toBe(true);
    expect(identity.api).toHaveBeenCalledWith('me', {
      method: 'PUT',
      body: JSON.stringify({ marketing_push_opt_in: 1 }),
    });
  });
});
