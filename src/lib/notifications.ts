import { Capacitor } from '@capacitor/core';
import {
  LocalNotifications,
  type PermissionStatus,
} from '@capacitor/local-notifications';

export type ChannelKey =
  | 'dues'
  | 'installments'
  | 'bills'
  | 'budgets'
  | 'goals'
  | 'maturities'
  | 'documents'
  | 'daily_reminder';

export interface NotificationChannelInfo {
  id: ChannelKey;
  i18nKey: string;
  defaultImportance: 1 | 2 | 3 | 4 | 5;
}

export const NOTIFICATION_CHANNELS: readonly NotificationChannelInfo[] = [
  { id: 'dues', i18nKey: 'notifications.channelDues', defaultImportance: 4 },
  { id: 'installments', i18nKey: 'notifications.channelInstallments', defaultImportance: 4 },
  { id: 'bills', i18nKey: 'notifications.channelBills', defaultImportance: 3 },
  { id: 'budgets', i18nKey: 'notifications.channelBudgets', defaultImportance: 3 },
  { id: 'goals', i18nKey: 'notifications.channelGoals', defaultImportance: 3 },
  { id: 'maturities', i18nKey: 'notifications.channelMaturities', defaultImportance: 4 },
  { id: 'documents', i18nKey: 'notifications.channelDocuments', defaultImportance: 3 },
  { id: 'daily_reminder', i18nKey: 'notifications.channelDailyReminder', defaultImportance: 3 },
] as const;

export interface NotificationPreferences {
  masterEnabled: boolean;
  channels: Record<ChannelKey, boolean>;
  dailyReminderTime: string; // e.g. "21:00"
}

const PREFS_KEY = 'tohobil.notification_prefs';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  masterEnabled: true,
  channels: {
    dues: true,
    installments: true,
    bills: true,
    budgets: true,
    goals: true,
    maturities: true,
    documents: true,
    daily_reminder: true,
  },
  dailyReminderTime: '21:00',
};

export function getNotificationPreferences(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES, channels: { ...DEFAULT_PREFERENCES.channels } };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      channels: { ...DEFAULT_PREFERENCES.channels, ...(parsed.channels ?? {}) },
    };
  } catch {
    return { ...DEFAULT_PREFERENCES, channels: { ...DEFAULT_PREFERENCES.channels } };
  }
}

export function saveNotificationPreferences(
  updates: Partial<NotificationPreferences>,
): NotificationPreferences {
  const current = getNotificationPreferences();
  const next: NotificationPreferences = {
    ...current,
    ...updates,
    channels: {
      ...current.channels,
      ...(updates.channels ?? {}),
    },
  };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota
  }

  // Update native channels & reminder
  if (Capacitor.isNativePlatform()) {
    void setupNotificationChannels();
    if (next.masterEnabled && next.channels.daily_reminder) {
      void scheduleDailyReminder(next.dailyReminderTime);
    } else {
      void cancelDailyReminder();
    }
  }

  return next;
}

export async function setupNotificationChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    for (const ch of NOTIFICATION_CHANNELS) {
      await LocalNotifications.createChannel({
        id: ch.id,
        name: ch.id.replace('_', ' ').toUpperCase(),
        description: `Tohobil channel for ${ch.id}`,
        importance: ch.defaultImportance,
        visibility: 1,
        vibration: true,
      });
    }
  } catch {
    // Channel creation unsupported or browser
  }
}

export async function checkNotificationPermission(): Promise<PermissionStatus> {
  if (!Capacitor.isNativePlatform()) {
    return { display: 'granted' };
  }
  try {
    return await LocalNotifications.checkPermissions();
  } catch {
    return { display: 'prompt' };
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true;
  }
  try {
    const res = await LocalNotifications.requestPermissions();
    return res.display === 'granted';
  } catch {
    return false;
  }
}

const DAILY_REMINDER_ID = 90001;

export async function scheduleDailyReminder(timeStr = '21:00'): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const [hStr, mStr] = timeStr.split(':');
    const hour = parseInt(hStr ?? '21', 10);
    const minute = parseInt(mStr ?? '0', 10);

    const now = new Date();
    const scheduled = new Date();
    scheduled.setHours(hour, minute, 0, 0);
    if (scheduled.getTime() <= now.getTime()) {
      // If already past today, schedule for tomorrow
      scheduled.setDate(scheduled.getDate() + 1);
    }

    await LocalNotifications.cancel({ notifications: [{ id: DAILY_REMINDER_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: DAILY_REMINDER_ID,
          title: 'Tohobil · তহবিল',
          body: "Did you record today's spending? / আজকের খরচ লিখেছেন তো?",
          channelId: 'daily_reminder',
          schedule: {
            at: scheduled,
            repeats: true,
            every: 'day',
          },
          smallIcon: 'ic_stat_name',
        },
      ],
    });
  } catch {
    // Non-native fallback
  }
}

export async function cancelDailyReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: DAILY_REMINDER_ID }] });
  } catch {
    // Ignore
  }
}

export async function sendTestNotification(
  title = 'Tohobil Notification Test',
  body = 'Notifications are working properly! তহবিল নোটিফিকেশন সচল রয়েছে।',
  channelId: ChannelKey = 'bills',
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true;
  }
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 80000) + 1000,
          title,
          body,
          channelId,
          smallIcon: 'ic_stat_name',
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}
