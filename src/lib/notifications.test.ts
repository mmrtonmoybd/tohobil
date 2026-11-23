import { describe, it, expect, beforeEach } from 'vitest';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  NOTIFICATION_CHANNELS,
} from './notifications';

describe('notifications', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('has 8 distinct channels as specified in SPEC', () => {
    expect(NOTIFICATION_CHANNELS).toHaveLength(8);
    const ids = NOTIFICATION_CHANNELS.map((c) => c.id);
    expect(ids).toContain('dues');
    expect(ids).toContain('installments');
    expect(ids).toContain('bills');
    expect(ids).toContain('budgets');
    expect(ids).toContain('goals');
    expect(ids).toContain('maturities');
    expect(ids).toContain('documents');
    expect(ids).toContain('daily_reminder');
  });

  it('returns default preferences and updates them properly', () => {
    const prefs = getNotificationPreferences();
    expect(prefs.masterEnabled).toBe(true);
    expect(prefs.dailyReminderTime).toBe('21:00');
    expect(prefs.channels.bills).toBe(true);

    const updated = saveNotificationPreferences({
      dailyReminderTime: '20:30',
      channels: { ...prefs.channels, daily_reminder: false },
    });

    expect(updated.dailyReminderTime).toBe('20:30');
    expect(updated.channels.daily_reminder).toBe(false);

    const reloaded = getNotificationPreferences();
    expect(reloaded.dailyReminderTime).toBe('20:30');
    expect(reloaded.channels.daily_reminder).toBe(false);
    expect(reloaded.channels.bills).toBe(true);
  });
});
