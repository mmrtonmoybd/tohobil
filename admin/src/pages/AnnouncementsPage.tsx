import React, { useState, useEffect } from 'react';
import { adminFetch } from '../lib/api';
import { Megaphone, Plus, Trash2, Edit2, ExternalLink } from 'lucide-react';

interface Announcement {
  id: number;
  title: string;
  body: string;
  image_url: string | null;
  action_url: string | null;
  target_segment: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: number;
  dismissible: number;
  created_at: string;
}

export function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [segment, setSegment] = useState('all');
  const [isActive, setIsActive] = useState(true);
  const [dismissible, setDismissible] = useState(true);

  async function loadAnnouncements() {
    setLoading(true);
    try {
      const res = await adminFetch<{ data: Announcement[] }>('announcements');
      setItems(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnnouncements();
  }, []);

  function openCreate() {
    setEditingId(null);
    setTitle('');
    setBody('');
    setImageUrl('');
    setActionUrl('');
    setSegment('all');
    setIsActive(true);
    setDismissible(true);
    setModalOpen(true);
  }

  function openEdit(item: Announcement) {
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);
    setImageUrl(item.image_url || '');
    setActionUrl(item.action_url || '');
    setSegment(item.target_segment || 'all');
    setIsActive(Boolean(item.is_active));
    setDismissible(Boolean(item.dismissible));
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        title,
        body,
        image_url: imageUrl || null,
        action_url: actionUrl || null,
        target_segment: segment,
        is_active: isActive ? 1 : 0,
        dismissible: dismissible ? 1 : 0,
      };

      if (editingId) {
        await adminFetch(`announcements/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await adminFetch('announcements', { method: 'POST', body: JSON.stringify(payload) });
      }

      setModalOpen(false);
      loadAnnouncements();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Permanently delete this announcement?')) return;
    try {
      await adminFetch(`announcements/${id}`, { method: 'DELETE' });
      loadAnnouncements();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>In-App Announcements</h1>
          <p style={{ color: 'var(--admin-muted)', fontSize: 13, margin: 0 }}>
            Broadcast news, feature updates, and holiday greetings to the mobile Home screen.
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} /> New Announcement
        </button>
      </div>

      {/* Grid of Announcements */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {loading ? (
          <div style={{ padding: 40, color: 'var(--admin-muted)' }}>Loading announcements...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, color: 'var(--admin-muted)' }}>No announcements created yet.</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="surface-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span className={`badge ${item.is_active ? 'badge-success' : 'badge-warning'}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--admin-muted)' }}>Target: {item.target_segment}</span>
                </div>

                {item.image_url && (
                  <img src={item.image_url} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} />
                )}

                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>{item.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--admin-muted)', margin: '0 0 12px', lineHeight: 1.4 }}>{item.body}</p>

                {item.action_url && (
                  <div style={{ fontSize: 12, color: 'var(--admin-primary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
                    <ExternalLink size={14} /> {item.action_url}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--admin-border)', paddingTop: 12 }}>
                <button className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => openEdit(item)}>
                  <Edit2 size={14} />
                </button>
                <button className="btn-secondary" style={{ padding: '4px 8px', color: 'var(--admin-danger)' }} onClick={() => handleDelete(item.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Modal with Live Mobile Preview */}
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
            style={{ width: '100%', maxWidth: 720, padding: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Editor form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
                {editingId ? 'Edit Announcement' : 'Compose Announcement'}
              </h3>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Headline Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eid Mubarak from Tohobil!"
                  className="input-field"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Announcement Body</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detailed message displayed on the mobile Home feed..."
                  className="input-field"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Action URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://... or tohobil://reports"
                  className="input-field"
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  Active Live
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={dismissible} onChange={(e) => setDismissible(e.target.checked)} />
                  User Dismissible
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingId ? 'Save Changes' : 'Broadcast'}
                </button>
              </div>
            </form>

            {/* Live Mobile Card Preview */}
            <div style={{ background: 'var(--admin-bg)', padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--admin-muted)', marginBottom: 12, textTransform: 'uppercase' }}>
                Live Mobile App Preview
              </div>
              <div
                className="surface-card"
                style={{
                  padding: 16,
                  borderRadius: 14,
                  border: '1px solid var(--admin-primary)',
                  boxShadow: '0 4px 12px rgba(13, 148, 136, 0.1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Megaphone size={16} color="var(--admin-primary)" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--admin-primary)' }}>ANNOUNCEMENT</span>
                </div>
                <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>{title || 'Headline Title'}</h4>
                <p style={{ fontSize: 12, color: 'var(--admin-muted)', margin: '0 0 10px', lineHeight: 1.4 }}>
                  {body || 'Announcement message preview as it appears on user phones.'}
                </p>
                {actionUrl && (
                  <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 11 }}>
                    Learn More
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
