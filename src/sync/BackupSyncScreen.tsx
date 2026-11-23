import React, { useEffect, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSyncStore } from './store';

export const BackupSyncScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, lastSyncTime, pendingCount, isOnline, sync } = useSyncStore();
  const [syncingNow, setSyncingNow] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleSyncNow = async () => {
    setSyncingNow(true);
    try {
      await sync();
    } finally {
      setSyncingNow(false);
    }
  };

  const formatLastSync = (timestamp: number | null): string => {
    if (!timestamp) return t('sync.never');
    const diff = Math.floor((now - timestamp) / 1000);
    if (diff < 60) return t('sync.justNow');
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getStatusBadge = () => {
    if (!isOnline) {
      return { text: t('sync.offline'), color: '#f59e0b', icon: 'cloud_off' };
    }
    if (status === 'syncing' || syncingNow) {
      return { text: t('sync.syncing'), color: '#0ea5e9', icon: 'sync' };
    }
    if (status === 'error') {
      return { text: t('sync.error'), color: '#f43f5e', icon: 'sync_problem' };
    }
    return { text: t('sync.idle'), color: '#22c55e', icon: 'check_circle' };
  };

  const badge = getStatusBadge();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButton
            slot="start"
            fill="clear"
            aria-label={t('a11y.back')}
            onClick={() => navigate(-1)}
          >
            <span className="material-symbols-rounded">arrow_back</span>
          </IonButton>
          <IonTitle>{t('sync.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="shell-content">
        <div className="page-pad">
          {/* Status Hero Card */}
          <div className="sync-hero-card">
            <div
              className="sync-status-icon-bubble"
              style={{ background: `${badge.color}20`, color: badge.color }}
            >
              <span className={`material-symbols-rounded ${status === 'syncing' || syncingNow ? 'spin' : ''}`}>
                {badge.icon}
              </span>
            </div>
            <h2 className="sync-status-title">{badge.text}</h2>
            <p className="sync-last-time">
              {t('sync.lastSynced')}: {formatLastSync(lastSyncTime)}
            </p>

            <button
              className="sync-action-btn"
              disabled={syncingNow || status === 'syncing' || !isOnline}
              onClick={() => void handleSyncNow()}
            >
              {syncingNow || status === 'syncing' ? (
                <>
                  <IonSpinner name="crescent" style={{ width: 18, height: 18 }} />
                  <span>{t('sync.syncing')}</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-rounded">sync</span>
                  <span>{t('sync.syncNow')}</span>
                </>
              )}
            </button>
          </div>

          {/* Pending Changes Card */}
          <div className="surface-card sync-details-card">
            <div className="sync-card-row">
              <div className="sync-card-col">
                <span className="sync-card-label">{t('sync.pendingChanges')}</span>
                <span className="sync-card-value">
                  {pendingCount === 0
                    ? t('sync.allSynced')
                    : pendingCount === 1
                      ? t('sync.pendingCount', { count: pendingCount })
                      : t('sync.pendingCount_other', { count: pendingCount })}
                </span>
              </div>
              <div
                className="sync-pending-badge"
                style={{
                  background: pendingCount > 0 ? '#f59e0b20' : '#22c55e20',
                  color: pendingCount > 0 ? '#f59e0b' : '#22c55e',
                }}
              >
                <span className="material-symbols-rounded">
                  {pendingCount > 0 ? 'schedule' : 'cloud_done'}
                </span>
                <span>{pendingCount}</span>
              </div>
            </div>
          </div>

          {/* Offline-First Information Card */}
          <div className="surface-card sync-info-card">
            <div className="sync-info-header">
              <span className="material-symbols-rounded" style={{ color: '#14b8a6' }}>
                offline_bolt
              </span>
              <h3>{t('appName')}</h3>
            </div>
            <p className="sync-info-text">{t('sync.syncDescription')}</p>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};
