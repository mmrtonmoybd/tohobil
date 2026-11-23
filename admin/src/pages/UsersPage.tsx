import { useState, useEffect } from 'react';
import { adminFetch } from '../lib/api';
import { t } from '../lib/copy';
import { Search, ShieldAlert, UserX, UserCheck, RefreshCw, Smartphone } from 'lucide-react';

interface UserItem {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  platform: string;
  status: 'active' | 'disabled' | 'blocked';
  created_at: string;
  last_seen_at: string | null;
}

interface UserDetail {
  user: UserItem;
  devices: Array<{ id: number; model: string; platform: string; os_version: string; last_seen_at: string }>;
  sessions_count: number;
  record_counts: {
    transactions: number;
    debts: number;
    files: number;
    storage_used: number;
  };
}

export function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeUser, setActiveUser] = useState<UserDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        search,
        status,
      }).toString();
      const res = await adminFetch<{ data: UserItem[]; pagination: { total: number } }>(`users?${q}`);
      setUsers(res.data);
      setTotal(res.pagination.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [page, status]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadUsers();
  }

  async function viewDetail(id: number) {
    try {
      const detail = await adminFetch<UserDetail>(`users/${id}`);
      setActiveUser(detail);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to load details');
    }
  }

  async function handleDisable(id: number) {
    const reason = prompt('Enter reason for disabling this user account:');
    if (!reason) return;
    setActionLoading(true);
    try {
      await adminFetch(`users/${id}/disable`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      loadUsers();
      if (activeUser?.user.id === id) viewDetail(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEnable(id: number) {
    if (!confirm('Re-enable this user account?')) return;
    setActionLoading(true);
    try {
      await adminFetch(`users/${id}/enable`, { method: 'POST' });
      loadUsers();
      if (activeUser?.user.id === id) viewDetail(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBlock(id: number) {
    const reason = prompt('CONFIRM PERMANENT BLOCK: Enter reason for blocking user and phone number:');
    if (!reason) return;
    setActionLoading(true);
    try {
      await adminFetch(`users/${id}/block`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      loadUsers();
      if (activeUser?.user.id === id) viewDetail(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setActionLoading(false);
    }
  }

  async function postAction(path: string, body?: unknown) {
    setActionLoading(true);
    try {
      await adminFetch(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
      if (activeUser) viewDetail(activeUser.user.id);
      loadUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRevoke(id: number) {
    if (!confirm('Sign out user from all active devices immediately?')) return;
    try {
      await adminFetch(`users/${id}/revoke-sessions`, { method: 'POST' });
      alert('All user device sessions revoked.');
      if (activeUser?.user.id === id) viewDetail(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Users Directory</h1>
          <p style={{ color: 'var(--admin-muted)', fontSize: 13, margin: 0 }}>
            Search, inspect registered accounts, view device telemetry and access control.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="surface-card" style={{ padding: 16 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
            <Search size={18} color="var(--admin-muted)" style={{ position: 'absolute', left: 12, top: 11 }} />
            <input
              type="text"
              placeholder="Search by name, phone, email, or user ID..."
              className="input-field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 38 }}
            />
          </div>

          <select
            className="input-field"
            style={{ width: 160 }}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="blocked">Blocked</option>
          </select>

          <button type="submit" className="btn-primary">
            Filter
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="surface-card">
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Platform</th>
                <th>Status</th>
                <th>Last Active</th>
                <th>Joined</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--admin-muted)' }}>
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--admin-muted)' }}>
                    No users match your search.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>#{u.id}</td>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>{u.phone}</td>
                    <td>{u.platform || 'Android'}</td>
                    <td>
                      <span className={`badge ${u.status === 'active' ? 'badge-success' : u.status === 'disabled' ? 'badge-warning' : 'badge-danger'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td>{u.last_seen_at ? new Date(u.last_seen_at).toLocaleDateString() : 'Never'}</td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => viewDetail(u.id)}>
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--admin-border)' }}>
          <span style={{ fontSize: 13, color: 'var(--admin-muted)' }}>
            Showing {users.length} of {total} users
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ padding: '4px 12px', fontSize: 12 }}>
              Previous
            </button>
            <button className="btn-secondary" disabled={users.length < 20} onClick={() => setPage(page + 1)} style={{ padding: '4px 12px', fontSize: 12 }}>
              Next
            </button>
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      {activeUser && (
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
          onClick={() => setActiveUser(null)}
        >
          <div
            className="surface-card"
            style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>{activeUser.user.name}</h2>
                <span style={{ color: 'var(--admin-muted)', fontSize: 13 }}>User #{activeUser.user.id} • {activeUser.user.phone}</span>
              </div>
              <span className={`badge ${activeUser.user.status === 'active' ? 'badge-success' : activeUser.user.status === 'disabled' ? 'badge-warning' : 'badge-danger'}`}>
                {activeUser.user.status}
              </span>
            </div>

            {/* Privacy Card */}
            <div style={{ padding: 14, borderRadius: 10, background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--admin-primary)', marginBottom: 6 }}>
                STRICT PRIVACY POLICY:
              </div>
              <div style={{ fontSize: 12, color: 'var(--admin-muted)', lineHeight: 1.4 }}>
                Admins can only see record counts and file storage sizes. Transaction figures, amounts, account numbers, and personal ledger notes are never exposed.
              </div>
            </div>

            {/* Counts Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              <div style={{ padding: 12, background: 'var(--admin-bg)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{activeUser.record_counts.transactions}</div>
                <div style={{ fontSize: 11, color: 'var(--admin-muted)' }}>Transactions</div>
              </div>
              <div style={{ padding: 12, background: 'var(--admin-bg)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{activeUser.record_counts.debts}</div>
                <div style={{ fontSize: 11, color: 'var(--admin-muted)' }}>Debts Tracked</div>
              </div>
              <div style={{ padding: 12, background: 'var(--admin-bg)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{activeUser.record_counts.files}</div>
                <div style={{ fontSize: 11, color: 'var(--admin-muted)' }}>Files Uploaded</div>
              </div>
              <div style={{ padding: 12, background: 'var(--admin-bg)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{(activeUser.record_counts.storage_used / 1024 / 1024).toFixed(1)} MB</div>
                <div style={{ fontSize: 11, color: 'var(--admin-muted)' }}>Cloud Storage</div>
              </div>
            </div>

            {/* Devices List */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Smartphone size={16} /> Registered Devices ({activeUser.devices.length})
              </h4>
              {activeUser.devices.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--admin-muted)' }}>No device registered</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activeUser.devices.map((d) => (
                    <div key={d.id} style={{ padding: '8px 12px', background: 'var(--admin-bg)', borderRadius: 8, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{d.model || 'Unknown Device'} ({d.platform} {d.os_version})</span>
                      <span style={{ color: 'var(--admin-muted)', fontSize: 11 }}>Active: {new Date(d.last_seen_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              <button className="btn-secondary" type="button" disabled={actionLoading} onClick={() => postAction(`users/${activeUser.user.id}/verify-phone`)}>{t('verifyPhone')}</button>
              <button className="btn-secondary" type="button" disabled={actionLoading} onClick={() => {
                const name = prompt(t('saveProfile'), activeUser.user.name);
                if (!name) return;
                adminFetch(`users/${activeUser.user.id}`, { method: 'PUT', body: JSON.stringify({ name }) })
                  .then(() => viewDetail(activeUser.user.id))
                  .catch((e) => alert(e instanceof Error ? e.message : 'Error'));
              }}>{t('saveProfile')}</button>
              <button className="btn-secondary" type="button" disabled={actionLoading} onClick={() => {
                const quota = prompt(t('setQuota'), '1024');
                if (quota !== null) postAction(`users/${activeUser.user.id}/quota`, { quota_mb: Number(quota) });
              }}>{t('setQuota')}</button>
              <button className="btn-secondary" type="button" disabled={actionLoading} onClick={() => {
                const note = prompt(t('addNote'));
                if (note) postAction(`users/${activeUser.user.id}/notes`, { note });
              }}>{t('addNote')}</button>
              <button className="btn-secondary" type="button" disabled={actionLoading} onClick={() => {
                const current_password = prompt(t('reenterPassword'));
                if (current_password && confirm(t('deleteUserHelp'))) {
                  adminFetch(`users/${activeUser.user.id}`, { method: 'DELETE', body: JSON.stringify({ current_password }) })
                    .then(() => viewDetail(activeUser.user.id))
                    .catch((e) => alert(e instanceof Error ? e.message : 'Error'));
                }
              }}>{t('deleteUser')}</button>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--admin-muted)' }}>{t('deleteUserHelp')}</p>
            </div>

            {/* Administrative Actions */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--admin-border)', paddingTop: 20 }}>
              {activeUser.user.status === 'active' ? (
                <button className="btn-secondary" disabled={actionLoading} onClick={() => handleDisable(activeUser.user.id)}>
                  <UserX size={16} color="var(--admin-warning)" /> Suspend Account
                </button>
              ) : (
                <button className="btn-secondary" disabled={actionLoading} onClick={() => handleEnable(activeUser.user.id)}>
                  <UserCheck size={16} color="var(--admin-success)" /> Enable Account
                </button>
              )}

              {activeUser.user.status !== 'blocked' && (
                <button className="btn-secondary" disabled={actionLoading} onClick={() => handleBlock(activeUser.user.id)}>
                  <ShieldAlert size={16} color="var(--admin-danger)" /> Block & Ban Phone
                </button>
              )}

              <button className="btn-secondary" disabled={actionLoading} onClick={() => handleRevoke(activeUser.user.id)}>
                <RefreshCw size={16} /> Sign Out All Devices
              </button>

              <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setActiveUser(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
