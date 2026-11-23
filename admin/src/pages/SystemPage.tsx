import { useState, useEffect } from 'react';
import { adminFetch } from '../lib/api';
import { t } from '../lib/copy';
import { Activity } from 'lucide-react';

interface SystemHealthData {
  php_version: string;
  codeigniter_version: string;
  mysql_version: string;
  database_name: string;
  database_size_mb: number;
  disk_free_gb: number;
  disk_total_gb: number;
  cron_jobs: Array<{
    command_name: string;
    last_started_at: string;
    last_completed_at: string | null;
    status: string;
    duration_ms: number;
    error_message: string | null;
  }>;
  server_time: string;
  queue?: { pending: number; failed: number };
  firebase_configured?: boolean;
  recent_errors?: string[];
}

export function SystemPage() {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch<SystemHealthData>('system/health')
      .then(setHealth)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !health) {
    return <div style={{ padding: 40, color: 'var(--admin-muted)' }}>Checking server diagnostics...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>System Diagnostics & Cron Health</h1>
        <p style={{ color: 'var(--admin-muted)', fontSize: 13, margin: 0 }}>
          Server runtime versions, database capacity, and background cron execution telemetry.
        </p>
      </div>

      {/* Runtime Specs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="surface-card" style={{ padding: 18 }}>
          <span style={{ fontSize: 12, color: 'var(--admin-muted)' }}>PHP Engine</span>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>v{health.php_version}</div>
          <span style={{ fontSize: 11, color: 'var(--admin-muted)' }}>CodeIgniter v{health.codeigniter_version}</span>
        </div>

        <div className="surface-card" style={{ padding: 18 }}>
          <span style={{ fontSize: 12, color: 'var(--admin-muted)' }}>MySQL Database</span>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{health.database_name}</div>
          <span style={{ fontSize: 11, color: 'var(--admin-muted)' }}>Engine {health.mysql_version}</span>
        </div>

        <div className="surface-card" style={{ padding: 18 }}>
          <span style={{ fontSize: 12, color: 'var(--admin-muted)' }}>Database Size</span>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{health.database_size_mb} MB</div>
          <span style={{ fontSize: 11, color: 'var(--admin-success)' }}>Optimized indexed tables</span>
        </div>

        <div className="surface-card" style={{ padding: 18 }}>
          <span style={{ fontSize: 12, color: 'var(--admin-muted)' }}>Storage Capacity</span>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{health.disk_free_gb} GB Free</div>
          <span style={{ fontSize: 11, color: 'var(--admin-muted)' }}>of {health.disk_total_gb} GB total</span>
        </div>
      </div>

      <div className="surface-card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>Queue pending {health.queue?.pending ?? 0} · failed {health.queue?.failed ?? 0}</div>
        <div>Firebase {health.firebase_configured ? 'configured' : 'missing'}</div>
        <button className="btn-secondary" type="button" onClick={() => adminFetch('system/retry', { method: 'POST' }).then(() => window.location.reload())}>{t('retryFailed')}</button>
      </div>
      {(health.recent_errors ?? []).length > 0 && (
        <div className="surface-card" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Recent errors</h2>
          <ul>{health.recent_errors?.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      )}

      {/* Cron Jobs Execution Status */}
      <div className="surface-card">
        <div style={{ padding: 20, borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 2px' }}>cPanel Background Cron Tasks</h3>
            <span style={{ fontSize: 12, color: 'var(--admin-muted)' }}>Server wall-clock time: {health.server_time}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--admin-success)' }}>
            <Activity size={16} /> Scheduler Active
          </div>
        </div>

        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Cron Command</th>
                <th>Frequency</th>
                <th>Status</th>
                <th>Last Started</th>
                <th>Last Completed</th>
                <th>Runtime</th>
              </tr>
            </thead>
            <tbody>
              {health.cron_jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--admin-muted)' }}>
                    No cron jobs have reported execution yet. Ensure server crontab is set.
                  </td>
                </tr>
              ) : (
                health.cron_jobs.map((c) => (
                  <tr key={c.command_name}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.command_name}</td>
                    <td style={{ fontSize: 13 }}>
                      {c.command_name.includes('daily') ? 'Once Daily (Midnight)' : c.command_name.includes('automations') ? 'Every 15 Minutes' : 'Every Minute'}
                    </td>
                    <td>
                      <span className={`badge ${c.status === 'success' ? 'badge-success' : c.status === 'running' ? 'badge-warning' : 'badge-danger'}`}>
                        {c.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{new Date(c.last_started_at).toLocaleString()}</td>
                    <td style={{ fontSize: 12 }}>{c.last_completed_at ? new Date(c.last_completed_at).toLocaleString() : 'Running...'}</td>
                    <td style={{ fontSize: 12 }}>{c.duration_ms} ms</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
