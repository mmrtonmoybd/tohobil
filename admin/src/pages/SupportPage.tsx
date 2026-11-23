import { useState, useEffect } from 'react';
import { adminFetch } from '../lib/api';
import { Send } from 'lucide-react';

interface Ticket {
  id: number;
  user_id: number | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  status: 'new' | 'open' | 'waiting' | 'resolved';
  created_at: string;
}

interface TicketReply {
  id: number;
  sender_type: 'admin' | 'user';
  admin_name: string | null;
  message: string;
  created_at: string;
}

export function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Active ticket conversation
  const [activeTicket, setActiveTicket] = useState<{ ticket: Ticket; replies: TicketReply[] } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  async function loadTickets() {
    setLoading(true);
    try {
      const q = statusFilter ? `?status=${statusFilter}` : '';
      const res = await adminFetch<{ data: Ticket[] }>(`support${q}`);
      setTickets(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTickets();
  }, [statusFilter]);

  async function openTicket(id: number) {
    try {
      const res = await adminFetch<{ ticket: Ticket; replies: TicketReply[] }>(`support/${id}`);
      setActiveTicket(res);
      setReplyText('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTicket || !replyText.trim()) return;
    setSending(true);
    try {
      await adminFetch(`support/${activeTicket.ticket.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message: replyText, status: 'waiting' }),
      });
      openTicket(activeTicket.ticket.id);
      loadTickets();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setSending(false);
    }
  }

  async function handleStatusChange(status: string) {
    if (!activeTicket) return;
    try {
      await adminFetch(`support/${activeTicket.ticket.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      openTicket(activeTicket.ticket.id);
      loadTickets();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Customer Support Desk</h1>
          <p style={{ color: 'var(--admin-muted)', fontSize: 13, margin: 0 }}>
            In-app user inquiries, feedback reports, and resolution threads.
          </p>
        </div>

        <select
          className="input-field"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="new">New Inquiries</option>
          <option value="open">Open</option>
          <option value="waiting">Waiting on User</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: activeTicket ? '1fr 1.2fr' : '1fr', gap: 20 }}>
        {/* Tickets Table */}
        <div className="surface-card">
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>User / Contact</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>Loading tickets...</td></tr>
                ) : tickets.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>No tickets found</td></tr>
                ) : (
                  tickets.map((t) => (
                    <tr key={t.id} style={{ background: activeTicket?.ticket.id === t.id ? 'rgba(13, 148, 136, 0.05)' : undefined }}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{t.subject || 'General Inquiry'}</div>
                        <div style={{ fontSize: 12, color: 'var(--admin-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                          {t.message}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13 }}>{t.name || 'Anonymous'}</div>
                        <div style={{ fontSize: 11, color: 'var(--admin-muted)' }}>{t.phone || t.email || 'App user'}</div>
                      </td>
                      <td>
                        <span className={`badge ${t.status === 'new' ? 'badge-danger' : t.status === 'open' ? 'badge-warning' : t.status === 'waiting' ? 'badge-info' : 'badge-success'}`}>
                          {t.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{new Date(t.created_at).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openTicket(t.id)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Conversation Thread */}
        {activeTicket && (
          <div className="surface-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--admin-border)', paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>{activeTicket.ticket.subject || 'General Inquiry'}</h3>
                <span style={{ fontSize: 12, color: 'var(--admin-muted)' }}>
                  From: {activeTicket.ticket.name || 'User'} ({activeTicket.ticket.phone || activeTicket.ticket.email})
                </span>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn-secondary"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  onClick={() => handleStatusChange('resolved')}
                >
                  Mark Resolved
                </button>
                <button
                  className="btn-secondary"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  onClick={() => setActiveTicket(null)}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Conversation Messages */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20, maxHeight: 380, overflowY: 'auto' }}>
              {/* Initial user message */}
              <div style={{ background: 'var(--admin-bg)', padding: 14, borderRadius: 10, alignSelf: 'flex-start', maxWidth: '85%' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-muted)', marginBottom: 4 }}>
                  {activeTicket.ticket.name || 'User'} • {new Date(activeTicket.ticket.created_at).toLocaleString()}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{activeTicket.ticket.message}</div>
              </div>

              {/* Replies */}
              {activeTicket.replies.map((r) => (
                <div
                  key={r.id}
                  style={{
                    background: r.sender_type === 'admin' ? 'linear-gradient(135deg, #0d948815, #6366f115)' : 'var(--admin-bg)',
                    border: r.sender_type === 'admin' ? '1px solid #0d948830' : 'none',
                    padding: 14,
                    borderRadius: 10,
                    alignSelf: r.sender_type === 'admin' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: r.sender_type === 'admin' ? 'var(--admin-primary)' : 'var(--admin-muted)', marginBottom: 4 }}>
                    {r.sender_type === 'admin' ? `Admin (${r.admin_name || 'Support'})` : 'User'} • {new Date(r.created_at).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>{r.message}</div>
                </div>
              ))}
            </div>

            {/* Reply Input Form */}
            <form onSubmit={handleSendReply} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea
                rows={3}
                required
                placeholder="Type your response to the user... (This reply will appear directly in their in-app notification inbox)"
                className="input-field"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={sending} className="btn-primary">
                  <Send size={15} /> {sending ? 'Posting...' : 'Send Official Reply'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
