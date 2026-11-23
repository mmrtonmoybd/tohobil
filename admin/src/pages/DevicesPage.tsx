import React, { useState, useEffect } from 'react';
import { adminFetch } from '../lib/api';
import { t } from '../lib/copy';
import { Smartphone, Shield, Plus, Trash2 } from 'lucide-react';

interface DeviceItem {
  id: number;
  user_id: number;
  user_name: string | null;
  user_phone: string | null;
  device_uid: string;
  model: string | null;
  manufacturer: string | null;
  platform: string;
  os_version: string | null;
  app_version: string | null;
  status: 'active' | 'blocked';
  last_seen_at: string;
}

interface BlocklistItem {
  id: number;
  type: 'phone' | 'device' | 'ip' | 'cidr';
  value: string;
  reason: string;
  expires_at: string | null;
  created_at: string;
}

export function DevicesPage() {
  const [tab, setTab] = useState<'devices' | 'blocklist'>('devices');
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [blocklist, setBlocklist] = useState<BlocklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [suspicious, setSuspicious] = useState<{ shared_devices: Array<{ device_uid: string; accounts: number }>; failed_ips: Array<{ ip: string; failures: number }>; signups_last_hour: number } | null>(null);

  // New Block Modal
  const [blockModal, setBlockModal] = useState(false);
  const [blockType, setBlockType] = useState<'phone' | 'device' | 'ip' | 'cidr'>('phone');
  const [blockValue, setBlockValue] = useState('');
  const [blockReason, setBlockReason] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'devices') {
        const res = await adminFetch<{ data: DeviceItem[] }>(`devices?search=${encodeURIComponent(search)}`);
        setDevices(res.data);
      } else {
        const res = await adminFetch<{ data: BlocklistItem[] }>('blocklist');
        setBlocklist(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [tab]);

  useEffect(() => {
    adminFetch<NonNullable<typeof suspicious>>('devices/suspicious').then(setSuspicious).catch(() => setSuspicious(null));
  }, []);

  async function toggleDeviceBlock(device: DeviceItem) {
    const isBlock = device.status === 'active';
    if (!confirm(`${isBlock ? 'Block' : 'Unblock'} device ${device.model || device.device_uid}?`)) return;
    try {
      await adminFetch(`devices/${device.id}/${isBlock ? 'block' : 'unblock'}`, { method: 'POST' });
      loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  async function handleAddBlock(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminFetch('blocklist', {
        method: 'POST',
        body: JSON.stringify({ type: blockType, value: blockValue, reason: blockReason }),
      });
      setBlockModal(false);
      setBlockValue('');
      setBlockReason('');
      loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  async function handleDeleteBlock(id: number) {
    if (!confirm('Remove this rule from the blocklist?')) return;
    try {
      await adminFetch(`blocklist/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Devices & Access Blocklist</h1>
          <p style={{ color: 'var(--admin-muted)', fontSize: 13, margin: 0 }}>
            Manage registered Android client hardware IDs and global perimeter firewall rules.
          </p>
        </div>

        {tab === 'blocklist' && (
          <button className="btn-primary" onClick={() => setBlockModal(true)}>
            <Plus size={16} /> Add Block Rule
          </button>
        )}
      </div>

      <form className="surface-card" style={{ padding: 12, display: 'flex', gap: 8 }} onSubmit={(event) => { event.preventDefault(); loadData(); }}>
        <input className="input-field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchDevices')} />
        <button className="btn-primary" type="submit">Search</button>
      </form>
      {suspicious && (
        <div className="surface-card" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>{t('suspicious')}</h2>
          <div>Sign-ups in the last hour: {suspicious.signups_last_hour}</div>
          <ul>
            {suspicious.shared_devices.map((row) => <li key={row.device_uid}>{row.device_uid}: {row.accounts} accounts</li>)}
            {suspicious.failed_ips.map((row) => <li key={row.ip}>{row.ip}: {row.failures} failures</li>)}
          </ul>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className={tab === 'devices' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setTab('devices')}
        >
          <Smartphone size={16} /> Registered Devices
        </button>
        <button
          className={tab === 'blocklist' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setTab('blocklist')}
        >
          <Shield size={16} /> Global Blocklist Rules
        </button>
      </div>

      {/* Content */}
      <div className="surface-card">
        <div className="table-container">
          {tab === 'devices' ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Device Model</th>
                  <th>User Account</th>
                  <th>OS / App Version</th>
                  <th>Hardware UID</th>
                  <th>Status</th>
                  <th>Last Seen</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>Loading devices...</td></tr>
                ) : devices.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>No devices found</td></tr>
                ) : (
                  devices.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>{d.manufacturer ? `${d.manufacturer} ${d.model}` : d.model || 'Generic Android'}</td>
                      <td>{d.user_name ? `${d.user_name} (${d.user_phone})` : `User #${d.user_id}`}</td>
                      <td>{d.platform} {d.os_version} (v{d.app_version || '0.1.0'})</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{d.device_uid.slice(0, 16)}...</td>
                      <td>
                        <span className={`badge ${d.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                          {d.status}
                        </span>
                      </td>
                      <td>{new Date(d.last_seen_at).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => toggleDeviceBlock(d)}
                        >
                          {d.status === 'active' ? 'Block Device' : 'Unblock'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Rule Type</th>
                  <th>Target Value</th>
                  <th>Reason</th>
                  <th>Expires</th>
                  <th>Created At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>Loading blocklist...</td></tr>
                ) : blocklist.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>No active blocklist rules</td></tr>
                ) : (
                  blocklist.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <span className="badge badge-danger">{b.type.toUpperCase()}</span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{b.value}</td>
                      <td>{b.reason || 'Blocked by admin'}</td>
                      <td>{b.expires_at ? new Date(b.expires_at).toLocaleDateString() : 'Permanent'}</td>
                      <td>{new Date(b.created_at).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '4px 8px', color: 'var(--admin-danger)' }}
                          onClick={() => handleDeleteBlock(b.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Block Modal */}
      {blockModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9990,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setBlockModal(false)}
        >
          <div
            className="surface-card"
            style={{ width: '100%', maxWidth: 440, padding: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>Add Security Block Rule</h3>
            <form onSubmit={handleAddBlock} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Rule Type</label>
                <select
                  className="input-field"
                  value={blockType}
                  onChange={(e) => setBlockType(e.target.value as 'phone' | 'device' | 'ip' | 'cidr')}
                >
                  <option value="phone">Phone Number (+880...)</option>
                  <option value="device">Device UID</option>
                  <option value="ip">IP Address</option>
                  <option value="cidr">IP CIDR Subnet Range</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Target Value</label>
                <input
                  type="text"
                  required
                  placeholder="+8801712345678 or 103.20.10.5"
                  className="input-field"
                  value={blockValue}
                  onChange={(e) => setBlockValue(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Fraudulent SMS attempt or abuse"
                  className="input-field"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-secondary" onClick={() => setBlockModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Enforce Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
