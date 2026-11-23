import { api } from '../app/identity';
import { isFeatureEnabled } from './featureFlags';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { FirebaseMessaging, type Notification } from '@capacitor-firebase/messaging';

const ENABLED_KEY = 'tohobil.push.enabled';
const MARKETING_KEY = 'tohobil.push.marketing';
const OPEN_QUEUE_KEY = 'tohobil.push.opens';
let listenersStarted = false;

export interface PushPayload {
  campaign_id?: string;
  title: string;
  body: string;
  image_url?: string;
  logo_mode?: 'none' | 'app' | 'custom';
  logo_url?: string;
  action_type?: 'open_app' | 'screen' | 'url';
  action_value?: string;
  channel?: string;
  type?: string;
}

export function parsePushPayload(notification: Notification): PushPayload | null {
  const raw = notification.data;
  const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const title = typeof data.title === 'string' ? data.title : notification.title;
  const body = typeof data.body === 'string' ? data.body : notification.body;
  if (!title || !body) return null;
  const optional = (key: string) => typeof data[key] === 'string' ? data[key] as string : undefined;
  return { title, body, campaign_id: optional('campaign_id'), image_url: optional('image_url'), logo_mode: optional('logo_mode') as PushPayload['logo_mode'], logo_url: optional('logo_url'), action_type: optional('action_type') as PushPayload['action_type'], action_value: optional('action_value'), channel: optional('channel'), type: optional('type') };
}

/** Called once after login; listeners also handle token rotation while app is open. */
export async function startPushListeners(): Promise<void> {
  if (!Capacitor.isNativePlatform() || listenersStarted) return;
  await FirebaseMessaging.addListener('tokenReceived', ({ token }) => { void syncPushToken(token); });
  await FirebaseMessaging.addListener('notificationReceived', ({ notification }) => {
    const payload = parsePushPayload(notification);
    if (!payload) return;
    if (payload.type === 'status_check') window.dispatchEvent(new Event('online'));
    else if (document.visibilityState === 'visible') window.dispatchEvent(new CustomEvent('tohobil:push', { detail: payload }));
  });
  await FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => {
    const payload = parsePushPayload(notification);
    if (!payload) return;
    window.dispatchEvent(new CustomEvent('tohobil:push-open', { detail: payload }));
  });
  listenersStarted = true;
}

export async function refreshPushRegistration(requestPermission = false): Promise<boolean> {
  await flushPushOpenQueue();
  if (!Capacitor.isNativePlatform() || !(await isFeatureEnabled('push'))) return false;
  const enabled = (await Preferences.get({ key: ENABLED_KEY })).value === 'true';
  if (!enabled && !requestPermission) return false;
  let permission = await FirebaseMessaging.checkPermissions();
  if (permission.receive !== 'granted' && requestPermission) permission = await FirebaseMessaging.requestPermissions();
  if (permission.receive !== 'granted') return false;
  await Preferences.set({ key: ENABLED_KEY, value: 'true' });
  await startPushListeners();
  const { token } = await FirebaseMessaging.getToken();
  if (!(await syncPushToken(token))) return false;
  await FirebaseMessaging.subscribeToTopic({ topic: 'all' });
  const profile = await api<{ user: { marketing_push_opt_in?: number | boolean } }>('me').catch(() => null);
  const marketing = profile?.user.marketing_push_opt_in === 1 || profile?.user.marketing_push_opt_in === true;
  await Preferences.set({ key: MARKETING_KEY, value: marketing ? 'true' : 'false' });
  if (marketing) {
    await FirebaseMessaging.subscribeToTopic({ topic: `lang_${localStorage.getItem('tohobil.language') === 'bn' ? 'bn' : 'en'}` });
  } else {
    await Promise.all(['lang_en', 'lang_bn'].map(topic => FirebaseMessaging.unsubscribeFromTopic({ topic }).catch(() => {})));
  }
  if (Capacitor.getPlatform() === 'android') await FirebaseMessaging.subscribeToTopic({ topic: 'android' });
  return true;
}

