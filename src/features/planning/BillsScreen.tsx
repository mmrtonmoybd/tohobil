import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonModal,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { useMoney } from '../money/store';
import {
  createRecurringRule,
  deleteRecurringRule,
  executeRecurringRuleNow,
  listRecurringRules,
  skipRecurringRuleNextRun,
  updateRecurringRule,
} from '../../db/repository';
import type {
  RecurringFrequency,
  RecurringMode,
  RecurringRuleView,
} from '../../db/types';
import { formatMinor, minorToInput, parseMinor } from '../../lib/money';
import { calculateMonthlyEquivalent } from '../../lib/recurrence';

export function BillsScreen({
  onToast,
}: {
  onToast?: (message: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const bookId = useMoney((s) => s.bookId);
  const accounts = useMoney((s) => s.accounts);
  const categories = useMoney((s) => s.categories);
  const books = useMoney((s) => s.books);

  const currency = books.find((b) => b.id === bookId)?.currency ?? 'BDT';

  const [segment, setSegment] = useState<'bills' | 'subscriptions'>('bills');
  const [rules, setRules] = useState<RecurringRuleView[]>([]);

  // Editor Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [personId, setPersonId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [intervalStep, setIntervalStep] = useState(1);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [mode, setMode] = useState<RecurringMode>('remind');
  const [isSubscription, setIsSubscription] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reload = async () => {
    if (!bookId) return;
    try {
      const items = await listRecurringRules(bookId);
      setRules(items);
    } catch (e) {
      console.error('Failed to load recurring rules', e);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const activeAccounts = accounts.filter((a) => !a.is_archived);
  const expenseCategories = categories.filter((c) => c.kind === 'expense');

  const openAdd = (asSubscription = false) => {
    setEditId(null);
    setName('');
    setType('expense');
    setAmount('');
    setAccountId(activeAccounts[0]?.id ?? '');
    setToAccountId(activeAccounts[1]?.id ?? '');
    setCategoryId(expenseCategories[0]?.id ?? '');
    setPersonId('');
    setFrequency('monthly');
    setIntervalStep(1);
    setStartDate(new Date().toISOString().slice(0, 10));
    setHasEndDate(false);
    setEndDate('');
    setMode(asSubscription ? 'auto_create' : 'remind');
    setIsSubscription(asSubscription);
    setNote('');
    setError('');
    setEditorOpen(true);
  };

  const openEdit = (rule: RecurringRuleView) => {
    setEditId(rule.id);
    setName(rule.name);
    setType(rule.type);
    setAmount(minorToInput(rule.amount, rule.currency));
    setAccountId(rule.account_id);
    setToAccountId(rule.to_account_id ?? '');
    setCategoryId(rule.category_id ?? '');
    setPersonId(rule.person_id ?? '');
    setFrequency(rule.frequency);
    setIntervalStep(rule.interval_step);
    setStartDate(new Date(rule.start_date).toISOString().slice(0, 10));
    setHasEndDate(rule.end_date !== null);
    setEndDate(rule.end_date ? new Date(rule.end_date).toISOString().slice(0, 10) : '');
    setMode(rule.mode);
    setIsSubscription(rule.is_subscription === 1);
    setNote(rule.note);
    setError('');
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!bookId) return;
    if (!name.trim()) {
      setError(t('planning.enterName'));
      return;
    }
    const minor = parseMinor(amount, currency);
    if (minor <= 0) {
      setError(t('money.invalidAmount'));
      return;
    }
    if (!accountId) {
      setError(t('money.accountRequired'));
      return;
    }
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      setError(t('money.sameAccount'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      const startMs = new Date(`${startDate}T12:00:00`).getTime();
      const endMs = hasEndDate && endDate ? new Date(`${endDate}T23:59:59`).getTime() : null;

      if (editId) {
        await updateRecurringRule(editId, {
          name: name.trim(),
          type,
          amount: minor,
          accountId,
          toAccountId: type === 'transfer' ? toAccountId : null,
          categoryId: type !== 'transfer' ? categoryId || null : null,
          personId: personId || null,
          frequency,
          intervalStep,
          startDate: startMs,
          endDate: endMs,
          mode,
          isSubscription,
          note: note.trim(),
        });
        onToast?.(t('planning.ruleUpdated'));
      } else {
        await createRecurringRule(bookId, {
          name: name.trim(),
          type,
          amount: minor,
          currency,
          accountId,
          toAccountId: type === 'transfer' ? toAccountId : null,
          categoryId: type !== 'transfer' ? categoryId || null : null,
          personId: personId || null,
          frequency,
          intervalStep,
          startDate: startMs,
          endDate: endMs,
          mode,
          isSubscription,
          note: note.trim(),
        });
        onToast?.(t('planning.ruleCreated'));
      }
      void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      setEditorOpen(false);
      await reload();
    } catch (e) {
      console.error('Error saving rule', e);
      setError(t('money.error'));
      void Haptics.notification({ type: NotificationType.Error }).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (ruleId: string) => {
    try {
      await executeRecurringRuleNow(ruleId);
      void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      onToast?.(t('planning.markedPaid'));
      await reload();
    } catch (e) {
      console.error('Error executing rule', e);
      onToast?.(t('money.error'));
    }
  };

  const handleSkip = async (ruleId: string) => {
    try {
      await skipRecurringRuleNextRun(ruleId);
      void Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
      onToast?.(t('planning.skipped'));
      await reload();
    } catch (e) {
      console.error('Error skipping rule', e);
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await deleteRecurringRule(ruleId);
      void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      onToast?.(t('planning.ruleDeleted'));
      await reload();
    } catch (e) {
      console.error('Error deleting rule', e);
    }
  };

  const billsList = rules.filter((r) => r.is_subscription === 0);
  const subscriptionsList = rules.filter((r) => r.is_subscription === 1);

  const totalMonthlySubscriptions = subscriptionsList.reduce(
    (sum, r) => sum + calculateMonthlyEquivalent(r.amount, r.frequency, r.interval_step),
    0,
  );

  const overdueBills = billsList.filter((r) => r.is_overdue);
  const upcomingBills = billsList.filter((r) => !r.is_overdue);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButton slot="start" fill="clear" aria-label={t('a11y.back')} onClick={() => navigate(-1)}>
            <span className="material-symbols-rounded">arrow_back</span>
          </IonButton>
          <IonTitle>{t('planning.billsAndSubscriptions')}</IonTitle>
          <IonButton
            slot="end"
            fill="clear"
            aria-label={t('planning.addRule')}
            onClick={() => openAdd(segment === 'subscriptions')}
          >
            <span className="material-symbols-rounded">add</span>
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent className="shell-content">
        <div className="page-pad">
          <IonSegment
            scrollable
            value={segment}
            onIonChange={(e) => setSegment(e.detail.value as 'bills' | 'subscriptions')}
            style={{ marginBottom: '16px' }}
          >
            <IonSegmentButton value="bills">
              {t('planning.upcomingBills')} ({billsList.length})
            </IonSegmentButton>
            <IonSegmentButton value="subscriptions">
              {t('planning.subscriptions')} ({subscriptionsList.length})
            </IonSegmentButton>
          </IonSegment>

          {segment === 'subscriptions' ? (
            <div>
              {/* Monthly Subscriptions Hero */}
              <div
                className="surface-card"
                style={{
                  background: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
                  color: '#ffffff',
                  padding: '20px',
                  borderRadius: '20px',
                  marginBottom: '20px',
                }}
              >
                <span style={{ fontSize: '13px', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('planning.monthlySubscriptionsTotal')}
                </span>
                <div style={{ fontSize: '32px', fontWeight: 800, margin: '8px 0 4px' }}>
                  {formatMinor(totalMonthlySubscriptions, currency, i18n.language)}
                </div>
                <span style={{ fontSize: '13px', opacity: 0.9 }}>
                  {t('planning.activeSubscriptionsCount', { count: subscriptionsList.length })}
                </span>
              </div>

              {subscriptionsList.length === 0 ? (
                <div className="surface-card empty-state" style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '48px', color: '#f97316' }}>
                    event_repeat
                  </span>
                  <p style={{ fontWeight: 600, fontSize: '16px', margin: '12px 0 4px' }}>
                    {t('planning.noSubscriptions')}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--app-muted)', margin: 0 }}>
                    {t('planning.noSubscriptionsDesc')}
                  </p>
                  <button
                    className="primary-button"
                    style={{ marginTop: '16px' }}
                    onClick={() => openAdd(true)}
                  >
                    {t('planning.addSubscription')}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {subscriptionsList.map((sub) => {
                    const monthlyEq = calculateMonthlyEquivalent(sub.amount, sub.frequency, sub.interval_step);
                    return (
                      <div
                        key={sub.id}
                        className="surface-card"
                        style={{
                          padding: '16px',
                          borderRadius: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span
                            className="tile-icon"
                            style={{
                              background: `${sub.category_color ?? '#f97316'}20`,
                              color: sub.category_color ?? '#f97316',
                              width: '44px',
                              height: '44px',
                              borderRadius: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <span className="material-symbols-rounded">
                              {sub.category_icon ?? 'event_repeat'}
                            </span>
                          </span>
                          <div>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>{sub.name}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--app-muted)' }}>
                              {t(`planning.freq_${sub.frequency}`)} • {sub.account_name ?? '—'}
                            </p>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>
                            {formatMinor(sub.amount, sub.currency, i18n.language)}
                          </p>
                          {sub.frequency !== 'monthly' && (
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--app-muted)' }}>
                              ~{formatMinor(monthlyEq, sub.currency, i18n.language)}/{t('planning.month')}
                            </p>
                          )}
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                            <button
                              type="button"
                              onClick={() => openEdit(sub)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--app-muted)', padding: 0 }}
                              aria-label={t('common.edit')}
                            >
                              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(sub.id)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#f43f5e', padding: 0 }}
                              aria-label={t('common.delete')}
                            >
                              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Overdue Warning Alert */}
              {overdueBills.length > 0 && (
                <div
                  className="surface-card"
                  style={{
                    border: '1px solid #f43f5e',
                    background: '#f43f5e10',
                    borderRadius: '16px',
                    padding: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f43f5e', fontWeight: 700 }}>
                    <span className="material-symbols-rounded">warning</span>
                    <span>{t('planning.overdueAlert', { count: overdueBills.length })}</span>
                  </div>
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {overdueBills.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 0',
                          borderTop: '1px solid rgba(244,63,94,0.15)',
                        }}
                      >
                        <div>
                          <strong>{b.name}</strong>
                          <span style={{ fontSize: '12px', display: 'block', color: '#f43f5e' }}>
                            {t('planning.dueOn', {
                              date: new Date(b.next_run_at).toLocaleDateString(
                                i18n.language === 'bn' ? 'bn-BD' : 'en-GB',
                                { day: 'numeric', month: 'short' },
                              ),
                            })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: 700 }}>
                            {formatMinor(b.amount, b.currency, i18n.language)}
                          </span>
                          <button
                            className="primary-button"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => handleMarkPaid(b.id)}
                          >
                            {t('planning.payNow')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Bills List */}
              {upcomingBills.length === 0 && overdueBills.length === 0 ? (
                <div className="surface-card empty-state" style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '48px', color: '#14b8a6' }}>
                    receipt_long
                  </span>
                  <p style={{ fontWeight: 600, fontSize: '16px', margin: '12px 0 4px' }}>
                    {t('planning.noUpcomingBills')}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--app-muted)', margin: 0 }}>
                    {t('planning.noUpcomingBillsDesc')}
                  </p>
                  <button
                    className="primary-button"
                    style={{ marginTop: '16px' }}
                    onClick={() => openAdd(false)}
                  >
                    {t('planning.addBill')}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {upcomingBills.map((b) => (
                    <div
                      key={b.id}
                      className="surface-card"
                      style={{
                        padding: '16px',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          className="tile-icon"
                          style={{
                            background: `${b.category_color ?? '#14b8a6'}20`,
                            color: b.category_color ?? '#14b8a6',
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span className="material-symbols-rounded">
                            {b.category_icon ?? 'receipt'}
                          </span>
                        </span>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>{b.name}</p>
                          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--app-muted)' }}>
                            {new Date(b.next_run_at).toLocaleDateString(
                              i18n.language === 'bn' ? 'bn-BD' : 'en-GB',
                              { day: 'numeric', month: 'short' },
                            )}{' '}
                            • {t(`planning.freq_${b.frequency}`)}
                          </p>
                          <span
                            style={{
                              display: 'inline-block',
                              marginTop: '4px',
                              fontSize: '11px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: b.mode === 'auto_create' ? '#22c55e15' : '#f59e0b15',
                              color: b.mode === 'auto_create' ? '#22c55e' : '#f59e0b',
                              fontWeight: 600,
                            }}
                          >
                            {b.mode === 'auto_create' ? t('planning.modeAuto') : t('planning.modeRemind')}
                          </span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>
                          {formatMinor(b.amount, b.currency, i18n.language)}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                          <button
                            type="button"
                            className="primary-button"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => handleMarkPaid(b.id)}
                          >
                            {t('planning.pay')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSkip(b.id)}
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--app-border)',
                              borderRadius: '8px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              color: 'var(--app-muted)',
                              cursor: 'pointer',
                            }}
                          >
                            {t('planning.skip')}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(b)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--app-muted)', padding: '0 4px' }}
                            aria-label={t('common.edit')}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>edit</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </IonContent>

      {/* Add / Edit Recurring Rule Modal */}
      <IonModal isOpen={editorOpen} onDidDismiss={() => setEditorOpen(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{editId ? t('planning.editRule') : t('planning.newRule')}</IonTitle>
            <IonButton slot="start" fill="clear" onClick={() => setEditorOpen(false)}>
              {t('common.cancel')}
            </IonButton>
            <IonButton slot="end" fill="solid" onClick={handleSave} disabled={saving}>
              {t('common.save')}
            </IonButton>
          </IonToolbar>
        </IonHeader>

        <IonContent className="shell-content">
          <div className="page-pad modal-form-pad">
            {error && <div className="surface-card error-card" style={{ marginBottom: '16px' }}>{error}</div>}

            <label className="field-label">{t('planning.ruleName')}</label>
            <input
              type="text"
              className="text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('planning.namePlaceholder')}
            />

            <label className="field-label">{t('money.type')}</label>
            <div className="tab-pill-group" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {(['expense', 'income', 'transfer'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`tab-pill ${type === k ? 'active' : ''}`}
                  onClick={() => setType(k)}
                  style={{ flex: 1, padding: '10px' }}
                >
                  {t(`money.${k}`)}
                </button>
              ))}
            </div>

            <label className="field-label">{t('money.amount')}</label>
            <input
              type="text"
              inputMode="decimal"
              className="text-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />

            <label className="field-label">{t('money.account')}</label>
            <select
              className="text-input"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            {type === 'transfer' ? (
              <>
                <label className="field-label">{t('money.toAccount')}</label>
                <select
                  className="text-input"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                >
                  <option value="">{t('money.selectAccount')}</option>
                  {activeAccounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                </select>
              </>
            ) : (
              <>
                <label className="field-label">{t('money.category')}</label>
                <select
                  className="text-input"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">{t('money.selectCategory')}</option>
                  {categories
                    .filter((c) => c.kind === type)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.i18n_key ? t(`categories.${c.i18n_key}`) : c.name}
                      </option>
                    ))}
                </select>
              </>
            )}

            <label className="field-label">{t('planning.frequency')}</label>
            <select
              className="text-input"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
            >
              <option value="daily">{t('planning.freq_daily')}</option>
              <option value="weekly">{t('planning.freq_weekly')}</option>
              <option value="monthly">{t('planning.freq_monthly')}</option>
              <option value="yearly">{t('planning.freq_yearly')}</option>
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="field-label">{t('planning.intervalStep')}</label>
                <input
                  type="number"
                  min="1"
                  className="text-input"
                  value={intervalStep}
                  onChange={(e) => setIntervalStep(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>
              <div>
                <label className="field-label">{t('planning.startDate')}</label>
                <input
                  type="date"
                  className="text-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>

            <label className="field-label">{t('planning.executionMode')}</label>
            <select
              className="text-input"
              value={mode}
              onChange={(e) => setMode(e.target.value as RecurringMode)}
            >
              <option value="remind">{t('planning.modeRemindDesc')}</option>
              <option value="auto_create">{t('planning.modeAutoDesc')}</option>
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0' }}>
              <input
                type="checkbox"
                id="subCheck"
                checked={isSubscription}
                onChange={(e) => setIsSubscription(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <label htmlFor="subCheck" style={{ fontSize: '14px', fontWeight: 600 }}>
                {t('planning.markAsSubscription')}
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <input
                type="checkbox"
                id="endCheck"
                checked={hasEndDate}
                onChange={(e) => setHasEndDate(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <label htmlFor="endCheck" style={{ fontSize: '14px', fontWeight: 600 }}>
                {t('planning.setEndDate')}
              </label>
            </div>

            {hasEndDate && (
              <div style={{ marginBottom: '16px' }}>
                <label className="field-label">{t('planning.endDate')}</label>
                <input
                  type="date"
                  className="text-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            )}

            <label className="field-label">{t('money.note')}</label>
            <input
              type="text"
              className="text-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('money.notePlaceholder')}
            />
          </div>
        </IonContent>
      </IonModal>
    </IonPage>
  );
}
