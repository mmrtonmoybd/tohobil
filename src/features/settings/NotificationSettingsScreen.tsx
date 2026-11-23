import { useState, useEffect } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  checkNotificationPermission,
  requestNotificationPermission,
  sendTestNotification,
  NOTIFICATION_CHANNELS,
  type NotificationPreferences,
  type ChannelKey,
} from '../../lib/notifications';
import { refreshPushRegistration, updateMarketingOptIn } from '../../lib/push';
import { useFeatureFlag } from '../../lib/featureFlags';
import { api } from '../../app/identity';

export function NotificationSettingsScreen({
  onToast,
  onBack,
}: {
  onToast: (msg: string) => void;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => getNotificationPreferences());
  const [permissionGranted, setPermissionGranted] = useState(true);
  const [testBusy, setTestBusy] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [showBatteryGuide, setShowBatteryGuide] = useState(false);
  const pushAvailable = useFeatureFlag('push');

  async function handleMarketingToggle() {
    const nextVal = !marketingOptIn;
    setMarketingOptIn(nextVal);
    if (!(await updateMarketingOptIn(nextVal))) {
      setMarketingOptIn(!nextVal);
      onToast(t('notifications.pushUnavailable'));
    }
  }

  useEffect(() => {
    void checkNotificationPermission().then((status) => {
      setPermissionGranted(status.display === 'granted');
    });
    void api<{ user: { marketing_push_opt_in?: number | boolean } }>('me')
      .then(({ user }) => setMarketingOptIn(user.marketing_push_opt_in === 1 || user.marketing_push_opt_in === true))
      .catch(() => {});
  }, []);

  async function handleRequestPermission() {
    const granted = await requestNotificationPermission();
    setPermissionGranted(granted);
    if (granted) {
      onToast(t('notifications.permissionGranted'));
    } else {
      onToast(t('notifications.permissionDenied'));
    }
  }

  function handleMasterToggle() {
    const next = !prefs.masterEnabled;
    const updated = saveNotificationPreferences({ masterEnabled: next });
    setPrefs(updated);
  }

  function handleChannelToggle(channelId: ChannelKey) {
    const nextVal = !prefs.channels[channelId];
    const updated = saveNotificationPreferences({
      channels: { ...prefs.channels, [channelId]: nextVal },
    });
    setPrefs(updated);
  }

  function handleTimeChange(timeStr: string) {
    const updated = saveNotificationPreferences({ dailyReminderTime: timeStr });
    setPrefs(updated);
  }

  async function handleTestNotification() {
    setTestBusy(true);
    try {
      const ok = await sendTestNotification(
        t('notifications.testTitle'),
        t('notifications.testBody'),
        'daily_reminder',
      );
      if (ok) {
        onToast(t('notifications.testSentSuccess'));
      } else {
        onToast(t('notifications.testFailed'));
      }
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <IonPage>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 12 }}>
        {onBack && (
          <button type="button" onClick={onBack} className="btn-icon" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <span className="material-symbols-rounded">arrow_back</span>
          </button>
        )}
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('notifications.title')}</h1>
      </div>

      <IonContent className="shell-content">
        <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {pushAvailable && <div className="surface-card" style={{padding:20,borderRadius:16}}><h3>{t('notifications.enablePush')}</h3><p>{t('notifications.enablePushExplanation')}</p><button className="btn-accent" type="button" onClick={() => void refreshPushRegistration(true).then(ok => onToast(t(ok ? 'notifications.pushReady' : 'notifications.pushUnavailable'))).catch(() => onToast(t('notifications.pushUnavailable')))}>{t('notifications.enablePushAction')}</button></div>}
          {!permissionGranted && (
            <div className="surface-card" style={{ padding: 16, borderRadius: 16, background: '#fffbeb', border: '1px solid #fef3c7' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span className="material-symbols-rounded" style={{ color: '#d97706', fontSize: 28 }}>
                  notifications_paused
                </span>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: '#92400e' }}>
                    {t('notifications.permissionRequired')}
                  </h4>
                  <p style={{ margin: '0 0 12px', fontSize: 13, color: '#b45309', lineHeight: 1.4 }}>
                    {t('notifications.permissionExplanation')}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleRequestPermission()}
                    className="btn-accent"
                    style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}
                  >
                    {t('notifications.grantPermission')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Master Toggle */}
          <div className="surface-card" style={{ padding: 20, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#10b98120', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-rounded">notifications</span>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{t('notifications.enableAll')}</h3>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--app-muted)' }}>{t('notifications.enableAllSubtitle')}</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.masterEnabled}
                onChange={handleMasterToggle}
                style={{ width: 22, height: 22 }}
              />
            </div>
          </div>

          {/* Account & Security and Marketing Opt-In (SPEC 19.4) */}
          <div className="surface-card" style={{ padding: 20, borderRadius: 16 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 600 }}>{t('notifications.channelsTitle')}</h3>

            {/* Account & Security - Always ON */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid var(--app-border)' }}>
              <div style={{ flex: 1, paddingRight: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t('notifications.accountSecurity')}</div>
                <div style={{ fontSize: 12, color: 'var(--app-muted)', marginTop: 2 }}>
                  {t('notifications.accountSecurityDesc')}
                </div>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 8,
                  background: 'var(--app-accent-soft, rgba(20, 184, 166, 0.1))',
                  color: 'var(--app-accent, #14b8a6)',
                }}
              >
                {t('notifications.alwaysActive')}
              </span>
            </div>

            {/* Announcements & Offers - Marketing Push Opt-in */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14 }}>
              <div style={{ flex: 1, paddingRight: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t('notifications.announcementsOffers')}</div>
                <div style={{ fontSize: 12, color: 'var(--app-muted)', marginTop: 2 }}>
                  {t('notifications.announcementsOffersDesc')}
                </div>
              </div>
              <input
                type="checkbox"
                checked={marketingOptIn}
                onChange={() => void handleMarketingToggle()}
                style={{ width: 20, height: 20 }}
              />
            </div>
          </div>

          {/* Granular Channels */}
          <div className="surface-card" style={{ padding: 20, borderRadius: 16, opacity: prefs.masterEnabled ? 1 : 0.6 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>{t('notifications.channelsTitle')}</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--app-muted)' }}>{t('notifications.channelsSubtitle')}</p>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {NOTIFICATION_CHANNELS.map((ch, idx) => {
                const isDaily = ch.id === 'daily_reminder';
                const isEnabled = prefs.channels[ch.id];
                return (
                  <div
                    key={ch.id}
                    style={{
                      padding: '14px 0',
                      borderBottom: idx < NOTIFICATION_CHANNELS.length - 1 ? '1px solid var(--app-border)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, paddingRight: 12 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{t(ch.i18nKey)}</div>
                        <div style={{ fontSize: 12, color: 'var(--app-muted)', marginTop: 2 }}>
                          {t(`${ch.i18nKey}Desc`)}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        disabled={!prefs.masterEnabled}
                        checked={isEnabled}
                        onChange={() => handleChannelToggle(ch.id)}
                        style={{ width: 20, height: 20 }}
                      />
                    </div>

                    {isDaily && isEnabled && prefs.masterEnabled && (
                      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--app-bg)', borderRadius: 10 }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--app-accent)' }}>
                          schedule
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{t('notifications.reminderTime')}</span>
                        <input
                          type="time"
                          value={prefs.dailyReminderTime}
                          onChange={(e) => handleTimeChange(e.target.value)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 8,
                            border: '1px solid var(--app-border)',
                            background: 'var(--app-card)',
                            color: 'var(--app-text)',
                            fontSize: 13,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Test Notification Button */}
          <div className="surface-card" style={{ padding: 20, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t('notifications.testNotification')}</h4>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--app-muted)' }}>
                  {t('notifications.testNotificationHelp')}
                </p>
              </div>
              <button
                type="button"
                disabled={testBusy || !prefs.masterEnabled}
                onClick={() => void handleTestNotification()}
                className="btn-accent"
                style={{ padding: '8px 16px', borderRadius: 12, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {testBusy ? t('common.sending') : t('notifications.sendTest')}
              </button>
            </div>
          </div>

          {/* Battery Saver Troubleshooting Guide (SPEC 19.4) */}
          <div className="surface-card" style={{ padding: 20, borderRadius: 16 }}>
            <div
              onClick={() => setShowBatteryGuide(!showBatteryGuide)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--app-accent, #14b8a6)', fontSize: 22 }}>
                  battery_charging_full
                </span>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t('notifications.batteryGuideTitle')}</h4>
              </div>
              <span className="material-symbols-rounded" style={{ color: 'var(--app-muted)' }}>
                {showBatteryGuide ? 'expand_less' : 'expand_more'}
              </span>
            </div>

            {showBatteryGuide && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--app-border)' }}>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--app-muted)', lineHeight: 1.5 }}>
                  {t('notifications.batteryGuideDesc')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--app-text)' }}>
                  <div>{t('notifications.batteryStep1')}</div>
                  <div>{t('notifications.batteryStep2')}</div>
                  <div>{t('notifications.batteryStep3')}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
