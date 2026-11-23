import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../app/identity';
import { getAttachmentStorageUsage } from '../../db/repository';
import { clearDownloadedCache } from '../../lib/fileStorage';
import { uploadQueue } from '../../sync/uploadQueue';

export function StorageSettingsScreen({
  onToast,
}: {
  onToast?: (message: string) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [wifiOnly, setWifiOnly] = useState(false);
  const [localBytes, setLocalBytes] = useState(0);
  const [localCount, setLocalCount] = useState(0);
  const [serverUsedBytes, setServerUsedBytes] = useState(0);
  const [serverQuotaBytes, setServerQuotaBytes] = useState(1024 * 1024 * 1024);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    void uploadQueue.getWifiOnly().then(setWifiOnly);

    void getAttachmentStorageUsage().then((res) => {
      setLocalBytes(res.total_size);
      setLocalCount(res.total_count);
    });

    void api<{ storage: { used_bytes: number; quota_bytes: number } }>('/api/v1/storage/usage')
      .then((res) => {
        setServerUsedBytes(res.storage.used_bytes);
        setServerQuotaBytes(res.storage.quota_bytes);
      })
      .catch(() => {
        // Offline or unauthenticated
      });
  }, []);

  const handleToggleWifi = async () => {
    const next = !wifiOnly;
    setWifiOnly(next);
    await uploadQueue.setWifiOnly(next);
  };

  const handleClearCache = async () => {
    setClearing(true);
    try {
      await clearDownloadedCache();
      const res = await getAttachmentStorageUsage();
      setLocalBytes(res.total_size);
      setLocalCount(res.total_count);
      onToast?.(t('storage.cacheCleared'));
    } catch {
      // ignore
    } finally {
      setClearing(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const serverPercentage = Math.min(
    100,
    Math.round((serverUsedBytes / (serverQuotaBytes || 1)) * 100),
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButton slot="start" fill="clear" onClick={() => navigate(-1)}>
            <span className="material-symbols-rounded">arrow_back</span>
          </IonButton>
          <IonTitle>{t('storage.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="shell-content">
        <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Cloud Storage Usage Card */}
          <div
            className="surface-card"
            style={{
              padding: 16,
              borderRadius: 16,
              border: '1px solid var(--app-border)',
              background: 'var(--app-card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span className="material-symbols-rounded" style={{ color: '#14B8A6', fontSize: 26 }}>
                cloud_queue
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: 'var(--app-text)' }}>
                  {t('storage.cloudStorage')}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--app-muted)' }}>
                  {formatBytes(serverUsedBytes)} {t('common.of')} {formatBytes(serverQuotaBytes)}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div
              style={{
                width: '100%',
                height: 8,
                backgroundColor: 'var(--app-bg)',
                borderRadius: 4,
                overflow: 'hidden',
                marginTop: 8,
              }}
            >
              <div
                style={{
                  width: `${serverPercentage}%`,
                  height: '100%',
                  backgroundColor: serverPercentage > 90 ? '#F43F5E' : '#14B8A6',
                  borderRadius: 4,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Device Local Storage Card */}
          <div
            className="surface-card"
            style={{
              padding: 16,
              borderRadius: 16,
              border: '1px solid var(--app-border)',
              background: 'var(--app-card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span className="material-symbols-rounded" style={{ color: '#6366F1', fontSize: 26 }}>
                smartphone
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: 'var(--app-text)' }}>
                  {t('storage.localStorage')}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--app-muted)' }}>
                  {formatBytes(localBytes)} ({localCount} {t('vault.files')})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearCache}
              disabled={clearing}
              style={{
                marginTop: 8,
                padding: '10px 16px',
                borderRadius: 12,
                border: '1px solid var(--app-border)',
                background: 'var(--app-bg)',
                color: 'var(--app-text)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
                cleaning_services
              </span>
              {clearing ? t('common.clearing') : t('storage.clearCache')}
            </button>
          </div>

          {/* Upload Settings Card */}
          <div
            className="surface-card"
            style={{
              padding: 16,
              borderRadius: 16,
              border: '1px solid var(--app-border)',
              background: 'var(--app-card)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-symbols-rounded" style={{ color: '#0EA5E9', fontSize: 26 }}>
                  wifi
                </span>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, color: 'var(--app-text)' }}>
                    {t('storage.wifiOnlyTitle')}
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--app-muted)' }}>
                    {t('storage.wifiOnlyDesc')}
                  </p>
                </div>
              </div>

              <input
                type="checkbox"
                checked={wifiOnly}
                onChange={handleToggleWifi}
                style={{ width: 20, height: 20, cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
