import React, { useState, useEffect } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import {
  getSecuritySettings,
  saveSecuritySettings,
  setAppPin,
  removeAppPin,
  checkBiometrics,
  type SecuritySettings,
} from '../../lib/security';
import { api, ApiError, type User } from '../../app/identity';

interface SessionItem {
  id: number;
  device_name: string | null;
  platform: string | null;
  last_used_at: string;
  is_current: boolean;
}

export function SecuritySettingsScreen({
  onLogout,
  onToast,
  onBack,
}: {
  user: User;
  onLogout: () => void;
  onToast: (msg: string) => void;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SecuritySettings>(() => getSecuritySettings());
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState<string>('');

  // PIN Setup Modal
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create');
  const [enteredPin, setEnteredPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Password Change
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changePassBusy, setChangePassBusy] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Account Deletion
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePass, setDeletePass] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    void checkBiometrics().then((res) => {
      setBiometricsAvailable(res.available);
      if (res.biometryType) setBiometryType(res.biometryType);
    });

    api<SessionItem[]>('me/sessions')
      .then((data) => setSessions(data))
      .catch(() => {})
      .finally(() => setLoadingSessions(false));
  }, []);

  function handleToggleAppLock() {
    if (settings.appLockEnabled) {
      if (window.confirm(t('security.removePinConfirm'))) {
        removeAppPin();
        setSettings(getSecuritySettings());
        onToast(t('security.pinRemoved'));
      }
    } else {
      setEnteredPin('');
      setConfirmPin('');
      setPinStep('create');
      setPinError('');
      setPinModalOpen(true);
    }
  }

  async function handlePinSubmit(digit: string) {
    if (pinStep === 'create') {
      const next = enteredPin + digit;
      if (next.length <= 4) {
        setEnteredPin(next);
        if (next.length === 4) {
          setTimeout(() => setPinStep('confirm'), 200);
        }
      }
    } else {
      const next = confirmPin + digit;
      if (next.length <= 4) {
        setConfirmPin(next);
        if (next.length === 4) {
          if (next === enteredPin) {
            await setAppPin(next);
            setSettings(getSecuritySettings());
            setPinModalOpen(false);
            onToast(t('security.pinSetSuccess'));
          } else {
            setPinError(t('security.pinMismatch'));
            setTimeout(() => {
              setConfirmPin('');
              setPinError('');
            }, 800);
          }
        }
      }
    }
  }

  function handleToggleBiometrics() {
    const next = !settings.biometricsEnabled;
    saveSecuritySettings({ biometricsEnabled: next });
    setSettings(getSecuritySettings());
  }

  function handleAutoLockChange(seconds: number) {
    saveSecuritySettings({ autoLockSeconds: seconds });
    setSettings(getSecuritySettings());
  }

  function handleTogglePrivacyScreen() {
    const next = !settings.privacyScreenEnabled;
    saveSecuritySettings({ privacyScreenEnabled: next });
    setSettings(getSecuritySettings());
    onToast(next ? t('security.privacyScreenEnabled') : t('security.privacyScreenDisabled'));
  }

  function handleToggleHideBalances() {
    const next = !settings.hideBalances;
    saveSecuritySettings({ hideBalances: next });
    setSettings(getSecuritySettings());
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      onToast(t('security.passwordMinLength'));
      return;
    }
    setChangePassBusy(true);
    try {
      await api('auth/password/change', {
        method: 'POST',
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      });
      setOldPassword('');
      setNewPassword('');
      onToast(t('identity.passwordChanged'));
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : t('identity.genericError'));
    } finally {
      setChangePassBusy(false);
    }
  }

  async function handleRevokeSession(id: number) {
    try {
      await api(`me/sessions/${id}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      onToast(t('security.sessionRevoked'));
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : t('identity.genericError'));
    }
  }

  async function handleRevokeAllOthers() {
    try {
      await api('me/sessions/all', { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.is_current));
      onToast(t('identity.logoutOtherSessions'));
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : t('identity.genericError'));
    }
  }

  async function handleConfirmDelete() {
    setDeleteBusy(true);
    setDeleteError('');
    try {
      const payload = { password: deletePass };
      await api('me', {
        method: 'DELETE',
        body: JSON.stringify(payload),
      });
      setDeleteModalOpen(false);
      onToast(t('security.accountDeletedSuccess'));
      onLogout();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : t('identity.genericError'));
    } finally {
      setDeleteBusy(false);
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
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('security.title')}</h1>
      </div>

      <IonContent className="shell-content">
        <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* App Lock & Biometrics */}
          <div className="surface-card" style={{ padding: 20, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#6366f120', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-rounded">lock</span>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{t('security.appLock')}</h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--app-muted)' }}>{t('security.appLockSubtitle')}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--app-border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t('security.enablePin')}</div>
                <div style={{ fontSize: 12, color: 'var(--app-muted)' }}>{settings.appLockEnabled ? t('security.pinConfigured') : t('security.noPinSet')}</div>
              </div>
              <button
                type="button"
                className={`choice ${settings.appLockEnabled ? 'selected' : ''}`}
                onClick={handleToggleAppLock}
                style={{ padding: '6px 14px', borderRadius: 20 }}
              >
                {settings.appLockEnabled ? t('common.enabled') : t('common.enable')}
              </button>
            </div>

            {settings.appLockEnabled && (
              <>
                {biometricsAvailable && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--app-border)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {biometryType ? `${t('security.biometrics')} (${biometryType})` : t('security.biometrics')}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--app-muted)' }}>{t('security.biometricsSubtitle')}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.biometricsEnabled}
                      onChange={handleToggleBiometrics}
                      style={{ width: 20, height: 20 }}
                    />
                  </div>
                )}

                <div style={{ padding: '12px 0' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{t('security.autoLockTimeout')}</div>
                  <div className="choice-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { s: 0, label: t('security.lockImmediately') },
                      { s: 30, label: '30s' },
                      { s: 60, label: '1m' },
                      { s: 300, label: '5m' },
                      { s: 900, label: '15m' },
                    ].map(({ s, label }) => (
                      <button
                        key={s}
                        type="button"
                        className={`choice ${settings.autoLockSeconds === s ? 'selected' : ''}`}
                        onClick={() => handleAutoLockChange(s)}
                        style={{ padding: '6px 12px', fontSize: 12 }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Privacy Screen & Balances */}
          <div className="surface-card" style={{ padding: 20, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#0d948820', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-rounded">visibility_off</span>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{t('security.privacyScreenTitle')}</h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--app-muted)' }}>{t('security.privacyScreenSubtitle')}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--app-border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t('security.blockScreenshots')}</div>
                <div style={{ fontSize: 12, color: 'var(--app-muted)' }}>{t('security.blockScreenshotsHelp')}</div>
              </div>
              <input
                type="checkbox"
                checked={settings.privacyScreenEnabled}
                onChange={handleTogglePrivacyScreen}
                style={{ width: 20, height: 20 }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t('security.hideBalancesByDefault')}</div>
                <div style={{ fontSize: 12, color: 'var(--app-muted)' }}>{t('security.hideBalancesHelp')}</div>
              </div>
              <input
                type="checkbox"
                checked={settings.hideBalances}
                onChange={handleToggleHideBalances}
                style={{ width: 20, height: 20 }}
              />
            </div>
          </div>

          {/* Active Sessions */}
          <div className="surface-card" style={{ padding: 20, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{t('security.sessions')}</h3>
              {sessions.length > 1 && (
                <button
                  type="button"
                  onClick={() => void handleRevokeAllOthers()}
                  style={{ background: 'none', border: 'none', color: 'var(--app-danger)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  {t('identity.logoutOtherSessions')}
                </button>
              )}
            </div>

            {loadingSessions ? (
              <p style={{ fontSize: 13, color: 'var(--app-muted)' }}>{t('common.loading')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--app-bg)',
                      borderRadius: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {sess.device_name || 'Device'} {sess.is_current && <span style={{ color: 'var(--app-accent)', fontSize: 12 }}>(Current)</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--app-muted)' }}>
                        {sess.platform || 'Mobile'} · {new Date(sess.last_used_at).toLocaleDateString()}
                      </div>
                    </div>
                    {!sess.is_current && (
                      <button
                        type="button"
                        onClick={() => void handleRevokeSession(sess.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--app-danger)', cursor: 'pointer', fontSize: 13 }}
                      >
                        {t('security.revoke')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Change Password */}
          <div className="surface-card" style={{ padding: 20, borderRadius: 16 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 600 }}>{t('security.changePassword')}</h3>
            <form onSubmit={(e) => void handleChangePassword(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="password"
                placeholder={t('identity.currentPassword')}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--app-border)', background: 'var(--app-bg)', color: 'var(--app-text)' }}
                required
              />
              <input
                type="password"
                placeholder={t('identity.newPassword')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--app-border)', background: 'var(--app-bg)', color: 'var(--app-text)' }}
                required
              />
              <button
                type="submit"
                disabled={changePassBusy}
                className="btn-accent"
                style={{ padding: '10px', borderRadius: 10, border: 'none', fontWeight: 600, cursor: 'pointer', marginTop: 4 }}
              >
                {changePassBusy ? t('common.saving') : t('security.updatePassword')}
              </button>
            </form>
          </div>

          {/* Danger Zone: Delete Account */}
          <div className="surface-card" style={{ padding: 20, borderRadius: 16, border: '1px solid #fecaca', background: '#fef2f215' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span className="material-symbols-rounded" style={{ color: 'var(--app-danger)' }}>delete_forever</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--app-danger)' }}>{t('security.dangerZone')}</h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--app-muted)' }}>{t('security.deleteAccountWarning')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setDeleteError('');
                setDeletePass('');
                setDeleteModalOpen(true);
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                border: '1px solid var(--app-danger)',
                background: 'transparent',
                color: 'var(--app-danger)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('identity.deleteAccount')}
            </button>
          </div>
        </div>
      </IonContent>

      {/* PIN Setup Modal */}
      {pinModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="surface-card" style={{ width: '100%', maxWidth: 320, padding: 24, borderRadius: 20, textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>
              {pinStep === 'create' ? t('security.enterNewPin') : t('security.confirmNewPin')}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--app-muted)' }}>
              {pinStep === 'create' ? t('security.chooseFourDigits') : t('security.reenterPin')}
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
              {[0, 1, 2, 3].map((idx) => {
                const cur = pinStep === 'create' ? enteredPin : confirmPin;
                const filled = cur.length > idx;
                return (
                  <div
                    key={idx}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: filled ? 'var(--app-accent)' : 'var(--app-border)',
                    }}
                  />
                );
              })}
            </div>

            {pinError && <p style={{ color: 'var(--app-danger)', fontSize: 13, margin: '0 0 16px' }}>{pinError}</p>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, maxWidth: 220, margin: '0 auto 16px' }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={!k}
                  onClick={() => {
                    if (k === '⌫') {
                      if (pinStep === 'create') setEnteredPin((p) => p.slice(0, -1));
                      else setConfirmPin((p) => p.slice(0, -1));
                    } else if (k) {
                      void handlePinSubmit(k);
                    }
                  }}
                  style={{
                    height: 52,
                    borderRadius: 26,
                    border: '1px solid var(--app-border)',
                    background: 'var(--app-card)',
                    fontSize: 20,
                    fontWeight: 600,
                    color: 'var(--app-text)',
                    cursor: k ? 'pointer' : 'default',
                    visibility: k ? 'visible' : 'hidden',
                  }}
                >
                  {k}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPinModalOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--app-muted)', fontSize: 14, cursor: 'pointer' }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {deleteModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="surface-card" style={{ width: '100%', maxWidth: 400, padding: 24, borderRadius: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--app-danger)' }}>{t('identity.deleteAccount')}</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--app-muted)', lineHeight: 1.45 }}>
              {t('identity.deleteAccountConfirm')}
            </p>

            <p className="section-note" style={{ marginTop: 0 }}>{t('identity.smsOff')}</p>
            <input
              type="password"
              placeholder={t('identity.enterPasswordToDelete')}
              value={deletePass}
              onChange={(e) => setDeletePass(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--app-border)', marginBottom: 16 }}
            />

            {deleteError && <p style={{ color: 'var(--app-danger)', fontSize: 13, margin: '0 0 16px' }}>{deleteError}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid var(--app-border)', background: 'transparent', cursor: 'pointer' }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={deleteBusy || !deletePass}
                onClick={() => void handleConfirmDelete()}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--app-danger)',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: !deletePass ? 0.6 : 1,
                }}
              >
                {deleteBusy ? t('common.deleting') : t('common.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </IonPage>
  );
}
