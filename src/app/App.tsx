import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  Navigate,
  Route,
  useNavigate,
  useLocation,
  useParams,
} from 'react-router-dom';
import {
  IonAlert,
  IonApp,
  IonButton,
  IonContent,
  IonHeader,
  IonModal,
  IonPage,
  IonRouterOutlet,
  IonSpinner,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonTitle,
  IonToast,
  IonToolbar,
  setupIonicReact,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useTranslation } from 'react-i18next';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { api, ApiError, clearToken, getApiBaseUrl, isAccessCode, registerDevice, saveToken, token, type AccessCode, type User } from './identity';
import { AccessScreen, IdentityScreens, ProfileScreen } from './IdentityScreens';
import { updateSystemBars } from './systemBars';
import { MoneyHome } from '../features/money/MoneyHome';
import { TransactionsScreen } from '../features/money/TransactionsScreen';
import { ManageScreen } from '../features/money/ManageScreen';
import { QuickAdd } from '../features/money/QuickAdd';
import { RestoringScreen } from '../sync/RestoringScreen';
import { syncEngine } from '../sync/engine';
import { uploadQueue } from '../sync/uploadQueue';
import { alignEmptyBookCurrency, migrateLocalUser, processDueRecurringRules, setCurrentUserId, wipeLocalData } from '../db/repository';
import { DocumentVaultScreen } from '../features/vault/DocumentVaultScreen';
import { StorageSettingsScreen } from '../features/settings/StorageSettingsScreen';
import { BillsScreen } from '../features/planning/BillsScreen';
import { BudgetsScreen } from '../features/planning/BudgetsScreen';
import { GoalsScreen } from '../features/planning/GoalsScreen';
import { AssetsScreen } from '../features/wealth/AssetsScreen';
import { ReportsScreen } from '../features/reports/ReportsScreen';
import { ToolsScreen } from '../features/tools/ToolsScreen';
import { SecuritySettingsScreen } from '../features/settings/SecuritySettingsScreen';
import { NotificationSettingsScreen } from '../features/settings/NotificationSettingsScreen';
import { BackupDataSettingsScreen } from '../features/settings/BackupDataSettingsScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { AppLockOverlay } from '../features/security/AppLockOverlay';
import { InAppReviewModal } from '../features/polish/InAppReviewModal';
import { InAppUpdateBanner } from '../features/polish/InAppUpdateBanner';
import { syncFeatureFlags } from '../lib/featureFlags';
import {
  recordPositiveMoment,
  getReviewState,
  type PositiveMoment,
} from '../lib/inAppReview';
import {
  handleAppPause,
  handleAppResume,
  applyPrivacyScreen,
  getSecuritySettings,
} from '../lib/security';
import { setupNotificationChannels } from '../lib/notifications';
import { flushPushOpenQueue, refreshPushRegistration, removePushToken, startPushListeners, trackPushOpened, type PushPayload } from '../lib/push';
const DebtsScreen = lazy(() =>
  import('../features/debts/DebtsScreen').then((module) => ({
    default: module.DebtsScreen,
  })),
);
import { useMoney } from '../features/money/store';
setupIonicReact({
  mode: Capacitor.getPlatform() === 'ios' ? 'ios' : 'md',
  rippleEffect: true,
});
type Accent = 'teal' | 'ocean' | 'violet' | 'sunset' | 'forest';
type Theme = 'system' | 'light' | 'dark';
const moreItems = [
  ['profile', 'person', '#14b8a6'],
  ['reports', 'monitoring', '#0ea5e9'],
  ['accounts', 'account_balance_wallet', '#14b8a6'],
  ['budgets', 'donut_large', '#f97316'],
  ['goals', 'flag', '#ec4899'],
  ['bills', 'event_repeat', '#f97316'],
  ['assets', 'trending_up', '#6366f1'],
  ['documents', 'description', '#64748b'],
  ['people', 'group', '#0ea5e9'],
  ['tools', 'calculate', '#8b5cf6'],
  ['categories', 'category', '#22c55e'],
  ['books', 'menu_book', '#f59e0b'],
  ['sync', 'cloud_sync', '#14b8a6'],
  ['storage', 'folder_open', '#6366f1'],
  ['security', 'security', '#6366f1'],
  ['notifications', 'notifications', '#10b981'],
  ['backup', 'cloud_sync', '#14b8a6'],
  ['settings', 'settings', '#64748b'],
] as const;
const moreGroups = [
  { title: 'groupEveryday', keys: ['accounts', 'people', 'budgets', 'goals', 'bills', 'reports'] },
  { title: 'groupExtra', keys: ['tools', 'assets', 'documents', 'categories', 'books'] },
  { title: 'groupPhone', keys: ['profile', 'settings'] },
] as const;
function PageHeader({
  title,
  back = false,
}: {
  title: string;
  back?: boolean;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <IonHeader>
      <IonToolbar>
        {back && (
          <IonButton
            slot="start"
            fill="clear"
            aria-label={t('a11y.back')}
            onClick={() => navigate(-1)}
          >
            <span className="material-symbols-rounded">arrow_back</span>
          </IonButton>
        )}
        <IonTitle>{title}</IonTitle>
      </IonToolbar>
    </IonHeader>
  );
}
function Home({
  onAdd,
  onAccounts,
  onDebts,
  user,
}: {
  onAdd: () => void;
  onAccounts: () => void;
  onDebts: (id?: string) => void;
  user: User;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('appName')}</IonTitle>
          <IonButton
            slot="end"
            fill="clear"
            aria-label={t('identity.profile')}
            onClick={() => navigate('/tabs/more/profile')}
            className="home-avatar-btn"
          >
            {user.photo_path ? (
              <img
                src={`${getApiBaseUrl()}/api/v1/me/avatar`}
                alt={user.name}
                className="home-avatar-img"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <span className="home-avatar-circle">
                {user.name ? user.name.charAt(0).toUpperCase() : 'T'}
              </span>
            )}
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="shell-content">
        <MoneyHome onAdd={onAdd} onAccounts={onAccounts} onDebts={onDebts} />
      </IonContent>
      <button
        className="fab-add"
        onClick={onAdd}
        aria-label={t('a11y.openAdd')}
      >
        <span className="material-symbols-rounded">add</span>
        {t('tabs.add')}
      </button>
    </IonPage>
  );
}
function TransactionsPage({
  onAdd,
  onEdit,
  onDebt,
  onToast,
}: {
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDebt: (id: string) => void;
  onToast: (message: string, undo?: () => void) => void;
}) {
  const { t } = useTranslation();
  return (
    <IonPage>
      <PageHeader title={t('tabs.transactions')} />
      <IonContent className="shell-content">
        <TransactionsScreen
          onAdd={onAdd}
          onEdit={onEdit}
          onDebt={onDebt}
          onToast={onToast}
        />
      </IonContent>
    </IonPage>
  );
}
function DebtsPage({ onToast }: { onToast: (message: string) => void }) {
  const { t } = useTranslation();
  return (
    <IonPage>
      <PageHeader title={t('debts.title')} />
      <IonContent className="shell-content">
        <Suspense fallback={null}>
          <DebtsScreen onToast={onToast} />
        </Suspense>
      </IonContent>
    </IonPage>
  );
}
function More() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <IonPage>
      <PageHeader title={t('tabs.more')} />
      <IonContent className="shell-content">
        <div className="page-pad">
          <p className="eyebrow">{t('more.subtitle')}</p>
          <h1 className="page-heading">{t('more.title')}</h1>
          {moreGroups.map((group) => (
            <section key={group.title} className="more-section">
              <h2 className="settings-label">{t(`more.${group.title}`)}</h2>
              <div className="more-grid">
                {group.keys.map((key) => {
                  const entry = moreItems.find(([item]) => item === key);
                  if (!entry) return null;
                  const [, icon, color] = entry;
                  return (
                    <button
                      key={key}
                      className="more-tile"
                      onClick={() => navigate(`/tabs/more/${key}`)}
                    >
                      <span
                        className="tile-icon"
                        style={{ background: `${color}20`, color }}
                      >
                        <span className="material-symbols-rounded">{icon}</span>
                      </span>
                      <span className="tile-label">{t(`more.${key}`)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </IonContent>
    </IonPage>
  );
}
function Detail({
  item,
  theme,
  setTheme,
  accent,
  setAccent,
  onToast,
  user,
  onUpdate,
  onLogout,
}: {
  item: string;
  theme: Theme;
  setTheme: (v: Theme) => void;
  accent: Accent;
  setAccent: (v: Accent) => void;
  onToast: (message: string) => void;
  user: User;
  onUpdate: (user: User) => void;
  onLogout: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const entry = moreItems.find(([key]) => key === item);
  if (!entry) return <Navigate to="/tabs/more" />;
  const [, icon, color] = entry;
  const label = t(`more.${item}`);
  if (item === 'profile') return <ProfileScreen user={user} onUpdate={onUpdate} onLogout={onLogout} />;
  if (item === 'sync' || item === 'backup') return <BackupDataSettingsScreen onToast={onToast} onBack={() => navigate('/tabs/more/settings')} />;
  if (item === 'security') return <SecuritySettingsScreen user={user} onLogout={onLogout} onToast={onToast} onBack={() => navigate('/tabs/more/settings')} />;
  if (item === 'notifications') return <NotificationSettingsScreen onToast={onToast} onBack={() => navigate('/tabs/more/settings')} />;
  if (item === 'documents') return <DocumentVaultScreen onToast={onToast} />;
  if (item === 'storage') return <StorageSettingsScreen onToast={onToast} />;
  if (item === 'bills') return <BillsScreen onToast={onToast} />;
  if (item === 'budgets') return <BudgetsScreen onToast={onToast} />;
  if (item === 'goals') return <GoalsScreen onToast={onToast} />;
  if (item === 'assets') return <AssetsScreen onToast={onToast} />;
  if (item === 'reports') return <ReportsScreen onToast={onToast} />;
  if (item === 'tools') return <ToolsScreen onToast={onToast} />;
  if (item === 'settings') return <SettingsScreen theme={theme} setTheme={setTheme} accent={accent} setAccent={setAccent} user={user} onToast={onToast} onLogout={onLogout} />;
  return (
    <IonPage>
      <PageHeader title={label} back />
      <IonContent className="shell-content">
        <div className="page-pad">
          {item === 'people' ? (
            <Suspense fallback={null}>
              <DebtsScreen onToast={onToast} />
            </Suspense>
          ) : item === 'accounts' ||
            item === 'books' ||
            item === 'categories' ? (
            <ManageScreen kind={item} onToast={onToast} />
          ) : (
            <div className="surface-card empty-state">
              <div
                className="feature-illustration"
                style={{ background: `${color}20`, color }}
              >
                <span className="material-symbols-rounded">{icon}</span>
              </div>
              <h2>{t('feature.coming')}</h2>
              <p>{t('feature.description')}</p>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
function DetailRoute({
  theme,
  setTheme,
  accent,
  setAccent,
  onToast,
  user,
  onUpdate,
  onLogout,
}: {
  theme: Theme;
  setTheme: (v: Theme) => void;
  accent: Accent;
  setAccent: (v: Accent) => void;
  onToast: (message: string) => void;
  user: User;
  onUpdate: (user: User) => void;
  onLogout: () => void;
}) {
  const { item } = useParams();
  return (
    <Detail
      item={item ?? ''}
      theme={theme}
      setTheme={setTheme}
      accent={accent}
      setAccent={setAccent}
      onToast={onToast}
      user={user}
      onUpdate={onUpdate}
      onLogout={onLogout}
    />
  );
}
function Shell({user,onUpdate,onLogout}:{user:User;onUpdate:(user:User)=>void;onLogout:()=>void}) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [quickAdd, setQuickAdd] = useState(false);
  const [pushBanner, setPushBanner] = useState<PushPayload | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [undo, setUndo] = useState<(() => void) | null>(null);
  const showToast = (text: string, action?: () => void) => {
    setMessage(text);
    setUndo(() => action ?? null);
  };
  const openPush = useCallback((payload: PushPayload) => {
    void trackPushOpened(payload.campaign_id ? Number(payload.campaign_id) : undefined);
    if (payload.action_type === 'screen' && payload.action_value?.startsWith('tohobil://')) {
      const screen = payload.action_value.slice('tohobil://'.length).split('?')[0];
      navigate(screen === 'home' ? '/tabs/home' : `/tabs/more/${encodeURIComponent(screen)}`);
    } else if (payload.action_type === 'url' && payload.action_value?.startsWith('https://')) {
      window.open(payload.action_value, '_blank', 'noopener,noreferrer');
    }
    setPushBanner(null);
  }, [navigate]);
  useEffect(() => {
    const received = (event: Event) => setPushBanner((event as CustomEvent<PushPayload>).detail);
    const opened = (event: Event) => openPush((event as CustomEvent<PushPayload>).detail);
    window.addEventListener('tohobil:push', received);
    window.addEventListener('tohobil:push-open', opened);
    return () => { window.removeEventListener('tohobil:push', received); window.removeEventListener('tohobil:push-open', opened); };
  }, [openPush]);
  const initializeMoney = useMoney((s) => s.initialize);
  useEffect(() => {
    void initializeMoney().catch(() => {});
  }, [initializeMoney]);
  const [exitHint, setExitHint] = useState(false);
  const [theme, setThemeState] = useState<Theme>(() => {
    const v = localStorage.getItem('tohobil.theme');
    return v === 'dark' || v === 'light' ? v : 'system';
  });
  const [accent, setAccentState] = useState<Accent>(() => {
    const v = localStorage.getItem('tohobil.accent');
    return (
      ['teal', 'ocean', 'violet', 'sunset', 'forest'] as string[]
    ).includes(v ?? '')
      ? (v as Accent)
      : 'teal';
  });
  const setTheme = (value: Theme) => {
    setThemeState(value);
    localStorage.setItem('tohobil.theme', value);
  };
  const setAccent = (value: Accent) => {
    setAccentState(value);
    localStorage.setItem('tohobil.accent', value);
  };
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = accent;
    const dark =
      theme === 'dark' ||
      (theme === 'system' &&
        matchMedia('(prefers-color-scheme: dark)').matches);
    if (Capacitor.isNativePlatform()) {
      void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
      void StatusBar.setBackgroundColor({
        color: dark ? '#0B1120' : '#F3F6FB',
      });
      void updateSystemBars(dark);
    }
  }, [theme, accent]);
  useEffect(() => {
    const bId = useMoney.getState().bookId;
    if (bId) {
      void processDueRecurringRules(bId);
    }
    void setupNotificationChannels();
    const sec = getSecuritySettings();
    if (sec.privacyScreenEnabled) {
      void applyPrivacyScreen(true);
    }
    const stateSub = CapacitorApp.addListener('appStateChange', (state) => {
      if (state.isActive) {
        handleAppResume();
      } else {
        handleAppPause();
      }
    });
    // Deep links from Android launcher shortcuts (e.g. tohobil://add?type=expense, tohobil://add?action=proof)
    const urlSub = CapacitorApp.addListener('appUrlOpen', (data) => {
      if (data.url.startsWith('tohobil://')) {
        const target = new URL(data.url);
        const campaign = target.searchParams.get('campaign');
        if (campaign && /^\d+$/.test(campaign)) void trackPushOpened(Number(campaign));
        if (target.hostname === 'open') {
          const url = target.searchParams.get('url');
          if (url?.startsWith('https://')) window.open(url, '_blank', 'noopener,noreferrer');
          return;
        }
        if (target.hostname !== 'add' && target.hostname !== 'home') {
          navigate(`/tabs/more/${encodeURIComponent(target.hostname)}`);
          return;
        }
        if (target.hostname === 'home') { navigate('/tabs/home'); return; }
      }
      if (data.url.includes('tohobil://add?action=proof')) {
        navigate('/tabs/more/documents');
      } else if (data.url.includes('tohobil://add')) {
        setQuickAdd(true);
      }
    });
    // Positive moments listener for in-app review prompt (SPEC: after positive moments, never in first week)
    const handlePositive = (e: Event) => {
      const detail = (e as CustomEvent<PositiveMoment>).detail;
      if (recordPositiveMoment(detail)) {
        setReviewOpen(true);
      }
    };
    window.addEventListener('tohobil:positive-moment', handlePositive);
    // Prompt if 30 days active
    const promptTimer = setTimeout(() => {
      const installed = getReviewState().installedAt;
      if (Date.now() - installed >= 30 * 86400 * 1000) {
        if (recordPositiveMoment('goal_reached')) {
          setReviewOpen(true);
        }
      }
    }, 500);

    return () => {
      clearTimeout(promptTimer);
      void stateSub.then((s) => s.remove());
      void urlSub.then((s) => s.remove());
      window.removeEventListener('tohobil:positive-moment', handlePositive);
    };
  }, [navigate]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let lastBack = 0;
    let listener: { remove: () => Promise<void> } | undefined;
    void CapacitorApp.addListener('backButton', () => {
      if (quickAdd) {
        setQuickAdd(false);
        return;
      }
      if (location.pathname.startsWith('/tabs/more/')) {
        navigate(-1);
        return;
      }
      if (location.pathname !== '/tabs/home') {
        navigate('/tabs/home');
        return;
      }
      const now = Date.now();
      if (now - lastBack < 2000) {
        void CapacitorApp.exitApp();
        return;
      }
      lastBack = now;
      setExitHint(true);
    }).then((v) => {
      listener = v;
    });
    return () => {
      void listener?.remove();
    };
  }, [quickAdd, location.pathname, navigate]);
  const openAdd = () => {
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    setEditId(null);
    setQuickAdd(true);
  };
  const editTransaction = (id: string) => {
    setEditId(id);
    setQuickAdd(true);
  };
  return (
    <>
      <IonTabs>
        <IonRouterOutlet>
          <Route
            path="/tabs/home"
            element={
              <Home
                onAdd={openAdd}
                onAccounts={() => navigate('/tabs/more/accounts')}
                onDebts={(id) =>
                  navigate(
                    id
                      ? `/tabs/debts?debt=${encodeURIComponent(id)}`
                      : '/tabs/debts',
                  )
                }
                user={user}
              />
            }
          />
          <Route
            path="/tabs/transactions"
            element={
              <TransactionsPage
                onAdd={openAdd}
                onEdit={editTransaction}
                onDebt={(id) =>
                  navigate(`/tabs/debts?debt=${encodeURIComponent(id)}`)
                }
                onToast={showToast}
              />
            }
          />
          <Route
            path="/tabs/debts"
            element={<DebtsPage onToast={showToast} />}
          />
          <Route path="/tabs/more" element={<More />} />
          <Route
            path="/tabs/more/:item"
            element={
              <DetailRoute
                theme={theme}
                setTheme={setTheme}
                accent={accent}
                setAccent={setAccent}
                onToast={showToast}
                user={user}
                onUpdate={onUpdate}
                onLogout={onLogout}
              />
            }
          />
          <Route path="/" element={<Navigate to="/tabs/home" replace />} />
        </IonRouterOutlet>
        <IonTabBar slot="bottom">
          <IonTabButton tab="home" href="/tabs/home">
            <span className="material-symbols-rounded">home</span>
            <span>{t('tabs.home')}</span>
          </IonTabButton>
          <IonTabButton tab="transactions" href="/tabs/transactions">
            <span className="material-symbols-rounded">receipt_long</span>
            <span>{t('tabs.transactions')}</span>
          </IonTabButton>
          <IonTabButton
            tab="add"
            onClick={(e) => {
              e.preventDefault();
              openAdd();
            }}
          >
            <span className="add-tab-icon">
              <span className="material-symbols-rounded">add</span>
            </span>
            <span>{t('tabs.add')}</span>
          </IonTabButton>
          <IonTabButton tab="debts" href="/tabs/debts">
            <span className="material-symbols-rounded">handshake</span>
            <span>{t('tabs.debts')}</span>
          </IonTabButton>
          <IonTabButton tab="more" href="/tabs/more">
            <span className="material-symbols-rounded">grid_view</span>
            <span>{t('tabs.more')}</span>
          </IonTabButton>
        </IonTabBar>
      </IonTabs>
      <IonModal
        isOpen={quickAdd}
        onDidDismiss={() => setQuickAdd(false)}
        initialBreakpoint={1}
        breakpoints={[0, 1]}
      >
        <IonContent className="shell-content">
          <QuickAdd
            open={quickAdd}
            editId={editId}
            onClose={() => setQuickAdd(false)}
            onSaved={showToast}
            onLoan={() => {
              setQuickAdd(false);
              navigate('/tabs/debts');
            }}
          />
        </IonContent>
      </IonModal>
      <IonToast
        isOpen={!!message}
        message={message}
        duration={4000}
        onDidDismiss={() => {
          setMessage('');
          setUndo(null);
        }}
        buttons={
          undo ? [{ text: t('money.undo'), handler: () => undo() }] : undefined
        }
      />
      <IonToast
        isOpen={exitHint}
        message={t('navigation.exitHint')}
        duration={1800}
        onDidDismiss={() => setExitHint(false)}
      />
      <IonToast isOpen={!!pushBanner} position="top" message={pushBanner ? `${pushBanner.title}: ${pushBanner.body}` : ''} duration={8000} onDidDismiss={() => setPushBanner(null)} buttons={pushBanner ? [{text:t('notifications.viewPush'),handler:()=>openPush(pushBanner)}] : []} />
      <InAppUpdateBanner />
      <InAppReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onFeedback={() => navigate('/tabs/more/settings')}
      />
      <AppLockOverlay />
    </>
  );
}
export default function App() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [access, setAccess] = useState<{ code: AccessCode; reason: string } | null>(null);
  const [logoutAlert, setLogoutAlert] = useState<{ open: boolean; pendingCount: number } | null>(null);

  const updateUser = useCallback((value: User) => {
    setUser(value);
    setCurrentUserId(String(value.id));
    void SecureStorage.setItem('tohobil.auth.user', JSON.stringify(value));
  }, []);

  const check = useCallback(async () => {
    try {
      const status = await api<{ feature_flags?: Record<string, boolean> }>('app/status');
      if (status?.feature_flags) {
        void syncFeatureFlags(status.feature_flags);
      }
      const saved = await token();
      if (saved) {
        const pending = await SecureStorage.getItem('tohobil.profile.pending');
        if (pending) {
          await api('me', { method: 'PUT', body: pending });
          await SecureStorage.removeItem('tohobil.profile.pending');
        }
        const result = await api<{ user: User }>('me');
        const userId = String(result.user.id);
        setCurrentUserId(userId);
        await alignEmptyBookCurrency(userId, result.user.currency || 'BDT').catch(() => {});
        updateUser(result.user);
        syncEngine.start();
        void registerDevice().catch(() => {});
        void uploadQueue.processQueue();
      }
      setAccess(null);
    } catch (error) {
      if (error instanceof ApiError && isAccessCode(error.code)) {
        setAccess({ code: error.code, reason: error.message });
        if (
          error.code === 'ACCOUNT_BLOCKED' ||
          error.code === 'ACCOUNT_DISABLED' ||
          error.code === 'ACCESS_BLOCKED' ||
          error.code === 'DEVICE_BLOCKED'
        ) {
          syncEngine.stop();
          await clearToken();
          setUser(null);
        }
      } else if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') {
        syncEngine.stop();
        await clearToken();
        setUser(null);
      } else if (error instanceof ApiError && error.code === 'OFFLINE') {
        const cached = await SecureStorage.getItem('tohobil.auth.user');
        if (cached && (await token())) {
          const parsed = JSON.parse(cached) as User;
          const userId = String(parsed.id);
          setCurrentUserId(userId);
          await alignEmptyBookCurrency(userId, parsed.currency || 'BDT').catch(() => {});
          setUser(parsed);
          syncEngine.start();
        }
      }
    } finally {
      setReady(true);
    }
  }, [updateUser]);

  useEffect(() => {
    void uploadQueue.init();
    const timer = window.setTimeout(() => void check(), 0);
    const resume = () => { void check(); void flushPushOpenQueue(); };
    document.addEventListener('resume', resume);
    window.addEventListener('online', resume);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('resume', resume);
      window.removeEventListener('online', resume);
    };
  }, [check]);
  const pushUserId = user?.id;
  useEffect(() => {
    if (ready && Capacitor.isNativePlatform()) {
      requestAnimationFrame(() => void SplashScreen.hide());
    }
  }, [ready]);
  useEffect(() => {
    if (!pushUserId) return;
    void startPushListeners().then(() => refreshPushRegistration()).catch(() => {});
  }, [pushUserId]);

  const login = async (value: User, key: string) => {
    setRestoring(true);
    try {
      await saveToken(key);
      const userId = String(value.id);
      await migrateLocalUser(userId);
      await alignEmptyBookCurrency(userId, value.currency || 'BDT').catch(() => {});
      updateUser(value);
      void registerDevice().catch(() => {});
      await syncEngine.restoreOnLogin();
      syncEngine.start();
    } finally {
      setRestoring(false);
    }
  };

  const handleLogout = async () => {
    let count = await syncEngine.refreshPendingCount();
    if (count > 0 && navigator.onLine) {
      try {
        await syncEngine.push();
        count = await syncEngine.refreshPendingCount();
      } catch {
        // ignore
      }
    }
    setLogoutAlert({ open: true, pendingCount: count });
  };

  const executeLogout = async (wipe: boolean) => {
    syncEngine.stop();
    await removePushToken().catch(() => {});
    await api('auth/logout', { method: 'POST' }).catch(() => {});
    await clearToken();
    await SecureStorage.removeItem('tohobil.auth.user');
    await SecureStorage.removeItem('tohobil.sync.cursor');
    if (wipe) {
      await wipeLocalData();
      void useMoney.getState().refresh();
    } else {
      setCurrentUserId('local');
    }
    setUser(null);
    setLogoutAlert(null);
  };

  return (
    <IonApp>
      <IonReactRouter>
        {!ready ? (
          <div className="app-boot-loading">
            <IonSpinner name="crescent" color="primary" />
          </div>
        ) : restoring ? (
          <RestoringScreen />
        ) : access ? (
          <AccessScreen code={access.code} reason={access.reason} onRetry={() => void check()} />
        ) : user ? (
          <Shell user={user} onUpdate={updateUser} onLogout={() => void handleLogout()} />
        ) : (
          <IdentityScreens onReady={login} />
        )}
      </IonReactRouter>
      <IonAlert
        isOpen={!!logoutAlert?.open}
        header={t(
          logoutAlert?.pendingCount && logoutAlert.pendingCount > 0
            ? 'sync.unsyncedLogoutTitle'
            : 'identity.logout',
        )}
        message={
          logoutAlert?.pendingCount && logoutAlert.pendingCount > 0
            ? logoutAlert.pendingCount === 1
              ? t('sync.unsyncedLogoutBody', { count: logoutAlert.pendingCount })
              : t('sync.unsyncedLogoutBody_other', { count: logoutAlert.pendingCount })
            : undefined
        }
        inputs={[
          {
            type: 'checkbox',
            label: t('sync.wipeLocalData'),
            value: 'wipe',
            checked: false,
          },
        ]}
        buttons={[
          {
            text: t('identity.cancel'),
            role: 'cancel',
            handler: () => setLogoutAlert(null),
          },
          {
            text: t(
              logoutAlert?.pendingCount && logoutAlert.pendingCount > 0
                ? 'sync.logoutAnyway'
                : 'identity.logout',
            ),
            role: 'destructive',
            handler: (data) => {
              const wipe = Array.isArray(data) ? data.includes('wipe') : data === 'wipe';
              void executeLogout(wipe);
            },
          },
        ]}
        onDidDismiss={() => setLogoutAlert(null)}
      />
    </IonApp>
  );
}
