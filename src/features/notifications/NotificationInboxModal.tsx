import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../app/identity';

export interface InboxItem {
  id: number | string;
  campaign_id?: number | null;
  type: string;
  title: string;
  body: string;
  image_url?: string | null;
  action_type?: string | null;
  action_value?: string | null;
  is_read: number | boolean;
  created_at: string;
}

interface NotificationInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadChange?: (unreadCount: number) => void;
}

export function NotificationInboxModal({
  isOpen,
  onClose,
  onUnreadChange,
}: NotificationInboxModalProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api<{
        data: InboxItem[];
        support?: InboxItem[];
        unread_count: number;
      }>('notifications');

      const all = [...(res.support || []), ...(res.data || [])];
      setItems(all);
      const count = res.unread_count ?? 0;
      setUnreadCount(count);
      onUnreadChange?.(count);
    } catch {
      // Fallback for offline or connection failure
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const markAllAsRead = async () => {
    try {
      await api('notifications/read', {
        method: 'POST',
        body: JSON.stringify({ all: true }),
      });
      setItems((prev) => prev.map((item) => ({ ...item, is_read: 1 })));
      setUnreadCount(0);
      onUnreadChange?.(0);
    } catch {
      // ignore
    }
  };

  const markOneAsRead = async (id: number | string) => {
    if (typeof id === 'number') {
      try {
        await api('notifications/read', {
          method: 'POST',
          body: JSON.stringify({ id }),
        });
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, is_read: 1 } : item)),
        );
        const wasUnread = items.some((item) => item.id === id && !item.is_read);
        const newCount = Math.max(0, unreadCount - (wasUnread ? 1 : 0));
        setUnreadCount(newCount);
        onUnreadChange?.(newCount);
      } catch {
        // ignore
      }
    }
  };

  const deleteNotification = async (id: number | string) => {
    if (typeof id === 'number') {
      try {
        await api(`notifications/${id}`, { method: 'DELETE' });
        setItems((prev) => prev.filter((item) => item.id !== id));
        if (items.some((item) => item.id === id && !item.is_read)) {
          const newCount = Math.max(0, unreadCount - 1);
          setUnreadCount(newCount);
          onUnreadChange?.(newCount);
        }
      } catch {
        // ignore
      }
    } else {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet-container"
        style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sheet-handle" />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid var(--app-border, rgba(0,0,0,0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-rounded" style={{ color: 'var(--app-brand, #14b8a6)' }}>
              notifications
            </span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {t('notifications.inboxTitle')}
            </h2>
            {unreadCount > 0 && (
              <span
                style={{
                  background: 'var(--app-danger, #ef4444)',
                  color: '#fff',
                  borderRadius: 12,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--app-brand, #14b8a6)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('notifications.markAllRead')}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span className="material-symbols-rounded">close</span>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading && items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--app-muted)' }}>
              <p>{t('common.loading')}</p>
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--app-muted)' }}>
              <span
                className="material-symbols-rounded"
                style={{ fontSize: 48, opacity: 0.4, marginBottom: 12, display: 'block' }}
              >
                notifications_off
              </span>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                {t('notifications.inboxEmpty')}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                {t('notifications.inboxEmptySubtitle')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map((item) => {
                const isUnread = !item.is_read;
                const icon =
                  item.type === 'support_reply'
                    ? 'support_agent'
                    : item.type === 'security_alert'
                      ? 'shield'
                      : 'campaign';

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      void markOneAsRead(item.id);
                      if (item.action_type) {
                        onClose();
                        window.dispatchEvent(new CustomEvent('tohobil:push-open', { detail: {
                          campaign_id: item.campaign_id ? String(item.campaign_id) : undefined,
                          title: item.title, body: item.body,
                          action_type: item.action_type, action_value: item.action_value,
                        } }));
                      }
                    }}
                    onTouchStart={(event) => {
                      touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
                    }}
                    onTouchEnd={(event) => {
                      const start = touchStart.current;
                      touchStart.current = null;
                      if (!start) return;
                      const dx = event.changedTouches[0].clientX - start.x;
                      const dy = event.changedTouches[0].clientY - start.y;
                      if (dx < -80 && Math.abs(dy) < 40) {
                        event.preventDefault();
                        void deleteNotification(item.id);
                      }
                    }}
                    style={{
                      background: isUnread
                        ? 'var(--app-card-bg, #f8fafc)'
                        : 'var(--app-surface, #ffffff)',
                      border: isUnread
                        ? '1px solid var(--app-brand, #14b8a6)'
                        : '1px solid var(--app-border, rgba(0,0,0,0.06))',
                      borderRadius: 14,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span
                        className="material-symbols-rounded"
                        style={{
                          fontSize: 22,
                          color: isUnread ? 'var(--app-brand, #14b8a6)' : 'var(--app-muted)',
                        }}
                      >
                        {icon}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: isUnread ? 700 : 600,
                            fontSize: 15,
                            color: 'var(--app-text, #1e293b)',
                          }}
                        >
                          {item.title}
                        </div>
                        <p
                          style={{
                            margin: '4px 0 0',
                            fontSize: 13,
                            color: 'var(--app-muted, #64748b)',
                            lineHeight: 1.4,
                          }}
                        >
                          {item.body}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteNotification(item.id);
                        }}
                        aria-label={t('common.delete')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--app-muted)',
                          cursor: 'pointer',
                          padding: 2,
                        }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
                          delete
                        </span>
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 11,
                        color: 'var(--app-muted)',
                        paddingTop: 4,
                      }}
                    >
                      <span>
                        {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                      </span>
                      {isUnread && (
                        <span
                          style={{
                            color: 'var(--app-brand, #14b8a6)',
                            fontWeight: 600,
                          }}
                        >
                          {t('notifications.unread')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
