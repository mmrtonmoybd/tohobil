import { useState, useEffect } from 'react';
import { IonButton, IonContent, IonModal, IonPage, IonSpinner } from '@ionic/react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { useTranslation } from 'react-i18next';
import { api, ApiError, getApiBaseUrl, type AccessCode, type User } from './identity';
import { setLanguage } from '../i18n';
import { toAsciiDigits } from '../lib/digits';
import { ALL_COUNTRIES, countryFromLocale, currencyForCountry, normalizePhone, type Country } from '../lib/phone';

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  helperText?: string;
}) {
  return (
    <label className="identity-field">
      <span className="identity-field-label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="identity-input"
      />
      {helperText && <span className="identity-helper">{helperText}</span>}
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helperText?: string;
}) {
  const [show, setShow] = useState(false);
  const { t } = useTranslation();
  return (
    <label className="identity-field">
      <span className="identity-field-label">{label}</span>
      <div className="identity-password-wrap">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="identity-input"
        />
        <button
          type="button"
          className="identity-eye-btn"
          onClick={() => setShow(!show)}
          aria-label={t(show ? 'identity.hidePassword' : 'identity.showPassword')}
        >
          <span className="material-symbols-rounded">
            {show ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      </div>
      {helperText && <span className="identity-helper">{helperText}</span>}
    </label>
  );
}

function PhoneField({
  label,
  phone,
  onChangePhone,
  selectedCountry,
  onChangeCountry,
}: {
  label: string;
  phone: string;
  onChangePhone: (v: string) => void;
  selectedCountry: Country;
  onChangeCountry: (c: Country) => void;
}) {
  const { t, i18n } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const names = new Intl.DisplayNames([i18n.language], { type: 'region' });
  const countries = ALL_COUNTRIES.filter((country) => `${names.of(country.code)} ${country.name} ${country.dialCode} ${country.code}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return (
    <div className="identity-field">
      <span className="identity-field-label">{label}</span>
      <div className="identity-phone-row">
        <button type="button" className="identity-country-button" onClick={() => setPickerOpen(true)} aria-label={t('identity.changeCountry', { country: names.of(selectedCountry.code), code: selectedCountry.dialCode })}>
          <span aria-hidden="true" className="identity-country-flag">{selectedCountry.flag}</span>
          <span>{selectedCountry.dialCode}</span>
          <span className="identity-country-chevron" aria-hidden="true">⌄</span>
        </button>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-label={label}
          value={phone}
          onChange={(e) => onChangePhone(toAsciiDigits(e.target.value))}
          placeholder={t('identity.phonePlaceholder')}
          className="identity-input identity-phone-input"
        />
      </div>
      <span className="identity-helper">{t('identity.selectedCountry', { country: names.of(selectedCountry.code) })}</span>
      <IonModal isOpen={pickerOpen} onDidDismiss={() => { setPickerOpen(false); setSearch(''); }} initialBreakpoint={0.85} breakpoints={[0,0.85,1]}>
        <IonContent className="identity-country-sheet"><div className="identity-country-sheet-inner"><h2>{t('identity.countryPickerTitle')}</h2><input className="identity-input" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('identity.searchCountry')} aria-label={t('identity.searchCountry')} autoFocus />
          <div className="identity-country-list">{countries.length ? countries.map(country => <button type="button" key={country.code} className="identity-country-option" onClick={() => { onChangeCountry(country); setPickerOpen(false); }}><span className="identity-country-flag" aria-hidden="true">{country.flag}</span><span className="identity-country-name">{names.of(country.code)}</span><span className="identity-country-code">{country.dialCode}</span></button>) : <p>{t('identity.noCountries')}</p>}</div>
        </div></IonContent>
      </IonModal>
    </div>
  );
}

export function IdentityScreens({
  onReady,
}: {
  onReady: (user: User, token: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<'intro' | 'language' | 'login' | 'register' | 'forgot'>(() =>
    localStorage.getItem('tohobil.onboarded') ? 'login' : 'intro',
  );
  const [slide, setSlide] = useState(0);
  const [country, setCountry] = useState<Country>(() => countryFromLocale(navigator.language));
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const formatFullPhone = (p: string) => {
    const normalized = normalizePhone(p, country.code);
    if (!normalized?.isValid) throw new ApiError('INVALID_PHONE', t('identity.invalidPhone'));
    return normalized.e164;
  };

  async function submitAuth() {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const fullPhone = formatFullPhone(phone);
      if (step === 'register') {
        if (!name.trim()) throw new ApiError('VALIDATION_ERROR', t('identity.name') + ' required');
        if (password.length < 10) throw new ApiError('VALIDATION_ERROR', t('identity.passwordHint'));
        if (password !== confirm) throw new ApiError('PASSWORD_MISMATCH', t('identity.passwordMismatch'));
        if (!terms) throw new ApiError('VALIDATION_ERROR', t('identity.acceptTerms'));
      }

      const endpoint = step === 'register' ? 'auth/register' : 'auth/login';
      const body = {
        name: name.trim(),
        phone: fullPhone,
        password,
        accept_terms: terms,
        country: country.code,
        currency: currencyForCountry(country.code),
        language: i18n.language === 'bn' ? 'bn' : 'en',
      };

      const response = await api<{ user: User; token: string }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      localStorage.setItem('tohobil.onboarded', '1');
      onReady(response.user, response.token);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'OFFLINE') {
        setError(t('identity.offlineNotice'));
      } else {
        setError(e instanceof ApiError ? e.message : t('identity.genericError'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <IonPage>
      <IonContent className="identity-content" fullscreen>
        <div className="identity-container">
          {step === 'intro' ? (
            <div className="identity-card onboarding-card">
              <div className="onboarding-slide-art">
                <div className={`onboarding-illustration slide-${slide}`}>
                  <span className="material-symbols-rounded">
                    {slide === 0
                      ? 'account_balance_wallet'
                      : slide === 1
                        ? 'trending_up'
                        : 'handshake'}
                  </span>
                </div>
              </div>
              <div className="onboarding-indicators">
                {[0, 1, 2].map((idx) => (
                  <span
                    key={idx}
                    className={`indicator-dot ${idx === slide ? 'active' : ''}`}
                    onClick={() => setSlide(idx)}
                  />
                ))}
              </div>
              <h2>{t(`identity.slide${slide + 1}Title`)}</h2>
              <p className="onboarding-text">{t(`identity.slide${slide + 1}Body`)}</p>
              <div className="identity-btn-col">
                <IonButton
                  expand="block"
                  className="brand-btn"
                  onClick={() => {
                    if (slide < 2) setSlide(slide + 1);
                    else setStep('language');
                  }}
                >
                  {t(slide < 2 ? 'identity.next' : 'identity.getStarted')}
                </IonButton>
                {slide < 2 && (
                  <IonButton
                    fill="clear"
                    expand="block"
                    onClick={() => setStep('language')}
                  >
                    {t('identity.skip')}
                  </IonButton>
                )}
              </div>
            </div>
          ) : step === 'language' ? (
            <div className="identity-card">
              <div className="identity-header-icon">
                <span className="material-symbols-rounded">public</span>
              </div>
              <h2>{t('identity.chooseLanguage')}</h2>
              <div className="language-choice-grid">
                <button
                  type="button"
                  className={`lang-card ${i18n.language === 'en' ? 'selected' : ''}`}
                  onClick={() => void setLanguage('en')}
                >
                  <span className="lang-title">{t('settings.english')}</span>
                  <span className="lang-sub">{t('identity.englishDescription')}</span>
                </button>
                <button
                  type="button"
                  className={`lang-card ${i18n.language === 'bn' ? 'selected' : ''}`}
                  onClick={() => void setLanguage('bn')}
                >
                  <span className="lang-title">{t('settings.bengali')}</span>
                  <span className="lang-sub">{t('identity.bengaliDescription')}</span>
                </button>
              </div>
              <IonButton
                expand="block"
                className="brand-btn"
                onClick={() => setStep('login')}
              >
                {t('identity.continue')}
              </IonButton>
            </div>
          ) : (
            <div className="identity-card">
              <div className="identity-brand-header">
                <div className="brand-logo-icon">
                  <span className="material-symbols-rounded">account_balance_wallet</span>
                </div>
                <h1>{t('appName')}</h1>
              </div>

              <h2>{t(`identity.${step}Title`)}</h2>

              {info && <p className="identity-info-banner">{info}</p>}
              {error && <p role="alert" className="identity-error-banner">{error}</p>}

              {step === 'register' && (
                <Field
                  label={t('identity.name')}
                  value={name}
                  onChange={setName}
                  placeholder={t('identity.namePlaceholder')}
                />
              )}

              {step === 'forgot' ? (
                <p className="section-note">{t('identity.resetUnavailable')}</p>
              ) : (
                <PhoneField
                  label={t('identity.phone')}
                  phone={phone}
                  onChangePhone={setPhone}
                  selectedCountry={country}
                  onChangeCountry={setCountry}
                />
              )}

              {(step === 'login' || step === 'register') && (
                <PasswordField
                  label={t('identity.password')}
                  value={password}
                  onChange={setPassword}
                  helperText={step !== 'login' ? t('identity.passwordHint') : undefined}
                />
              )}

              {step === 'register' && (
                <>
                  <PasswordField
                    label={t('identity.confirmPassword')}
                    value={confirm}
                    onChange={setConfirm}
                  />
                  <label className="identity-check">
                    <input
                      type="checkbox"
                      checked={terms}
                      onChange={(e) => setTerms(e.target.checked)}
                    />
                    <span>{t('identity.acceptTerms')}</span>
                  </label>
                </>
              )}

              {step !== 'forgot' && (
                <IonButton
                  expand="block"
                  disabled={busy}
                  className="brand-btn"
                  onClick={() => void submitAuth()}
                >
                  {busy ? <IonSpinner name="dots" /> : t(`identity.${step}Action`)}
                </IonButton>
              )}

              {step === 'login' && (
                <IonButton
                  fill="clear"
                  expand="block"
                  onClick={() => {
                    setError('');
                    setInfo('');
                    setStep('forgot');
                  }}
                >
                  {t('identity.forgotPassword')}
                </IonButton>
              )}

              <IonButton
                fill="clear"
                expand="block"
                onClick={() => {
                  setError('');
                  setInfo('');
                  setStep(step === 'login' ? 'register' : 'login');
                }}
              >
                {t(step === 'login' ? 'identity.createAccount' : 'identity.backToLogin')}
              </IonButton>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

export function AccessScreen({
  code,
  reason,
  onRetry,
}: {
  code: AccessCode;
  reason: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const iconName =
    code === 'UPDATE_REQUIRED'
      ? 'sync_alt'
      : code === 'MAINTENANCE'
        ? 'build'
        : 'cancel';

  return (
    <IonPage>
      <IonContent className="identity-content" fullscreen>
        <div className="identity-container">
          <div className="identity-card access-card">
            <div className={`access-icon-wrap access-${code.toLowerCase()}`}>
              <span className="material-symbols-rounded">{iconName}</span>
            </div>
            <h1>{t(`identity.access.${code}`)}</h1>
            <p className="access-reason">{reason || t(`identity.accessBody.${code}`)}</p>

            <div className="access-actions">
              {code === 'UPDATE_REQUIRED' ? (
                <IonButton
                  expand="block"
                  className="brand-btn"
                  href="https://play.google.com/store/apps/details?id=com.tohobil.app"
                >
                  {t('identity.update')}
                </IonButton>
              ) : (
                <IonButton
                  expand="block"
                  className="brand-btn"
                  href="mailto:support@tohobil.app?subject=Account%20Support%20Request"
                >
                  {t('identity.contactSupport')}
                </IonButton>
              )}
              <IonButton fill="clear" expand="block" onClick={onRetry}>
                {t('identity.retry')}
              </IonButton>
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}

export function ProfileScreen({
  user,
  onUpdate,
  onLogout,
}: {
  user: User;
  onUpdate: (u: User) => void;
  onLogout: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<User>(user);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<
    Array<{
      id: number;
      model: string | null;
      platform: string | null;
      app_version: string | null;
      last_used_at: string | null;
      is_current?: boolean;
    }>
  >([]);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePass, setDeletePass] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    void api<{ sessions: typeof sessions }>('me/sessions')
      .then((res) => setSessions(res.sessions || []))
      .catch(() => {});
  }, []);

  function edit(key: keyof User, value: string) {
    setDraft({ ...draft, [key]: value });
  }

  async function saveProfile() {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const result = await api<{ user: User }>('me', {
        method: 'PUT',
        body: JSON.stringify(draft),
      });
      onUpdate(result.user);
      await SecureStorage.removeItem('tohobil.profile.pending');
      setInfo(t('identity.profileSaved'));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'OFFLINE') {
        await SecureStorage.setItem('tohobil.profile.pending', JSON.stringify(draft));
        onUpdate(draft);
        setInfo(t('identity.savedOffline'));
      } else {
        setError(e instanceof ApiError ? e.message : t('identity.genericError'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function pickPhoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: true,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        width: 512,
        height: 512,
      });
      if (!image.webPath) return;
      const blob = await (await fetch(image.webPath)).blob();
      const form = new FormData();
      form.append('photo', blob, 'avatar.jpg');
      const res = await api<{ photo_path: string }>('me/avatar', {
        method: 'POST',
        body: form,
      });
      const updated = { ...draft, photo_path: res.photo_path };
      setDraft(updated);
      onUpdate(updated);
      setInfo(t('identity.photoSaved'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('identity.genericError'));
    }
  }

  async function changePassword() {
    if (newPassword.length < 10) {
      setError(t('identity.passwordHint'));
      return;
    }
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await api('auth/password/change', {
        method: 'POST',
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      });
      setOldPassword('');
      setNewPassword('');
      setInfo(t('identity.passwordChanged'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('identity.genericError'));
    } finally {
      setBusy(false);
    }
  }

  async function revokeSession(id: number) {
    try {
      await api(`me/sessions/${id}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('identity.genericError'));
    }
  }

  async function revokeAllOthers() {
    try {
      await api('me/sessions/all', { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.is_current));
      setInfo(t('identity.logoutOtherSessions'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('identity.genericError'));
    }
  }

  async function exportData() {
    try {
      const data = await api<object>('me/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tohobil-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setInfo(t('identity.dataExported'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('identity.genericError'));
    }
  }

  async function deleteAccount() {
    if (!deletePass) return;
    setBusy(true);
    setError('');
    try {
      await api('me', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePass }),
      });
      onLogout();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('identity.genericError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <IonPage>
      <IonContent className="identity-content">
        <div className="identity-container profile-container">
          <div className="profile-header-card">
            <div className="profile-avatar-wrap">
              {draft.photo_path ? (
                <img
                  src={`${getApiBaseUrl()}/api/v1/me/avatar`}
                  alt={draft.name}
                  className="profile-avatar-img"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="profile-avatar-initials">
                  {draft.name ? draft.name.charAt(0).toUpperCase() : 'T'}
                </div>
              )}
              <button
                type="button"
                className="profile-photo-change-btn"
                onClick={() => void pickPhoto()}
                aria-label={t('identity.changePhoto')}
              >
                <span className="material-symbols-rounded">edit</span>
              </button>
            </div>
            <h2>{draft.name}</h2>
            <p className="profile-phone-badge">{draft.phone}</p>
          </div>

          {info && <p className="identity-info-banner">{info}</p>}
          {error && <p role="alert" className="identity-error-banner">{error}</p>}

          <div className="identity-card">
            <h3>{t('identity.profile')}</h3>
            <Field
              label={t('identity.name')}
              value={draft.name}
              onChange={(v) => edit('name', v)}
            />
            <Field
              label={t('identity.email')}
              value={draft.email ?? ''}
              onChange={(v) => edit('email', v)}
              type="email"
            />
            <Field
              label={t('identity.occupation')}
              value={draft.occupation ?? ''}
              onChange={(v) => edit('occupation', v)}
            />
            <Field
              label={t('identity.birth_date')}
              value={draft.birth_date ?? ''}
              onChange={(v) => edit('birth_date', v)}
              type="date"
            />
            <Field
              label={t('identity.city')}
              value={draft.city ?? ''}
              onChange={(v) => edit('city', v)}
            />
            <label className="identity-field">
              <span className="identity-field-label">{t('identity.country')}</span>
              <select
                className="identity-input"
                value={draft.country}
                onChange={(e) => edit('country', e.target.value)}
              >
                {ALL_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="identity-field">
              <span className="identity-field-label">{t('identity.currency')}</span>
              <select
                className="identity-input"
                value={draft.currency}
                onChange={(e) => edit('currency', e.target.value)}
              >
                <option value="BDT">BDT (৳) — Bangladeshi Taka</option>
                <option value="USD">USD ($) — US Dollar</option>
                <option value="EUR">EUR (€) — Euro</option>
                <option value="GBP">GBP (£) — British Pound</option>
                <option value="SAR">SAR (﷼) — Saudi Riyal</option>
                <option value="AED">AED (د.إ) — UAE Dirham</option>
                <option value="INR">INR (₹) — Indian Rupee</option>
                <option value="MYR">MYR (RM) — Malaysian Ringgit</option>
                <option value="SGD">SGD (S$) — Singapore Dollar</option>
              </select>
            </label>
            <label className="identity-field">
              <span className="identity-field-label">{t('settings.language')}</span>
              <select
                className="identity-input"
                value={draft.language}
                onChange={(e) => {
                  const val = e.target.value as 'en' | 'bn';
                  edit('language', val);
                  void setLanguage(val);
                }}
              >
                <option value="en">English</option>
                <option value="bn">বাংলা</option>
              </select>
            </label>
            <IonButton
              expand="block"
              disabled={busy}
              className="brand-btn"
              onClick={() => void saveProfile()}
            >
              {busy ? <IonSpinner name="dots" /> : t('money.save')}
            </IonButton>
          </div>

          <div className="identity-card">
            <h3>{t('identity.changePhone')}</h3>
            <p className="section-note">{draft.phone}</p>
            <p className="section-note">{t('identity.phoneChangeUnavailable')}</p>
          </div>

          <div className="identity-card">
            <h3>{t('identity.changePassword')}</h3>
            <PasswordField
              label={t('identity.currentPassword')}
              value={oldPassword}
              onChange={setOldPassword}
            />
            <PasswordField
              label={t('identity.newPassword')}
              value={newPassword}
              onChange={setNewPassword}
              helperText={t('identity.passwordHint')}
            />
            <IonButton
              expand="block"
              disabled={busy || !oldPassword || !newPassword}
              onClick={() => void changePassword()}
            >
              {t('identity.changePassword')}
            </IonButton>
          </div>

          <div className="identity-card">
            <div className="card-title-row">
              <h3>{t('identity.sessions')}</h3>
              {sessions.length > 1 && (
                <IonButton
                  fill="clear"
                  size="small"
                  onClick={() => void revokeAllOthers()}
                >
                  {t('identity.logoutOtherSessions')}
                </IonButton>
              )}
            </div>
            <div className="sessions-list">
              {sessions.map((s) => (
                <div key={s.id} className="session-item">
                  <div className="session-info">
                    <span className="session-device">
                      {s.model || s.platform || t('identity.unknownDevice')}
                    </span>
                    {s.is_current && (
                      <span className="current-badge">{t('identity.currentDevice')}</span>
                    )}
                    <span className="session-time">
                      {s.last_used_at ? new Date(s.last_used_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                  {!s.is_current && (
                    <IonButton
                      fill="clear"
                      color="danger"
                      size="small"
                      onClick={() => void revokeSession(s.id)}
                    >
                      {t('identity.revoke')}
                    </IonButton>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="identity-card">
            <h3>{t('more.settings')}</h3>
            <IonButton fill="outline" expand="block" onClick={() => void exportData()}>
              <span className="material-symbols-rounded icon-pad">download</span>
              {t('identity.downloadData')}
            </IonButton>

            {!confirmDelete ? (
              <IonButton
                fill="clear"
                color="danger"
                expand="block"
                onClick={() => setConfirmDelete(true)}
              >
                <span className="material-symbols-rounded icon-pad">delete</span>
                {t('identity.deleteAccount')}
              </IonButton>
            ) : (
              <div className="delete-confirm-box">
                <p className="delete-warn-text">{t('identity.deleteAccountConfirm')}</p>
                <PasswordField
                  label={t('identity.enterPasswordToDelete')}
                  value={deletePass}
                  onChange={setDeletePass}
                />
                <div className="delete-actions">
                  <IonButton
                    color="danger"
                    disabled={busy || !deletePass}
                    onClick={() => void deleteAccount()}
                  >
                    {t('identity.deleteAccount')}
                  </IonButton>
                  <IonButton
                    fill="clear"
                    onClick={() => {
                      setConfirmDelete(false);
                      setDeletePass('');
                    }}
                  >
                    {t('identity.cancel')}
                  </IonButton>
                </div>
              </div>
            )}
          </div>

          <div className="profile-logout-wrap">
            <IonButton expand="block" color="danger" fill="outline" onClick={onLogout}>
              {t('identity.logout')}
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
