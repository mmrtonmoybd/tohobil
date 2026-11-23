import { describe, expect, it, vi, beforeEach } from 'vitest';
import { uploadQueue, PREF_WIFI_ONLY } from './uploadQueue';
import { Preferences } from '@capacitor/preferences';

describe('uploadQueue', () => {
  beforeEach(async () => {
    await Preferences.clear();
  });

  it('initializes with default state', () => {
    const state = uploadQueue.getState();
    expect(state).toHaveProperty('isUploading');
    expect(state).toHaveProperty('pendingCount');
    expect(state).toHaveProperty('wifiOnly');
    expect(state).toHaveProperty('lastError');
  });

  it('sets and persists wifiOnly preference', async () => {
    await uploadQueue.setWifiOnly(true);
    expect(await uploadQueue.getWifiOnly()).toBe(true);
    expect(uploadQueue.getState().wifiOnly).toBe(true);

    const { value } = await Preferences.get({ key: PREF_WIFI_ONLY });
    expect(value).toBe('true');

    await uploadQueue.setWifiOnly(false);
    expect(await uploadQueue.getWifiOnly()).toBe(false);
    expect(uploadQueue.getState().wifiOnly).toBe(false);
  });

  it('notifies subscribers on state changes', async () => {
    const listener = vi.fn();
    const unsubscribe = uploadQueue.subscribe(listener);

    expect(listener).toHaveBeenCalled();
    const callsBefore = listener.mock.calls.length;

    await uploadQueue.setWifiOnly(true);
    expect(listener.mock.calls.length).toBeGreaterThan(callsBefore);

    unsubscribe();
  });
});
