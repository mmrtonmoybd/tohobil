import React, { useState, useEffect } from 'react';
import { adminFetch } from '../lib/api';
import { Save } from 'lucide-react';

export function AppConfigPage() {
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [minVersion, setMinVersion] = useState('0.0.0');
  const [latestVersion, setLatestVersion] = useState('0.1.0');
  const [updateMessage, setUpdateMessage] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [playStoreUrl, setPlayStoreUrl] = useState('');
  const [featureFlags, setFeatureFlags] = useState('{}');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminFetch<{ config: Record<string, string> }>('config')
      .then((res) => {
        const c = res.config;
        setMaintenance(c.maintenance === 'true');
        setMaintenanceMessage(c.maintenance_message || '');
        setMinVersion(c.min_android_version || '0.0.0');
        setLatestVersion(c.latest_android_version || '0.1.0');
        setUpdateMessage(c.update_message || '');
        setSupportEmail(c.support_email || 'support@tohobil.app');
        setPlayStoreUrl(c.play_store_url || '');
        setFeatureFlags(c.feature_flags || '{}');
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await adminFetch('config', {
        method: 'POST',
        body: JSON.stringify({
          maintenance: maintenance ? 'true' : 'false',
          maintenance_message: maintenanceMessage,
          min_android_version: minVersion,
          latest_android_version: latestVersion,
          update_message: updateMessage,
          support_email: supportEmail,
          play_store_url: playStoreUrl,
          feature_flags: featureFlags,
        }),
      });
      alert('Remote app configuration saved and deployed immediately.');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--admin-muted)' }}>Loading remote configuration...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>App Remote Config & Flags</h1>
        <p style={{ color: 'var(--admin-muted)', fontSize: 13, margin: 0 }}>
          Manage global maintenance mode, forced minimum versions, soft update banners, and feature toggles.
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Maintenance Mode Card */}
        <div className="surface-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 2px' }}>Maintenance Mode Killswitch</h3>
              <p style={{ fontSize: 12, color: 'var(--admin-muted)', margin: 0 }}>
                When active, all mobile API access returns HTTP 503 with maintenance state dialog.
              </p>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={maintenance}
                onChange={(e) => setMaintenance(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--admin-danger)' }}
              />
              <span style={{ fontWeight: 700, color: maintenance ? 'var(--admin-danger)' : 'var(--admin-muted)' }}>
                {maintenance ? 'MAINTENANCE ACTIVE' : 'Normal Operations'}
              </span>
            </label>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Maintenance User Message</label>
            <input
              type="text"
              className="input-field"
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              placeholder="Tohobil is currently undergoing scheduled maintenance. Please check back shortly."
            />
          </div>
        </div>

        {/* Version Control */}
        <div className="surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Version Enforcement</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Minimum Supported Android Version (Force Update)
              </label>
              <input
                type="text"
                className="input-field"
                value={minVersion}
                onChange={(e) => setMinVersion(e.target.value)}
                placeholder="0.1.0"
              />
              <span style={{ fontSize: 11, color: 'var(--admin-muted)' }}>
                Clients below this version will be blocked from sync with an update modal.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Latest Published Version (Soft Prompt)
              </label>
              <input
                type="text"
                className="input-field"
                value={latestVersion}
                onChange={(e) => setLatestVersion(e.target.value)}
                placeholder="0.2.0"
              />
              <span style={{ fontSize: 11, color: 'var(--admin-muted)' }}>
                Displays dismissible top banner when a newer version is on Play Store.
              </span>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Google Play Store URL</label>
            <input
              type="text"
              className="input-field"
              value={playStoreUrl}
              onChange={(e) => setPlayStoreUrl(e.target.value)}
              placeholder="https://play.google.com/store/apps/details?id=com.tohobil.app"
            />
          </div>
        </div>

        {/* Feature Flags */}
        <div className="surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>Feature Flags JSON</h3>
          <p style={{ fontSize: 12, color: 'var(--admin-muted)', margin: '0 0 12px' }}>
            Dynamic remote feature switches returned to mobile clients via <code>GET /api/v1/app/status</code>.
          </p>
          <textarea
            rows={4}
            className="input-field"
            style={{ fontFamily: 'monospace', fontSize: 12 }}
            value={featureFlags}
            onChange={(e) => setFeatureFlags(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '10px 20px', fontSize: 15 }}>
            <Save size={18} /> {saving ? 'Saving...' : 'Deploy Configuration Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
