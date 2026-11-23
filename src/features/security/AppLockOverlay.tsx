import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getIsAppLocked,
  verifyAppPin,
  authenticateWithBiometrics,
  checkBiometrics,
  getSecuritySettings,
  subscribeLockState,
} from '../../lib/security';

export function AppLockOverlay() {
  const { t } = useTranslation();
  const [locked, setLocked] = useState(() => getIsAppLocked());
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  useEffect(() => {
    return subscribeLockState((isLocked) => {
      setLocked(isLocked);
      if (isLocked) {
        setPin('');
        setError(false);
      }
    });
  }, []);

  const triggerBiometricUnlock = useCallback(async () => {
    const settings = getSecuritySettings();
    if (settings.biometricsEnabled) {
      await authenticateWithBiometrics(t('security.unlockWithBiometrics'));
    }
  }, [t]);

  useEffect(() => {
    if (locked) {
      void checkBiometrics().then((res) => {
        setBiometricsAvailable(res.available && getSecuritySettings().biometricsEnabled);
      });
      // Try biometric prompt automatically once on lock
      if (getSecuritySettings().biometricsEnabled) {
        const timer = setTimeout(() => {
          void triggerBiometricUnlock();
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [locked, triggerBiometricUnlock]);

  if (!locked) return null;

  async function handleKeyPress(num: string) {
    if (pin.length >= 6) return;
    const next = pin + num;
    setPin(next);
    setError(false);

    // Auto verify if at 4 or 6 digits
    if (next.length === 4) {
      const ok = await verifyAppPin(next);
      if (ok) {
        setPin('');
      } else {
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 600);
      }
    }
  }

  function handleBackspace() {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  }

  function handleClear() {
    setPin('');
    setError(false);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'var(--app-bg, #f8fafc)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '48px 24px 32px',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 40 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #0d9488, #4f46e5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(13, 148, 136, 0.3)',
            marginBottom: 20,
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 34, color: '#ffffff' }}>
            lock
          </span>
        </div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--app-text, #0f172a)' }}>
          {t('security.appLockedTitle')}
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--app-muted, #64748b)' }}>
          {t('security.enterPinToUnlock')}
        </p>

        {/* PIN Dots */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginTop: 32,
            transform: error ? 'translateX(-4px)' : 'none',
            transition: 'transform 0.1s ease',
          }}
        >
          {[0, 1, 2, 3].map((idx) => {
            const filled = pin.length > idx;
            return (
              <div
                key={idx}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: error
                    ? 'var(--app-danger, #ef4444)'
                    : filled
                      ? 'var(--app-accent, #0d9488)'
                      : 'var(--app-border, #cbd5e1)',
                  transition: 'background 0.15s ease, transform 0.15s ease',
                  transform: filled ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Keypad */}
      <div style={{ width: '100%', maxWidth: 300, marginBottom: 20 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => void handleKeyPress(digit)}
              style={{
                height: 64,
                borderRadius: '50%',
                background: 'var(--app-card, #ffffff)',
                border: '1px solid var(--app-border, #e2e8f0)',
                fontSize: 24,
                fontWeight: 600,
                color: 'var(--app-text, #0f172a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
              }}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={biometricsAvailable ? () => void triggerBiometricUnlock() : handleClear}
            style={{
              height: 64,
              borderRadius: '50%',
              background: 'transparent',
              border: 'none',
              fontSize: 14,
              color: 'var(--app-accent, #0d9488)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {biometricsAvailable ? (
              <span className="material-symbols-rounded" style={{ fontSize: 30 }}>
                fingerprint
              </span>
            ) : (
              t('common.clear')
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleKeyPress('0')}
            style={{
              height: 64,
              borderRadius: '50%',
              background: 'var(--app-card, #ffffff)',
              border: '1px solid var(--app-border, #e2e8f0)',
              fontSize: 24,
              fontWeight: 600,
              color: 'var(--app-text, #0f172a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            }}
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            style={{
              height: 64,
              borderRadius: '50%',
              background: 'transparent',
              border: 'none',
              fontSize: 20,
              color: 'var(--app-muted, #64748b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 26 }}>
              backspace
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
