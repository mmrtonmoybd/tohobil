import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { evaluateUpdate, type UpdateCheckResult } from '../../lib/inAppUpdate';
import { api } from '../../app/identity';

interface AppStatusResponse {
  min_version?: string;
  min_supported_version?: string;
  latest_version?: string;
  release_notes?: string;
  store_url?: string;
  play_store_url?: string;
}

export function InAppUpdateBanner({
  currentVersion = '0.1.0',
}: {
  currentVersion?: string;
}) {
  const { t } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api<AppStatusResponse>('app/status')
      .then((status) => {
        const result = evaluateUpdate(currentVersion, {
          min_version: status.min_version || status.min_supported_version,
          latest_version: status.latest_version,
          release_notes: status.release_notes,
          store_url: status.play_store_url || status.store_url,
        });
        if (result.updateRequired || result.updateAvailable) {
          setUpdateInfo(result);
        }
      })
      .catch(() => {
        // Offline or error
      });
  }, [currentVersion]);

  const showOptional = Boolean(updateInfo && !updateInfo.updateRequired && !dismissed);
  useEffect(() => {
    if (showOptional) document.documentElement.dataset.updateBanner = '1';
    else delete document.documentElement.dataset.updateBanner;
    return () => {
      delete document.documentElement.dataset.updateBanner;
    };
  }, [showOptional]);

  if (!updateInfo || (dismissed && !updateInfo.updateRequired)) return null;

  function handleOpenStore() {
    const url =
      updateInfo?.storeUrl ||
      'https://play.google.com/store/apps/details?id=com.tohobil.app';
    window.open(url, '_blank');
  }

  // Blocking modal if update is mandatory
  if (updateInfo.updateRequired) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99998,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          className="surface-card"
          style={{
            width: '100%',
            maxWidth: 380,
            padding: 28,
            borderRadius: 24,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              background: '#ef444420',
              color: 'var(--app-danger)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 32 }}>
              download
            </span>
          </div>

          <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>
            {t('update.requiredTitle')}
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--app-muted)', lineHeight: 1.5 }}>
            {t('update.requiredBody', { version: updateInfo.minVersion })}
          </p>

          <button
            type="button"
            onClick={handleOpenStore}
            className="btn-accent"
            style={{
              width: '100%',
              padding: 13,
              borderRadius: 12,
              border: 'none',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            {t('update.updateNow')}
          </button>
        </div>
      </div>
    );
  }

  // Dismissible banner if optional update
  return (
    <div className="update-banner" role="status">
      <span className="material-symbols-rounded" style={{ color: 'var(--brand-a, #14b8a6)' }}>
        download
      </span>
      <div className="update-banner-copy">
        <strong>{t('update.availableTitle')}</strong>
        <p>{t('update.availableSubtitle', { version: updateInfo.latestVersion })}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={handleOpenStore}
          className="btn-accent"
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: 'none',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('update.update')}
        </button>
        <button
          type="button"
          aria-label={t('a11y.close')}
          onClick={() => setDismissed(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--app-muted)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
            close
          </span>
        </button>
      </div>
    </div>
  );
}
