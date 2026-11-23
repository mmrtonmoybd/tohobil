import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutDashboard, Users, Smartphone, Megaphone, LifeBuoy, HelpCircle, HardDrive, Sliders, Activity, ShieldCheck, UserCheck, Bell, MessageSquare, Shield, Settings } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { t } from '../lib/copy';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const ITEMS = [
  { title: t('navDashboard'), path: '/admin/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { title: t('navUsers'), path: '/admin/users', icon: Users, permission: 'users.view' },
  { title: t('navDevices'), path: '/admin/devices', icon: Smartphone, permission: 'devices.view' },
  { title: t('navPush'), path: '/admin/push', icon: Bell, permission: 'push.view' },
  { title: t('navAnnouncements'), path: '/admin/announcements', icon: Megaphone, permission: 'announcements.manage' },
  { title: t('navSupport'), path: '/admin/support', icon: LifeBuoy, permission: 'support.view' },
  { title: t('navContent'), path: '/admin/content', icon: HelpCircle, permission: 'content.manage' },
  { title: t('navStorage'), path: '/admin/storage', icon: HardDrive, permission: 'files.view' },
  { title: t('navConfig'), path: '/admin/config', icon: Sliders, permission: 'app_config.manage' },
  { title: t('navSms'), path: '/admin/sms', icon: MessageSquare, permission: 'sms.view' },
  { title: t('navSecurity'), path: '/admin/security', icon: Shield, permission: 'security.view' },
  { title: t('navSettings'), path: '/admin/settings', icon: Settings, permission: 'settings.manage' },
  { title: t('navSystem'), path: '/admin/system', icon: Activity, permission: 'system.view' },
  { title: t('navAudit'), path: '/admin/audit', icon: ShieldCheck, permission: 'audit.view' },
  { title: t('navAdmins'), path: '/admin/admins', icon: UserCheck, permission: 'admins.manage' },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = ITEMS.filter((item) =>
    hasPermission(item.permission) && item.title.toLowerCase().includes(query.toLowerCase())
  );

  function handleSelect(path: string) {
    navigate(path);
    onClose();
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
      }}
      onClick={onClose}
    >
      <div
        className="surface-card"
        style={{
          width: '100%',
          maxWidth: 520,
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--admin-border)' }}>
          <Search size={18} color="var(--admin-muted)" style={{ marginRight: 10 }} />
          <input
            autoFocus
            type="text"
            placeholder="Search operations, users, or jump to page... (ESC to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              outline: 'none',
              color: 'var(--admin-text)',
              fontSize: 15,
            }}
          />
        </div>

        <div style={{ maxHeight: 320, overflowY: 'auto', padding: '8px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--admin-muted)', fontSize: 14 }}>
              No matches found
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.path}
                  onClick={() => handleSelect(item.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    gap: 12,
                    fontSize: 14,
                    color: 'var(--admin-text)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Icon size={18} color="var(--admin-primary)" />
                  <span>{item.title}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
