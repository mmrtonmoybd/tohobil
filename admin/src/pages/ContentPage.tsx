import React, { useState, useEffect } from 'react';
import { adminFetch } from '../lib/api';
import { Plus, Edit2, Trash2 } from 'lucide-react';

interface FaqItem {
  id: number;
  category: string;
  title_en: string;
  title_bn: string;
  content_en: string;
  content_bn: string;
  sort_order: number;
  is_published: number;
}

export function ContentPage() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form
  const [category, setCategory] = useState('general');
  const [titleEn, setTitleEn] = useState('');
  const [titleBn, setTitleBn] = useState('');
  const [contentEn, setContentEn] = useState('');
  const [contentBn, setContentBn] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [published, setPublished] = useState(true);

  async function loadFaqs() {
    setLoading(true);
    try {
      const res = await adminFetch<{ data: FaqItem[] }>('content/faq');
      setFaqs(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFaqs();
  }, []);

  function openCreate() {
    setEditingId(null);
    setCategory('general');
    setTitleEn('');
    setTitleBn('');
    setContentEn('');
    setContentBn('');
    setSortOrder(faqs.length + 1);
    setPublished(true);
    setModalOpen(true);
  }

  function openEdit(item: FaqItem) {
    setEditingId(item.id);
    setCategory(item.category);
    setTitleEn(item.title_en);
    setTitleBn(item.title_bn);
    setContentEn(item.content_en);
    setContentBn(item.content_bn);
    setSortOrder(item.sort_order);
    setPublished(Boolean(item.is_published));
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        category,
        title_en: titleEn,
        title_bn: titleBn,
        content_en: contentEn,
        content_bn: contentBn,
        sort_order: sortOrder,
        is_published: published ? 1 : 0,
      };

      if (editingId) {
        await adminFetch(`content/faq/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await adminFetch('content/faq', { method: 'POST', body: JSON.stringify(payload) });
      }

      setModalOpen(false);
      loadFaqs();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this FAQ article?')) return;
    try {
      await adminFetch(`content/faq/${id}`, { method: 'DELETE' });
      loadFaqs();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Bilingual FAQ & Help Content</h1>
          <p style={{ color: 'var(--admin-muted)', fontSize: 13, margin: 0 }}>
            Author and publish knowledgebase articles in English and Bengali for the mobile app.
          </p>
        </div>

        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} /> New Article
        </button>
      </div>

      {/* Articles List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {loading ? (
          <div style={{ padding: 40, color: 'var(--admin-muted)' }}>Loading articles...</div>
        ) : faqs.length === 0 ? (
          <div style={{ padding: 40, color: 'var(--admin-muted)' }}>No FAQ articles found</div>
        ) : (
          faqs.map((item) => (
            <div key={item.id} className="surface-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span className="badge badge-info">{item.category.toUpperCase()}</span>
                  <span className={`badge ${item.is_published ? 'badge-success' : 'badge-warning'}`}>
                    {item.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{item.title_en}</div>
                  <div style={{ fontSize: 13, color: 'var(--admin-primary)', fontWeight: 600 }}>{item.title_bn}</div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--admin-muted)', lineHeight: 1.4, marginBottom: 14 }}>
                  {item.content_en.slice(0, 120)}...
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--admin-border)', paddingTop: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--admin-muted)' }}>Sort order: {item.sort_order}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => openEdit(item)}>
                    <Edit2 size={14} />
                  </button>
                  <button className="btn-secondary" style={{ padding: '4px 8px', color: 'var(--admin-danger)' }} onClick={() => handleDelete(item.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Editor Modal */}
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
            style={{ width: '100%', maxWidth: 640, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>
              {editingId ? 'Edit FAQ Article' : 'Create FAQ Article'}
            </h3>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Category</label>
                  <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="general">General</option>
                    <option value="security">Security & Privacy</option>
                    <option value="backup">Backup & Sync</option>
                    <option value="accounting">Accounting & Dena-Paona</option>
                    <option value="subscription">Billing & Accounts</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Sort Order</label>
                  <input
                    type="number"
                    className="input-field"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Question / Title (English)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. How does offline encryption work?"
                  className="input-field"
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Question / Title (বাংলা)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. অফলাইন এনক্রিপশন কীভাবে কাজ করে?"
                  className="input-field"
                  value={titleBn}
                  onChange={(e) => setTitleBn(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Answer Body (English)</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detailed English explanation..."
                  className="input-field"
                  value={contentEn}
                  onChange={(e) => setContentEn(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Answer Body (বাংলা)</label>
                <textarea
                  rows={3}
                  required
                  placeholder="বাংলায় বিস্তারিত ব্যাখ্যা..."
                  className="input-field"
                  value={contentBn}
                  onChange={(e) => setContentBn(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
                  Publish article immediately
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingId ? 'Save Changes' : 'Publish Article'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
