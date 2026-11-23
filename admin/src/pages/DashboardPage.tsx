import { useState, useEffect } from 'react';
import { adminFetch } from '../lib/api';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Users, Smartphone, HardDrive, AlertTriangle } from 'lucide-react';

interface DashboardData {
  kpi: {
    users: {
      total: number;
      new_today: number;
      new_7d: number;
      new_30d: number;
      dau: number;
      wau: number;
      mau: number;
      disabled: number;
      blocked: number;
    };
    devices: {
      total: number;
      push_enabled: number;
    };
    storage: {
      total_files: number;
      total_bytes: number;
    };
    support: {
      open_tickets: number;
    };
  };
  charts: {
    signups_14d: Array<{ date: string; count: number }>;
  };
  recent_users: Array<{
    id: number;
    name: string;
    phone: string;
    platform: string;
    status: string;
    created_at: string;
  }>;
  alerts: Array<{
    type: string;
    title: string;
    message: string;
  }>;
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch<DashboardData>('dashboard')
      .then(setData)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--admin-muted)' }}>Loading metrics...</div>;
  }

  const { kpi, charts, recent_users, alerts } = data;

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Title */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Executive Operations Dashboard</h1>
        <p style={{ color: 'var(--admin-muted)', fontSize: 14, margin: 0 }}>
          Real-time system metrics, user growth, and active infrastructure health.
        </p>
      </div>

      {/* System Alerts */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alerts.map((a, i) => (
            <div
              key={i}
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                background: '#f59e0b15',
                border: '1px solid #f59e0b30',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <AlertTriangle size={20} color="var(--admin-warning)" />
              <div>
                <strong style={{ fontSize: 13, color: 'var(--admin-warning)' }}>{a.title}</strong>
                <div style={{ fontSize: 12, color: 'var(--admin-text)' }}>{a.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div className="surface-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-muted)' }}>Total Users</span>
            <div style={{ padding: 8, borderRadius: 8, background: '#0d948815', color: 'var(--admin-primary)' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{kpi.users.total.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: 'var(--admin-success)', marginTop: 4, display: 'flex', gap: 6 }}>
            <span>+{kpi.users.new_today} today</span>
            <span style={{ color: 'var(--admin-muted)' }}>• +{kpi.users.new_7d} this week</span>
          </div>
        </div>

        <div className="surface-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-muted)' }}>Active Users (DAU / MAU)</span>
            <div style={{ padding: 8, borderRadius: 8, background: '#6366f115', color: 'var(--admin-accent)' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{kpi.users.dau.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: 'var(--admin-muted)', marginTop: 4 }}>
            WAU: {kpi.users.wau.toLocaleString()} • MAU: {kpi.users.mau.toLocaleString()}
          </div>
        </div>

        <div className="surface-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-muted)' }}>Registered Devices</span>
            <div style={{ padding: 8, borderRadius: 8, background: '#0ea5e915', color: '#0ea5e9' }}>
              <Smartphone size={18} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{kpi.devices.total.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: 'var(--admin-muted)', marginTop: 4 }}>
            {kpi.devices.push_enabled.toLocaleString()} push-notification enabled
          </div>
        </div>

        <div className="surface-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-muted)' }}>Storage Used</span>
            <div style={{ padding: 8, borderRadius: 8, background: '#f59e0b15', color: 'var(--admin-warning)' }}>
              <HardDrive size={18} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{formatBytes(kpi.storage.total_bytes)}</div>
          <div style={{ fontSize: 12, color: 'var(--admin-muted)', marginTop: 4 }}>
            {kpi.storage.total_files.toLocaleString()} uploaded media files
          </div>
        </div>
      </div>

      {/* Chart & Summary Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Signups Chart */}
        <div className="surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>User Sign-ups (Past 14 Days)</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.signups_14d}>
                <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5)} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Support & Security Summary */}
        <div className="surface-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Quick Operations Status</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--admin-muted)' }}>Pending Support Tickets</span>
                <span className="badge badge-warning">{kpi.support.open_tickets}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--admin-muted)' }}>Disabled Accounts</span>
                <span className="badge badge-info">{kpi.users.disabled}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--admin-muted)' }}>Blocked Accounts</span>
                <span className="badge badge-danger">{kpi.users.blocked}</span>
              </div>
            </div>
          </div>

          <div style={{ padding: 12, borderRadius: 8, background: 'var(--admin-bg)', fontSize: 12, color: 'var(--admin-muted)' }}>
            <strong>Privacy Enforcement:</strong> Admins can never access users' private ledgers, balances, or financial notes.
          </div>
        </div>
      </div>

      {/* Recent Users Table */}
      <div className="surface-card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Recently Registered Users</h3>
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Platform</th>
                <th>Status</th>
                <th>Registered At</th>
              </tr>
            </thead>
            <tbody>
              {recent_users.map((u) => (
                <tr key={u.id}>
                  <td>#{u.id}</td>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>{u.phone}</td>
                  <td>{u.platform || 'android'}</td>
                  <td>
                    <span className={`badge ${u.status === 'active' ? 'badge-success' : u.status === 'disabled' ? 'badge-warning' : 'badge-danger'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td>{new Date(u.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
