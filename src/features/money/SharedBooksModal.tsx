import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../app/identity';
import { normalizePhone } from '../../lib/phone';
import type { Book } from '../../db/types';

export interface BookMember {
  id: string;
  user_id: number;
  role: 'owner' | 'editor' | 'viewer';
  name: string;
  phone: string;
  is_you: boolean;
}

export function SharedBooksModal({
  open,
  onClose,
  book,
}: {
  open: boolean;
  onClose: () => void;
  book: Book | null;
}) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<BookMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!book) return;
    setLoading(true);
    try {
      const res = await api<{ members: BookMember[] }>(`books/${book.id}/members`);
      setMembers(res.members || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [book]);

  useEffect(() => {
    if (open && book) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchMembers();
      setMessage(null);
      setInvitePhone('');
    }
  }, [open, book, fetchMembers]);

  if (!open || !book) return null;

  const currentMember = members.find((m) => m.is_you);
  const isOwner = currentMember?.role === 'owner' || members.length === 0;

  const handleSendInvite = async () => {
    setMessage(null);
    const parsed = normalizePhone(invitePhone, 'BD');
    if (!parsed || !parsed.isValid) {
      setMessage({ type: 'error', text: t('sharedBooks.invalidPhone') });
      return;
    }

    setInviting(true);
    try {
      await api(`books/${book.id}/invite`, {
        method: 'POST',
        body: JSON.stringify({
          phone: parsed.e164,
          role: inviteRole,
          book_name: book.name,
        }),
      });
      setMessage({ type: 'success', text: t('sharedBooks.inviteSent') });
      setInvitePhone('');
      void fetchMembers();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : t('sharedBooks.inviteFailed');
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!confirm(t('sharedBooks.confirmRemove'))) return;
    try {
      await api(`books/${book.id}/members/${userId}`, {
        method: 'DELETE',
      });
      void fetchMembers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="surface-card"
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: 20,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              {t('sharedBooks.title')}
            </h2>
            <small style={{ color: 'var(--app-muted)' }}>{book.name}</small>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={t('a11y.close')}
          >
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        {message && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: '0.9rem',
              background: message.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(20, 184, 166, 0.15)',
              color: message.type === 'error' ? '#ef4444' : '#14b8a6',
            }}
          >
            {message.text}
          </div>
        )}

        {/* Invite section (Owner only) */}
        {isOwner && (
          <div
            style={{
              padding: 16,
              borderRadius: 14,
              border: '1px solid var(--app-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <strong style={{ fontSize: '0.95rem' }}>{t('sharedBooks.inviteMember')}</strong>
            <input
              type="tel"
              className="text-input"
              placeholder={t('sharedBooks.phonePlaceholder')}
              value={invitePhone}
              onChange={(e) => setInvitePhone(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select
                className="text-input"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                style={{ flex: 1 }}
              >
                <option value="editor">{t('sharedBooks.roleEditor')}</option>
                <option value="viewer">{t('sharedBooks.roleViewer')}</option>
              </select>
              <button
                type="button"
                className="primary-button"
                onClick={handleSendInvite}
                disabled={inviting || !invitePhone.trim()}
                style={{ whiteSpace: 'nowrap' }}
              >
                {inviting ? t('common.loading') : t('sharedBooks.sendInvite')}
              </button>
            </div>
          </div>
        )}

        {/* Members list */}
        <div>
          <strong style={{ fontSize: '0.95rem', display: 'block', marginBottom: 8 }}>
            {t('sharedBooks.currentMembers')} ({members.length})
          </strong>

          {loading ? (
            <p style={{ color: 'var(--app-muted)', fontSize: '0.9rem' }}>{t('common.loading')}</p>
          ) : members.length === 0 ? (
            <p style={{ color: 'var(--app-muted)', fontSize: '0.9rem' }}>
              {t('sharedBooks.noMembers')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.map((m) => (
                <div
                  key={m.id || m.user_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'var(--app-surface-variant, rgba(255,255,255,0.05))',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong style={{ fontSize: '0.9rem' }}>{m.name}</strong>
                      {m.is_you && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '2px 6px',
                            borderRadius: 6,
                            background: '#14b8a620',
                            color: '#14b8a6',
                          }}
                        >
                          {t('sharedBooks.you')}
                        </span>
                      )}
                    </div>
                    <small style={{ color: 'var(--app-muted)', fontSize: '0.8rem' }}>
                      {m.phone}
                    </small>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        padding: '4px 8px',
                        borderRadius: 8,
                        background:
                          m.role === 'owner'
                            ? '#6366f120'
                            : m.role === 'editor'
                            ? '#14b8a620'
                            : '#9ca3af20',
                        color:
                          m.role === 'owner'
                            ? '#6366f1'
                            : m.role === 'editor'
                            ? '#14b8a6'
                            : '#9ca3af',
                      }}
                    >
                      {t(`sharedBooks.role_${m.role}`)}
                    </span>

                    {isOwner && m.role !== 'owner' && (
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => handleRemoveMember(m.user_id)}
                        aria-label={t('sharedBooks.remove')}
                        title={t('sharedBooks.remove')}
                        style={{ color: '#ef4444' }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
                          person_remove
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