export async function switchPushLanguage(language: 'en' | 'bn'): Promise<void> {
  if (!Capacitor.isNativePlatform() || !(await isFeatureEnabled('push'))) return;
  const enabled = (await Preferences.get({ key: ENABLED_KEY })).value === 'true';
  const marketing = (await Preferences.get({ key: MARKETING_KEY })).value === 'true';
  if (!enabled || !marketing) return;
  await FirebaseMessaging.unsubscribeFromTopic({ topic: `lang_${language === 'bn' ? 'en' : 'bn'}` });
  await FirebaseMessaging.subscribeToTopic({ topic: `lang_${language}` });
}

export interface PushTokenPayload {
  token: string;
}

/**
 * Registers/updates the FCM push token on the server if push feature is enabled.
 */
export async function syncPushToken(token: string): Promise<boolean> {
  const enabled = await isFeatureEnabled('push');
  if (!enabled || !token) {
    return false;
  }

  try {
    await api('devices/push-token', {
      method: 'PUT',
      body: JSON.stringify({ push_token: token }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * De-registers the push token from the server on logout
 */
export async function removePushToken(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Promise.all(['all','lang_en','lang_bn', ...(Capacitor.getPlatform() === 'android' ? ['android'] : [])].map(topic => FirebaseMessaging.unsubscribeFromTopic({ topic }).catch(() => {})));
      await FirebaseMessaging.deleteToken().catch(() => {});
      await Preferences.remove({ key: ENABLED_KEY });
      await Preferences.remove({ key: MARKETING_KEY });
    }
  } catch {
    // Still remove the server registration when local cleanup fails.
  }
  try {
    await api('devices/push-token', {
      method: 'DELETE',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Tracks push open events with the backend (SPEC 19.4 & 19.7)
 */
export async function trackPushOpened(campaignId?: number): Promise<boolean> {
  try {
    await api('push/opened', {
      method: 'POST',
      body: JSON.stringify({ campaign_id: campaignId ?? null }),
    });
    return true;
  } catch {
    const saved = await Preferences.get({ key: OPEN_QUEUE_KEY });
    let events: Array<{ campaign_id: number | null }> = [];
    try { if (saved.value) events = JSON.parse(saved.value); } catch { events = []; }
    if (!Array.isArray(events)) events = [];
    events.push({ campaign_id: campaignId ?? null });
    await Preferences.set({ key: OPEN_QUEUE_KEY, value: JSON.stringify(events.slice(-100)) });
    return false;
  }
}

export async function flushPushOpenQueue(): Promise<void> {
  const saved = await Preferences.get({ key: OPEN_QUEUE_KEY });
  if (!saved.value) return;
  let events: Array<{ campaign_id: number | null }>;
  try { events = JSON.parse(saved.value); } catch { events = []; }
  if (!Array.isArray(events)) events = [];
  const remaining = [];
  for (const event of events) {
    try {
      await api('push/opened', { method: 'POST', body: JSON.stringify(event) });
    } catch {
      remaining.push(event);
    }
  }
  if (remaining.length) await Preferences.set({ key: OPEN_QUEUE_KEY, value: JSON.stringify(remaining) });
  else await Preferences.remove({ key: OPEN_QUEUE_KEY });
}

/**
 * Updates marketing push opt-in preference on the server
 */
export async function updateMarketingOptIn(optIn: boolean): Promise<boolean> {
  try {
    await api('me', {
      method: 'PUT',
      body: JSON.stringify({ marketing_push_opt_in: optIn ? 1 : 0 }),
    });
    if (Capacitor.isNativePlatform() && (await Preferences.get({ key: ENABLED_KEY })).value === 'true') {
      await Preferences.set({ key: MARKETING_KEY, value: optIn ? 'true' : 'false' });
      const topic = `lang_${localStorage.getItem('tohobil.language') === 'bn' ? 'bn' : 'en'}`;
      if (optIn) await FirebaseMessaging.subscribeToTopic({ topic });
      else await Promise.all(['lang_en', 'lang_bn'].map(value => FirebaseMessaging.unsubscribeFromTopic({ topic: value }).catch(() => {})));
    }
    return true;
  } catch {
    return false;
  }
}
