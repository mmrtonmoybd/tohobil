import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Smartphone,
  Megaphone,
  LifeBuoy,
  HelpCircle,
  HardDrive,
  Sliders,
  Activity,
  ShieldCheck,
  UserCheck,
  Bell,
  MessageSquare,
  Shield,
  Settings,
  Menu,
  Moon,
  Sun,
  LogOut,
  Search,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { CommandPalette } from './CommandPalette';
import en from '../i18n/en.json';
import bn from '../i18n/bn.json';

const copy = navigator.language.toLowerCase().startsWith('bn') ? bn : en;

export function Layout() {
  const { admin, logout, hasPermission } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('tohobil_admin_theme') === 'dark' || document.documentElement.dataset.theme === 'dark');

  useEffect(() => {
    if (dark) document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
  }, [dark]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem('tohobil_admin_theme', next ? 'dark' : 'light');
    if (next) {
      document.documentElement.dataset.theme = 'dark';
    } else {
      delete document.documentElement.dataset.theme;
    }
  }

  const navItems = [
    { title: copy.navDashboard, path: '/admin/dashboard', icon: LayoutDashboard, perm: 'dashboard.view' },
    { title: copy.navUsers, path: '/admin/users', icon: Users, perm: 'users.view' },
    { title: copy.navDevices, path: '/admin/devices', icon: Smartphone, perm: 'devices.view' },
    { title: copy.navPush, path: '/admin/push', icon: Bell, perm: 'push.view' },
    { title: copy.navAnnouncements, path: '/admin/announcements', icon: Megaphone, perm: 'announcements.manage' },
    { title: copy.navSupport, path: '/admin/support', icon: LifeBuoy, perm: 'support.view' },
    { title: copy.navContent, path: '/admin/content', icon: HelpCircle, perm: 'content.manage' },
    { title: copy.navStorage, path: '/admin/storage', icon: HardDrive, perm: 'files.view' },
    { title: copy.navConfig, path: '/admin/config', icon: Sliders, perm: 'app_config.manage' },
    { title: copy.navSms, path: '/admin/sms', icon: MessageSquare, perm: 'sms.view' },
    { title: copy.navSecurity, path: '/admin/security', icon: Shield, perm: 'security.view' },
    { title: copy.navSettings, path: '/admin/settings', icon: Settings, perm: 'settings.manage' },
    { title: copy.navSystem, path: '/admin/system', icon: Activity, perm: 'system.view' },
    { title: copy.navAudit, path: '/admin/audit', icon: ShieldCheck, perm: 'audit.view' },
    { title: copy.navAdmins, path: '/admin/admins', icon: UserCheck, perm: 'admins.manage' },
  ].filter((item) => hasPermission(item.perm));

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--admin-bg)' }}>
      {mobileOpen && <button className="admin-sidebar-backdrop" type="button" aria-label={copy.closeMenu} onClick={() => setMobileOpen(false)} />}
      {/* Sidebar */}
      <aside
        className={`admin-sidebar${mobileOpen ? ' admin-sidebar-open' : ''}`}
        style={{
          width: collapsed ? 72 : 240,
          transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          background: 'var(--admin-sidebar-bg)',
          color: 'var(--admin-sidebar-text)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 100,
        }}
      >
        {/* Brand header */}
        <div
          style={{
            height: 64,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <img src="/admin/logo.svg" alt="Tohobil" style={{ width: 32, height: 32, borderRadius: 8 }} />
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: -0.2 }}>Tohobil</div>
              <div style={{ fontSize: 11, color: 'var(--admin-sidebar-muted)' }}>Operations Portal</div>
            </div>
          )}
        </div>

        {/* Navigation list */}
        <nav style={{ flex: 1, padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#ffffff' : 'var(--admin-sidebar-muted)',
                  background: isActive ? 'var(--admin-sidebar-active)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--admin-primary)' : '3px solid transparent',
                  transition: 'background 0.15s, color 0.15s',
                  whiteSpace: 'nowrap',
                })}
              >
                <Icon size={20} />
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div style={{ padding: 12, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: '100%',
              padding: 8,
              background: 'transparent',
              border: 'none',
              color: 'var(--admin-sidebar-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 8,
            }}
          >
            <Menu size={18} />
            {!collapsed && <span style={{ fontSize: 12 }}>Collapse Sidebar</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="admin-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header Bar */}
        <header
          className="admin-header"
          style={{
            height: 64,
            background: 'var(--admin-card)',
            borderBottom: '1px solid var(--admin-border)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 90,
          }}
        >
          <button className="admin-mobile-menu btn-secondary" type="button" aria-label={copy.openMenu} onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          {/* Quick search button (Ctrl+K) */}
          <button
            onClick={() => setPaletteOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'var(--admin-bg)',
              border: '1px solid var(--admin-border)',
              color: 'var(--admin-muted)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <Search size={16} />
            <span>Search or jump to...</span>
            <kbd style={{ padding: '1px 5px', borderRadius: 4, background: 'var(--admin-card)', border: '1px solid var(--admin-border)', fontSize: 11 }}>
              Ctrl+K
            </kbd>
          </button>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={toggleTheme}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--admin-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Toggle Light/Dark Theme"
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Admin identity badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  background: 'linear-gradient(135deg, var(--admin-primary), var(--admin-accent))',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {admin?.name?.charAt(0) || 'A'}
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{admin?.name}</div>
                <span className="badge badge-info" style={{ fontSize: 10, padding: '1px 6px' }}>
                  {admin?.role}
                </span>
              </div>
            </div>

            <button
              onClick={() => logout()}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--admin-danger)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 4,
              }}
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Page body */}
        <main style={{ flex: 1, padding: '24px 32px', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
