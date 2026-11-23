import { useState } from 'react';
import { IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { User } from '../../app/identity';

export type Theme = 'system' | 'light' | 'dark';
export type Accent = 'teal' | 'ocean' | 'violet' | 'sunset' | 'forest';

export function SettingsScreen({
  theme,
  setTheme,
  accent,
  setAccent,
  user,
  onToast,
}: {
  theme: Theme;
  setTheme: (v: Theme) => void;
  accent: Accent;
  setAccent: (v: Accent) => void;
  user: User;
  onToast: (msg: string) => void;
  onLogout: () => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [bengaliDigits, setBengaliDigits] = useState<boolean>(() => {
    return localStorage.getItem('tohobil.bengali_digits') === 'true';
  });

  const [monthStartDay, setMonthStartDay] = useState<number>(() => {
    return parseInt(localStorage.getItem('tohobil.month_start_day') ?? '1', 10);
  });

  const [aboutOpen, setAboutOpen] = useState(false);

  function handleToggleBengaliDigits() {
    const next = !bengaliDigits;
    setBengaliDigits(next);
    localStorage.setItem('tohobil.bengali_digits', String(next));
    onToast(next ? t('settings.bengaliDigitsEnabled') : t('settings.bengaliDigitsDisabled'));
  }

  function handleMonthStartChange(day: number) {
    setMonthStartDay(day);
    localStorage.setItem('tohobil.month_start_day', String(day));
    onToast(t('settings.monthStartDayUpdated', { day }));
  }

  function handleLanguageChange(lang: 'en' | 'bn') {
    void i18n.changeLanguage(lang);
    localStorage.setItem('tohobil.lang', lang);
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButton slot="start" fill="clear" aria-label={t('a11y.back')} onClick={() => navigate(-1)}>
            <span className="material-symbols-rounded">arrow_back</span>
          </IonButton>
          <IonTitle>{t('more.settings')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="shell-content">
        <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* User Profile Card */}
          <div
            className="surface-card"
            onClick={() => navigate('/tabs/more/profile')}
            style={{
              padding: 16,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0d9488, #4f46e5)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                {user.name ? user.name.charAt(0).toUpperCase() : 'T'}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{user.name || 'User'}</h3>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--app-muted)' }}>{user.phone}</p>
              </div>
            </div>
            <span className="material-symbols-rounded" style={{ color: 'var(--app-muted)' }}>
              chevron_right
            </span>
          </div>

          {/* Core Settings Menu */}
          <div className="surface-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
            {/* Security */}
            <div
              onClick={() => navigate('/tabs/more/security')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--app-border)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="material-symbols-rounded" style={{ color: '#6366f1', fontSize: 24 }}>
                  security
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{t('security.title')}</div>
                  <div style={{ fontSize: 12, color: 'var(--app-muted)' }}>{t('security.settingsSubtitle')}</div>
                </div>
              </div>
              <span className="material-symbols-rounded" style={{ color: 'var(--app-muted)' }}>
                chevron_right
              </span>
            </div>

            {/* Notifications */}
            <div
              onClick={() => navigate('/tabs/more/notifications')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--app-border)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="material-symbols-rounded" style={{ color: '#10b981', fontSize: 24 }}>
                  notifications
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{t('notifications.title')}</div>
                  <div style={{ fontSize: 12, color: 'var(--app-muted)' }}>{t('notifications.settingsSubtitle')}</div>
                </div>
              </div>
              <span className="material-symbols-rounded" style={{ color: 'var(--app-muted)' }}>
                chevron_right
              </span>
            </div>

            {/* Backup & Sync */}
            <div
              onClick={() => navigate('/tabs/more/backup')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--app-border)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="material-symbols-rounded" style={{ color: '#14b8a6', fontSize: 24 }}>
                  cloud_sync
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{t('backup.title')}</div>
                  <div style={{ fontSize: 12, color: 'var(--app-muted)' }}>{t('backup.settingsSubtitle')}</div>
                </div>
              </div>
              <span className="material-symbols-rounded" style={{ color: 'var(--app-muted)' }}>
                chevron_right
              </span>
            </div>

            {/* Storage & Vault */}
            <div
              onClick={() => navigate('/tabs/more/storage')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="material-symbols-rounded" style={{ color: '#f59e0b', fontSize: 24 }}>
                  folder
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{t('storage.title')}</div>
                  <div style={{ fontSize: 12, color: 'var(--app-muted)' }}>{t('storage.subtitle')}</div>
                </div>
              </div>
              <span className="material-symbols-rounded" style={{ color: 'var(--app-muted)' }}>
                chevron_right
              </span>
            </div>
          </div>

          {/* Appearance & Preferences */}
          <div className="surface-card" style={{ padding: 20, borderRadius: 16 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>{t('settings.appearance')}</h3>

            {/* Language */}
            <div style={{ marginBottom: 18 }}>
              <p className="settings-label" style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>
                {t('settings.language')}
              </p>
              <div className="choice-row" style={{ display: 'flex', gap: 8 }}>
                {(['en', 'bn'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`choice ${i18n.language === v ? 'selected' : ''}`}
                    onClick={() => handleLanguageChange(v)}
                    style={{ flex: 1, padding: 8, fontSize: 13 }}
                  >
                    {t(v === 'en' ? 'settings.english' : 'settings.bengali')}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div style={{ marginBottom: 18 }}>
              <p className="settings-label" style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>
                {t('settings.theme')}
              </p>
              <div className="choice-row" style={{ display: 'flex', gap: 8 }}>
                {(['system', 'light', 'dark'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`choice ${theme === v ? 'selected' : ''}`}
                    onClick={() => setTheme(v)}
                    style={{ flex: 1, padding: 8, fontSize: 13 }}
                  >
                    {t(`settings.${v}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent */}
            <div style={{ marginBottom: 18 }}>
              <p className="settings-label" style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>
                {t('settings.accent')}
              </p>
              <div className="choice-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['teal', 'ocean', 'violet', 'sunset', 'forest'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`choice ${accent === v ? 'selected' : ''}`}
                    onClick={() => setAccent(v)}
                    style={{ flex: 1, padding: '6px 10px', fontSize: 12, minWidth: 60 }}
                  >
                    {t(`settings.${v}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Bengali Digits */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--app-border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t('settings.bengaliDigits')}</div>
                <div style={{ fontSize: 12, color: 'var(--app-muted)' }}>১২৩৪৫৬৭৮৯০</div>
              </div>
              <input
                type="checkbox"
                checked={bengaliDigits}
                onChange={handleToggleBengaliDigits}
                style={{ width: 20, height: 20 }}
              />
            </div>

            {/* Month Start Day */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--app-border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t('settings.monthStartDay')}</div>
                <div style={{ fontSize: 12, color: 'var(--app-muted)' }}>{t('settings.monthStartDayDesc')}</div>
              </div>
              <select
                value={monthStartDay}
                onChange={(e) => handleMonthStartChange(parseInt(e.target.value, 10))}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--app-border)', background: 'var(--app-card)', color: 'var(--app-text)', fontSize: 13 }}
              >
                {[1, 5, 10, 15, 20, 25].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* About, Help & Info */}
          <div className="surface-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
            <div
              onClick={() => setAboutOpen(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--app-border)', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--app-muted)' }}>info</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{t('settings.aboutApp')}</span>
              </div>
              <span className="material-symbols-rounded" style={{ color: 'var(--app-muted)' }}>chevron_right</span>
            </div>

            <a
              href="/docs/privacy-policy.html"
              target="_blank"
              rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--app-border)', textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--app-muted)' }}>policy</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{t('settings.privacyPolicy')}</span>
              </div>
              <span className="material-symbols-rounded" style={{ color: 'var(--app-muted)' }}>open_in_new</span>
            </a>

            <a
              href="/delete-account"
              target="_blank"
              rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--app-muted)' }}>public</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{t('settings.webAccountDeletion')}</span>
              </div>
              <span className="material-symbols-rounded" style={{ color: 'var(--app-muted)' }}>open_in_new</span>
            </a>
          </div>
        </div>
      </IonContent>

      {/* About Modal */}
      {aboutOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="surface-card" style={{ width: '100%', maxWidth: 360, padding: 24, borderRadius: 20, textAlign: 'center' }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #0d9488, #4f46e5)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              ৳
            </div>
            <h3 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Tohobil · তহবিল</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--app-muted)' }}>Version 1.0.0 (Milestone 10)</p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--app-text)', lineHeight: 1.5 }}>
              A privacy-first, offline-first personal financial manager tailored for Bangladesh. Built with encrypted local storage, bank-grade AES encryption, and seamless backup.
            </p>
            <button
              type="button"
              onClick={() => setAboutOpen(false)}
              className="btn-accent"
              style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', fontWeight: 600, cursor: 'pointer' }}
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </IonPage>
  );
}
