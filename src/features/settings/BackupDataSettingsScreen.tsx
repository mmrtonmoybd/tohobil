import { useState } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useSyncStore } from '../../sync/store';
import { exportEncryptedBackup, restoreEncryptedBackup, shareOrDownloadBackup } from '../../lib/backup';
import { getApiBaseUrl, token } from '../../app/identity';

export function BackupDataSettingsScreen({
  onToast,
  onBack,
}: {
  onToast: (msg: string) => void;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  const { pendingCount, status, sync, lastSyncTime } = useSyncStore();
  const isSyncing = status === 'syncing';

  // Encrypted Backup Export Modal
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportPass, setExportPass] = useState('');
  const [exportPassConfirm, setExportPassConfirm] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState('');

  // Encrypted Backup Restore Modal
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreFileContent, setRestoreFileContent] = useState('');
  const [restorePass, setRestorePass] = useState('');
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [fileName, setFileName] = useState('');

  // Download ZIP
  const [downloadZipBusy, setDownloadZipBusy] = useState(false);

  async function handleExportBackup(e: React.FormEvent) {
    e.preventDefault();
    if (exportPass.length < 6) {
      setExportError(t('backup.passMinLength'));
      return;
    }
    if (exportPass !== exportPassConfirm) {
      setExportError(t('backup.passMismatch'));
      return;
    }
    setExportBusy(true);
    setExportError('');
    try {
      const content = await exportEncryptedBackup(exportPass);
      await shareOrDownloadBackup(content);
      setExportModalOpen(false);
      setExportPass('');
      setExportPassConfirm('');
      onToast(t('backup.exportSuccess'));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setExportBusy(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setRestoreFileContent(reader.result as string);
    };
    reader.readAsText(file);
  }

  async function handleRestoreBackup(e: React.FormEvent) {
    e.preventDefault();
    if (!restoreFileContent) {
      setRestoreError(t('backup.selectFileFirst'));
      return;
    }
    if (!restorePass) {
      setRestoreError(t('backup.enterPassphrase'));
      return;
    }
    setRestoreBusy(true);
    setRestoreError('');
    try {
      const stats = await restoreEncryptedBackup(restoreFileContent, restorePass);
      setRestoreModalOpen(false);
      setRestorePass('');
      setRestoreFileContent('');
      setFileName('');
      onToast(t('backup.restoreSuccess', { tables: stats.restoredTables, rows: stats.restoredRows }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'INCORRECT_PASSPHRASE') {
        setRestoreError(t('backup.incorrectPassphrase'));
      } else {
        setRestoreError(t('backup.restoreFailed'));
      }
    } finally {
      setRestoreBusy(false);
    }
  }

  async function handleDownloadDataZip() {
    setDownloadZipBusy(true);
    try {
      const accessToken = await token();
      const response = await fetch(`${getApiBaseUrl()}/api/v1/me/export-zip`, {
        headers: {
          Authorization: `Bearer ${accessToken ?? ''}`,
          Accept: 'application/zip',
        },
      });
      if (!response.ok) {
        throw new Error('Export failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tohobil-data-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast(t('backup.zipDownloadedSuccess'));
    } catch {
      onToast(t('backup.zipDownloadFailed'));
    } finally {
      setDownloadZipBusy(false);
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
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('backup.title')}</h1>
      </div>

      <IonContent className="shell-content">
        <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Cloud Sync */}
          <div className="surface-card" style={{ padding: 20, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#14b8a620', color: '#14b8a6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-rounded">cloud_sync</span>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{t('sync.title')}</h3>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--app-muted)' }}>
                    {lastSyncTime ? `${t('sync.lastSync')}: ${new Date(lastSyncTime).toLocaleTimeString()}` : t('sync.notSyncedYet')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => void sync()}
                className="btn-accent"
                style={{ padding: '8px 16px', borderRadius: 12, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                {isSyncing ? t('sync.syncing') : t('sync.syncNow')}
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--app-muted)' }}>
              {pendingCount === 0 ? t('sync.allSynced') : t('sync.pendingCount', { count: pendingCount })}
            </p>
          </div>

          {/* Local Encrypted Backup */}
          <div className="surface-card" style={{ padding: 20, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#6366f120', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-rounded">enhanced_encryption</span>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{t('backup.localEncryptedBackup')}</h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--app-muted)' }}>{t('backup.localEncryptedSubtitle')}</p>
              </div>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--app-text)', lineHeight: 1.45 }}>
              {t('backup.encryptedHelp')}
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setExportError('');
                  setExportPass('');
                  setExportPassConfirm('');
                  setExportModalOpen(true);
                }}
                className="btn-accent"
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'center' }}
              >
                {t('backup.createBackup')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRestoreError('');
                  setRestorePass('');
                  setRestoreFileContent('');
                  setFileName('');
                  setRestoreModalOpen(true);
                }}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--app-border)', background: 'var(--app-card)', color: 'var(--app-text)', fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'center' }}
              >
                {t('backup.restoreBackup')}
              </button>
            </div>
          </div>

          {/* Download My Data (ZIP) */}
          <div className="surface-card" style={{ padding: 20, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f59e0b20', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-rounded">folder_zip</span>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{t('backup.downloadMyDataZip')}</h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--app-muted)' }}>{t('backup.downloadMyDataSubtitle')}</p>
              </div>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--app-muted)', lineHeight: 1.45 }}>
              {t('backup.zipDescription')}
            </p>

            <button
              type="button"
              disabled={downloadZipBusy}
              onClick={() => void handleDownloadDataZip()}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                border: '1px solid var(--app-border)',
                background: 'var(--app-card)',
                color: 'var(--app-text)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <span className="material-symbols-rounded">download</span>
              {downloadZipBusy ? t('common.downloading') : t('backup.downloadZipButton')}
            </button>
          </div>
        </div>
      </IonContent>

      {/* Export Passphrase Modal */}
      {exportModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <form onSubmit={(e) => void handleExportBackup(e)} className="surface-card" style={{ width: '100%', maxWidth: 360, padding: 24, borderRadius: 20 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>{t('backup.protectWithPassphrase')}</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--app-muted)', lineHeight: 1.4 }}>
              {t('backup.passphraseExplanation')}
            </p>

            <input
              type="password"
              placeholder={t('backup.enterPassphrase')}
              value={exportPass}
              onChange={(e) => setExportPass(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--app-border)', marginBottom: 12 }}
              required
            />
            <input
              type="password"
              placeholder={t('backup.confirmPassphrase')}
              value={exportPassConfirm}
              onChange={(e) => setExportPassConfirm(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--app-border)', marginBottom: 16 }}
              required
            />

            {exportError && <p style={{ color: 'var(--app-danger)', fontSize: 13, margin: '0 0 14px' }}>{exportError}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid var(--app-border)', background: 'transparent', cursor: 'pointer' }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={exportBusy}
                className="btn-accent"
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', fontWeight: 600, cursor: 'pointer' }}
              >
                {exportBusy ? t('common.exporting') : t('common.export')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Restore Passphrase Modal */}
      {restoreModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <form onSubmit={(e) => void handleRestoreBackup(e)} className="surface-card" style={{ width: '100%', maxWidth: 360, padding: 24, borderRadius: 20 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>{t('backup.restoreFromBackup')}</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--app-muted)', lineHeight: 1.4 }}>
              {t('backup.restoreWarning')}
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                {t('backup.selectBackupFile')}
              </label>
              <input
                type="file"
                accept=".tohobil,application/json,application/octet-stream"
                onChange={handleFileSelect}
                style={{ width: '100%', fontSize: 13 }}
              />
              {fileName && <div style={{ fontSize: 12, color: 'var(--app-accent)', marginTop: 4 }}>{fileName}</div>}
            </div>

            <input
              type="password"
              placeholder={t('backup.enterBackupPassphrase')}
              value={restorePass}
              onChange={(e) => setRestorePass(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--app-border)', marginBottom: 16 }}
              required
            />

            {restoreError && <p style={{ color: 'var(--app-danger)', fontSize: 13, margin: '0 0 14px' }}>{restoreError}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid var(--app-border)', background: 'transparent', cursor: 'pointer' }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={restoreBusy || !restoreFileContent}
                className="btn-accent"
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', fontWeight: 600, cursor: 'pointer' }}
              >
                {restoreBusy ? t('common.restoring') : t('common.restore')}
              </button>
            </div>
          </form>
        </div>
      )}
    </IonPage>
  );
}
