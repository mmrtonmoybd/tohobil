import { useState, useEffect } from 'react';
import { adminFetch } from '../lib/api';
import { RefreshCw } from 'lucide-react';

interface StorageData {
  files: {
    total_files: number;
    total_bytes: number;
    by_mime: Array<{ mime_type: string; count: number; size_bytes: number }>;
  };
  disk: {
    free_bytes: number;
    total_bytes: number;
  };
  top_users: Array<{
    user_id: number;
    user_name: string | null;
    user_phone: string | null;
    file_count: number;
    storage_used: number;
  }>;
}

export function StoragePage() {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  function loadStorage() {
    setLoading(true);
    adminFetch<StorageData>('storage')
      .then(setData)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadStorage();
  }, []);

  async function handleCleanup() {
    if (!confirm('Run background storage cleanup scan for orphaned or temporary files?')) return;
    setCleaning(true);
    try {
      await adminFetch('storage/cleanup', { method: 'POST' });
      alert('Storage cleanup scan triggered successfully.');
      loadStorage();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setCleaning(false);
    }
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  if (loading || !data) {
    return <div style={{ padding: 40, color: 'var(--admin-muted)' }}>Loading storage statistics...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Files & Cloud Storage Quotas</h1>
          <p style={{ color: 'var(--admin-muted)', fontSize: 13, margin: 0 }}>
            Inspect disk consumption, media mime breakdowns, and top cloud storage users.
          </p>
        </div>

        <button className="btn-secondary" disabled={cleaning} onClick={handleCleanup}>
          <RefreshCw size={16} /> {cleaning ? 'Scanning...' : 'Run Orphan Cleanup'}
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div className="surface-card" style={{ padding: 20 }}>
          <span style={{ fontSize: 13, color: 'var(--admin-muted)' }}>Total User Files</span>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{data.files.total_files.toLocaleString()}</div>
        </div>
        <div className="surface-card" style={{ padding: 20 }}>
          <span style={{ fontSize: 13, color: 'var(--admin-muted)' }}>Total Storage Used</span>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{formatBytes(data.files.total_bytes)}</div>
        </div>
        <div className="surface-card" style={{ padding: 20 }}>
          <span style={{ fontSize: 13, color: 'var(--admin-muted)' }}>Server Disk Free Space</span>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{formatBytes(data.disk.free_bytes)}</div>
        </div>
      </div>

      {/* MIME Breakdown & Top Users */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Mime Types */}
        <div className="surface-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Media Type Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.files.by_mime.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--admin-muted)' }}>No media stored</div>
            ) : (
              data.files.by_mime.map((m) => (
                <div key={m.mime_type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{m.mime_type}</span>
                    <span style={{ fontSize: 11, color: 'var(--admin-muted)', marginLeft: 8 }}>({m.count} files)</span>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{formatBytes(m.size_bytes)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Users (Privacy strictly enforced: SIZES ONLY!) */}
        <div className="surface-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>Top Storage Consumers</h3>
          <div style={{ fontSize: 11, color: 'var(--admin-muted)', marginBottom: 14 }}>
            Only storage byte totals and file counts are recorded. User receipts and documents remain private.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.top_users.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--admin-muted)' }}>No user files recorded</div>
            ) : (
              data.top_users.map((u) => (
                <div key={u.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--admin-bg)', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{u.user_name || `User #${u.user_id}`}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-muted)' }}>{u.file_count} files</div>
                  </div>
                  <span className="badge badge-info">{formatBytes(u.storage_used)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
