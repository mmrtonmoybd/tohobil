import React, { useState, useEffect } from 'react';
import { adminDownload, adminFetch } from '../lib/api';
import { t } from '../lib/copy';
import { Search } from 'lucide-react';

interface AuditItem {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_phone: string | null;
  event: string;
  ip: string | null;
  details: string | null;
  created_at: string;
}

export function AuditPage() {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  async function loadAudit() {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        search,
      }).toString();
      const res = await adminFetch<{ data: AuditItem[]; pagination: { total: number } }>(`audit?${q}`);
      setLogs(res.data);
      setTotal(res.pagination.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAudit();
  }, [page]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadAudit();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Administrative Audit Log</h1>
        <p style={{ color: 'var(--admin-muted)', fontSize: 13, margin: 0 }}>
          Immutable record of administrative actions, block operations, configuration updates, and security events.
        </p>
      </div>

      {/* Search */}
      <div className="surface-card" style={{ padding: 16 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} color="var(--admin-muted)" style={{ position: 'absolute', left: 12, top: 11 }} />
            <input
              type="text"
              placeholder="Search by event type, admin name, IP, or affected target..."
              className="input-field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 38 }}
            />
          </div>
          <button type="submit" className="btn-primary">
            Search Audit
          </button>
          <button type="button" className="btn-secondary" onClick={() => adminDownload(`audit?export=csv&search=${encodeURIComponent(search)}`).catch((error: Error) => alert(error.message))}>
            {t('exportCsv')}
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
                <th>Event</th>
                <th>Operator</th>
                <th>IP Address</th>
                <th>Target & Details</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>Loading audit trail...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>No audit records match</td></tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id}>
                    <td>#{l.id}</td>
                    <td>
                      <span className="badge badge-info" style={{ fontFamily: 'monospace' }}>
                        {l.event}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{l.user_name || (l.user_id ? `Admin #${l.user_id}` : 'System')}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{l.ip || '—'}</td>
                    <td style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {l.details || '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>{new Date(l.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--admin-border)' }}>
          <span style={{ fontSize: 13, color: 'var(--admin-muted)' }}>
            Showing {logs.length} of {total} audit records
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ padding: '4px 12px', fontSize: 12 }}>
              Previous
            </button>
            <button className="btn-secondary" disabled={logs.length < 25} onClick={() => setPage(page + 1)} style={{ padding: '4px 12px', fontSize: 12 }}>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
