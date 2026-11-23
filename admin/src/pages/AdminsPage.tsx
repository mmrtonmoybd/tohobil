import React, { useState, useEffect } from 'react';
import { adminFetch } from '../lib/api';
import { Plus, Trash2 } from 'lucide-react';
import en from '../i18n/en.json';
import bn from '../i18n/bn.json';

const copy = navigator.language.toLowerCase().startsWith('bn') ? bn : en;

interface AdminAccount {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  is_2fa_enabled: number;
  last_login_at: string | null;
  created_at: string;
}

interface AdminRole {
  id: number;
  name: string;
  slug: string;
  permissions: string[];
}

export function AdminsPage() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // New admin form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [role, setRole] = useState('admin');

  async function loadData() {
    setLoading(true);
    try {
      const res = await adminFetch<{ admins: AdminAccount[]; roles: AdminRole[]; available_permissions: string[] }>('admins');
      setAdmins(res.admins);
      setRoles(res.roles);
      setAvailablePermissions(res.available_permissions);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminFetch('admins', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role, current_password: currentPassword }),
      });
      setModalOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setCurrentPassword('');
      loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  async function handleDelete(id: number, adminEmail: string) {
    if (!confirm(`Permanently revoke and delete admin account ${adminEmail}?`)) return;
    const currentPassword = prompt(copy.reenterPassword);
    if (!currentPassword) return;
    try {
      await adminFetch(`admins/${id}`, { method: 'DELETE', body: JSON.stringify({ current_password: currentPassword }) });
      loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  async function saveRole(slug: string) {
    const currentPassword = prompt(copy.reenterPassword);
    if (!currentPassword) return;
    try {
      await adminFetch(`roles/${slug}`, { method: 'PUT', body: JSON.stringify({ permissions: draftPermissions, current_password: currentPassword }) });
      setEditingRole(null);
      await loadData();
    } catch (e) { alert(e instanceof Error ? e.message : copy.roleSaveFailed); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Staff Accounts & Role Permissions</h1>
          <p style={{ color: 'var(--admin-muted)', fontSize: 13, margin: 0 }}>
            Manage privileged administrator credentials and role-based access control (RBAC).
          </p>
        </div>

        <button className="btn-primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Add Administrator
        </button>
      </div>

      {/* Admins Table */}
      <div className="surface-card">
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Administrator</th>
                <th>Email</th>
                <th>Role</th>
                <th>2FA Security</th>
                <th>Last Login</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>Loading administrators...</td></tr>
              ) : admins.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>No administrators found</td></tr>
              ) : (
                admins.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.name}</td>
                    <td>{a.email}</td>
                    <td>
                      <span className="badge badge-info">{a.role.replace('_', ' ').toUpperCase()}</span>
                    </td>
                    <td>
                      <span className={`badge ${a.is_2fa_enabled ? 'badge-success' : 'badge-warning'}`}>
                        {a.is_2fa_enabled ? 'TOTP 2FA' : 'Standard'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{a.last_login_at ? new Date(a.last_login_at).toLocaleString() : 'Never'}</td>
                    <td>
                      <span className={`badge ${a.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 8px', color: 'var(--admin-danger)' }}
                        onClick={() => handleDelete(a.id, a.email)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Matrix Card */}
      <div className="surface-card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>Predefined Role Access Matrix</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {roles.map((r) => (
            <div key={r.slug} style={{ padding: 14, background: 'var(--admin-bg)', borderRadius: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--admin-primary)', marginBottom: 6 }}>
                {r.name} ({r.slug})
              </div>
              {r.slug !== 'super_admin' && <button type="button" className="btn-secondary" onClick={() => { setEditingRole(editingRole === r.slug ? null : r.slug); setDraftPermissions([...r.permissions]); }} style={{ marginBottom: 8 }}>{editingRole === r.slug ? copy.cancel : copy.editPermissions}</button>}
              {editingRole === r.slug ? <>
                <div style={{ display: 'grid', gap: 7, maxHeight: 280, overflowY: 'auto' }}>
                  {availablePermissions.map((permission) => <label key={permission} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                    <input type="checkbox" checked={draftPermissions.includes(permission)} onChange={(e) => setDraftPermissions((current) => e.target.checked ? [...current, permission] : current.filter((p) => p !== permission))} />{permission}
                  </label>)}
                </div>
                <button type="button" className="btn-primary" onClick={() => saveRole(r.slug)} style={{ marginTop: 12 }}>{copy.savePermissions}</button>
              </> : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {r.permissions.map((p) => (
                  <span key={p} style={{ fontSize: 10, padding: '2px 6px', background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 4 }}>
                    {p}
                  </span>
                ))}
              </div>}
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
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
          onClick={() => setModalOpen(false)}
        >
          <div
            className="surface-card"
            style={{ width: '100%', maxWidth: 440, padding: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>Create Administrator</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Operation Lead"
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="staff@tohobil.app"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{copy.newAdminPassword}</label>
                <input
                  type="password"
                  required
                  minLength={12}
                  placeholder="••••••••••••"
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{copy.reenterPassword}</label>
                <input type="password" required className="input-field" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Assigned Role</label>
                <select className="input-field" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="super_admin">Super Admin (All permissions)</option>
                  <option value="admin">Admin (Operational management)</option>
                  <option value="support">Support (Tickets & FAQ only)</option>
                  <option value="marketing">Marketing (Announcements only)</option>
                  <option value="viewer">Viewer (Read-only)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Provision Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
