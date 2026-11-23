import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonModal,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { useMoney } from '../money/store';
import {
  contributeToGoal,
  createGoal,
  deleteGoal,
  listGoals,
  updateGoal,
} from '../../db/repository';
import type { GoalView } from '../../db/types';
import { formatMinor, minorToInput, parseMinor } from '../../lib/money';

const GOAL_ICONS = [
  'flag',
  'savings',
  'directions_car',
  'home',
  'flight',
  'laptop_mac',
  'school',
  'ring_volume',
  'shield',
  'health_and_safety',
  'celebration',
  'favorite',
];

const GOAL_COLORS = [
  '#ec4899',
  '#6366f1',
  '#14b8a6',
  '#f59e0b',
  '#0ea5e9',
  '#22c55e',
  '#8b5cf6',
  '#f43f5e',
];

export function GoalsScreen({
  onToast,
}: {
  onToast?: (message: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const bookId = useMoney((s) => s.bookId);
  const accounts = useMoney((s) => s.accounts);
  const books = useMoney((s) => s.books);

  const currency = books.find((b) => b.id === bookId)?.currency ?? 'BDT';

  const [goals, setGoals] = useState<GoalView[]>([]);

  // Editor Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('flag');
  const [color, setColor] = useState('#ec4899');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().slice(0, 10);
  });
  const [linkedAccountId, setLinkedAccountId] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Contribution Modal
  const [contributeOpen, setContributeOpen] = useState(false);
  const [activeGoal, setActiveGoal] = useState<GoalView | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [contributeAccountId, setContributeAccountId] = useState('');
  const [contributeDate, setContributeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [contributeNote, setContributeNote] = useState('');
  const [contributeSaving, setContributeSaving] = useState(false);

  // Celebration state
  const [celebrationGoal, setCelebrationGoal] = useState<GoalView | null>(null);

  const reload = async () => {
    if (!bookId) return;
    try {
      const items = await listGoals(bookId);
      setGoals(items);
    } catch (e) {
      console.error('Failed to load goals', e);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const activeAccounts = accounts.filter((a) => !a.is_archived);

  const openAdd = () => {
    setEditId(null);
    setName('');
    setIcon('flag');
    setColor('#ec4899');
    setTargetAmount('');
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    setTargetDate(d.toISOString().slice(0, 10));
    setLinkedAccountId('');
    setCurrentAmount('');
    setNote('');
    setError('');
    setEditorOpen(true);
  };

  const openEdit = (g: GoalView) => {
    setEditId(g.id);
    setName(g.name);
    setIcon(g.icon);
    setColor(g.color);
    setTargetAmount(minorToInput(g.target_amount, g.currency));
    setTargetDate(new Date(g.target_date).toISOString().slice(0, 10));
    setLinkedAccountId(g.linked_account_id ?? '');
    setCurrentAmount(minorToInput(g.current_amount, g.currency));
    setNote(g.note);
    setError('');
    setEditorOpen(true);
  };

  const openContribute = (g: GoalView) => {
    setActiveGoal(g);
    setContributeAmount('');
    setContributeAccountId(g.linked_account_id ?? (activeAccounts[0]?.id ?? ''));
    setContributeDate(new Date().toISOString().slice(0, 10));
    setContributeNote('');
    setContributeOpen(true);
  };

  const handleSave = async () => {
    if (!bookId) return;
    if (!name.trim()) {
      setError(t('planning.enterGoalName'));
      return;
    }
    const targetMinor = parseMinor(targetAmount, currency);
    if (targetMinor <= 0) {
      setError(t('money.invalidAmount'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      const targetDateMs = new Date(`${targetDate}T12:00:00`).getTime();
      const currentMinor = currentAmount ? parseMinor(currentAmount, currency) : 0;

      if (editId) {
        await updateGoal(editId, {
          name: name.trim(),
          icon,
          color,
          targetAmount: targetMinor,
          targetDate: targetDateMs,
          linkedAccountId: linkedAccountId || null,
          currentAmount: currentMinor,
          note: note.trim(),
        });
        onToast?.(t('planning.goalUpdated'));
      } else {
        await createGoal(bookId, {
          name: name.trim(),
          icon,
          color,
          targetAmount: targetMinor,
          currency,
          targetDate: targetDateMs,
          linkedAccountId: linkedAccountId || null,
          currentAmount: currentMinor,
          note: note.trim(),
        });
        onToast?.(t('planning.goalCreated'));
      }
      void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      setEditorOpen(false);
      await reload();
    } catch (e) {
      console.error('Error saving goal', e);
      setError(t('money.error'));
      void Haptics.notification({ type: NotificationType.Error }).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const handleContribute = async () => {
    if (!activeGoal) return;
    const minor = parseMinor(contributeAmount, currency);
    if (minor <= 0) {
      onToast?.(t('money.invalidAmount'));
      return;
    }
    if (!contributeAccountId) {
      onToast?.(t('money.accountRequired'));
      return;
    }

    setContributeSaving(true);
    try {
      const dateMs = new Date(`${contributeDate}T12:00:00`).getTime();
      await contributeToGoal({
        goalId: activeGoal.id,
        accountId: contributeAccountId,
        amount: minor,
        date: dateMs,
        note: contributeNote.trim(),
      });

      const updatedCurrent = activeGoal.current_amount + minor;
      if (updatedCurrent >= activeGoal.target_amount && !activeGoal.is_achieved) {
        // Goal achieved! Trigger celebration!
        void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
        setCelebrationGoal({
          ...activeGoal,
          current_amount: updatedCurrent,
          percentage: 100,
          is_achieved: true,
        });
        window.dispatchEvent(
          new CustomEvent('tohobil:positive-moment', { detail: 'goal_reached' }),
        );
      } else {
        void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
        onToast?.(t('planning.contributionAdded'));
      }

      setContributeOpen(false);
      await reload();
    } catch (e) {
      console.error('Error adding contribution', e);
      onToast?.(t('money.error'));
    } finally {
      setContributeSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGoal(id);
      void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      onToast?.(t('planning.goalDeleted'));
      await reload();
    } catch (e) {
      console.error('Error deleting goal', e);
    }
  };

  const activeGoals = goals.filter((g) => !g.is_achieved);
  const achievedGoals = goals.filter((g) => g.is_achieved);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButton slot="start" fill="clear" aria-label={t('a11y.back')} onClick={() => navigate(-1)}>
            <span className="material-symbols-rounded">arrow_back</span>
          </IonButton>
          <IonTitle>{t('planning.goals')}</IonTitle>
          <IonButton
            slot="end"
            fill="clear"
            aria-label={t('planning.addGoal')}
            onClick={openAdd}
          >
            <span className="material-symbols-rounded">add</span>
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent className="shell-content">
        <div className="page-pad">
          {goals.length === 0 ? (
            <div className="surface-card empty-state" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '48px', color: '#ec4899' }}>
                flag
              </span>
              <p style={{ fontWeight: 600, fontSize: '16px', margin: '12px 0 4px' }}>
                {t('planning.noGoals')}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--app-muted)', margin: 0 }}>
                {t('planning.noGoalsDesc')}
              </p>
              <button
                className="primary-button"
                style={{ marginTop: '16px' }}
                onClick={openAdd}
              >
                {t('planning.addGoal')}
              </button>
            </div>
          ) : (
            <div>
              {/* Active Goals */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {activeGoals.map((g) => (
                  <div
                    key={g.id}
                    className="surface-card"
                    style={{
                      padding: '20px',
                      borderRadius: '20px',
                      border: '1px solid var(--app-border)',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          className="tile-icon"
                          style={{
                            background: `${g.color}20`,
                            color: g.color,
                            width: '46px',
                            height: '46px',
                            borderRadius: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: '26px' }}>{g.icon}</span>
                        </span>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '17px' }}>{g.name}</p>
                          <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--app-muted)' }}>
                            {formatMinor(g.current_amount, g.currency, i18n.language)} / {formatMinor(g.target_amount, g.currency, i18n.language)}
                          </p>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 800,
                            background: `${g.color}20`,
                            color: g.color,
                          }}
                        >
                          {g.percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div
                      style={{
                        width: '100%',
                        height: '10px',
                        borderRadius: '5px',
                        background: 'var(--app-border)',
                        overflow: 'hidden',
                        margin: '16px 0 8px',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, g.percentage)}%`,
                          height: '100%',
                          borderRadius: '5px',
                          background: g.color,
                          transition: 'width 0.4s ease-out',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--app-muted)' }}>
                      <span>
                        {t('planning.daysLeft', { count: g.days_remaining })}
                      </span>
                      <span>
                        {formatMinor(Math.max(0, g.target_amount - g.current_amount), g.currency, i18n.language)} {t('planning.remaining')}
                      </span>
                    </div>

                    {/* Required Monthly Saving Pill */}
                    {g.required_monthly_saving > 0 && (
                      <div
                        style={{
                          marginTop: '12px',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          background: `${g.color}10`,
                          color: g.color,
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>trending_up</span>
                        <span>
                          {t('planning.needToSaveMonthly', {
                            amount: formatMinor(g.required_monthly_saving, g.currency, i18n.language),
                          })}
                        </span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '16px',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--app-border)',
                      }}
                    >
                      <button
                        type="button"
                        className="primary-button"
                        style={{ padding: '6px 16px', fontSize: '13px' }}
                        onClick={() => openContribute(g)}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '16px', marginRight: '4px', verticalAlign: 'middle' }}>
                          add_circle
                        </span>
                        {t('planning.addFunds')}
                      </button>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openEdit(g)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--app-muted)' }}
                          aria-label={t('common.edit')}
                        >
                          <span className="material-symbols-rounded">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(g.id)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#f43f5e' }}
                          aria-label={t('common.delete')}
                        >
                          <span className="material-symbols-rounded">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Achieved Goals Section */}
                {achievedGoals.length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-rounded" style={{ color: '#22c55e' }}>verified</span>
                      {t('planning.achievedGoals')} ({achievedGoals.length})
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                      {achievedGoals.map((g) => (
                        <div
                          key={g.id}
                          className="surface-card"
                          style={{
                            padding: '16px',
                            borderRadius: '16px',
                            background: '#22c55e08',
                            border: '1px solid #22c55e30',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span
                              className="tile-icon"
                              style={{
                                background: '#22c55e20',
                                color: '#22c55e',
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <span className="material-symbols-rounded">celebration</span>
                            </span>
                            <div>
                              <p style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>{g.name}</p>
                              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>
                                {formatMinor(g.target_amount, g.currency, i18n.language)} • {t('planning.achieved')}!
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDelete(g.id)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--app-muted)' }}
                            aria-label={t('common.delete')}
                          >
                            <span className="material-symbols-rounded">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </IonContent>

      {/* Add / Edit Goal Modal */}
      <IonModal isOpen={editorOpen} onDidDismiss={() => setEditorOpen(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{editId ? t('planning.editGoal') : t('planning.newGoal')}</IonTitle>
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

            <label className="field-label">{t('planning.goalName')}</label>
            <input
              type="text"
              className="text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('planning.goalNamePlaceholder')}
            />

            <label className="field-label">{t('planning.chooseIcon')}</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {GOAL_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    border: icon === ic ? '2px solid var(--app-primary)' : '1px solid var(--app-border)',
                    background: icon === ic ? 'var(--app-primary-light, #14b8a620)' : 'var(--app-card)',
                    color: icon === ic ? 'var(--app-primary)' : 'var(--app-text)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span className="material-symbols-rounded">{ic}</span>
                </button>
              ))}
            </div>

            <label className="field-label">{t('planning.chooseColor')}</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {GOAL_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setColor(col)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: col,
                    border: color === col ? '3px solid #ffffff' : 'none',
                    boxShadow: color === col ? '0 0 0 2px var(--app-primary)' : 'none',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>

            <label className="field-label">{t('planning.targetAmount')}</label>
            <input
              type="text"
              inputMode="decimal"
              className="text-input"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="0.00"
            />

            <label className="field-label">{t('planning.targetDate')}</label>
            <input
              type="date"
              className="text-input"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />

            <label className="field-label">{t('planning.initialSaved')}</label>
            <input
              type="text"
              inputMode="decimal"
              className="text-input"
              value={currentAmount}
              onChange={(e) => setCurrentAmount(e.target.value)}
              placeholder="0.00"
            />

            <label className="field-label">{t('planning.linkedAccount')}</label>
            <select
              className="text-input"
              value={linkedAccountId}
              onChange={(e) => setLinkedAccountId(e.target.value)}
            >
              <option value="">{t('planning.noLinkedAccount')}</option>
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

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

      {/* Contribute Modal */}
      <IonModal isOpen={contributeOpen} onDidDismiss={() => setContributeOpen(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{t('planning.addFundsToGoal', { name: activeGoal?.name ?? '' })}</IonTitle>
            <IonButton slot="start" fill="clear" onClick={() => setContributeOpen(false)}>
              {t('common.cancel')}
            </IonButton>
            <IonButton slot="end" fill="solid" onClick={handleContribute} disabled={contributeSaving}>
              {t('planning.contribute')}
            </IonButton>
          </IonToolbar>
        </IonHeader>

        <IonContent className="shell-content">
          <div className="page-pad modal-form-pad">
            <label className="field-label">{t('planning.contributionAmount')}</label>
            <input
              type="text"
              inputMode="decimal"
              className="text-input"
              value={contributeAmount}
              onChange={(e) => setContributeAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />

            <label className="field-label">{t('planning.fromAccount')}</label>
            <select
              className="text-input"
              value={contributeAccountId}
              onChange={(e) => setContributeAccountId(e.target.value)}
            >
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            <label className="field-label">{t('money.date')}</label>
            <input
              type="date"
              className="text-input"
              value={contributeDate}
              onChange={(e) => setContributeDate(e.target.value)}
            />

            <label className="field-label">{t('money.note')}</label>
            <input
              type="text"
              className="text-input"
              value={contributeNote}
              onChange={(e) => setContributeNote(e.target.value)}
              placeholder={t('planning.contributionNotePlaceholder')}
            />
          </div>
        </IonContent>
      </IonModal>

      {/* Celebration Modal / Banner */}
      {celebrationGoal && (
        <IonModal isOpen={true} onDidDismiss={() => setCelebrationGoal(null)}>
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              background: 'radial-gradient(circle, #22c55e20 0%, var(--app-bg) 70%)',
            }}
          >
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: '80px',
                color: '#22c55e',
                animation: 'bounce 1s infinite alternate',
              }}
            >
              celebration
            </span>
            <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '16px 0 8px' }}>
              {t('planning.goalAchievedTitle')}
            </h1>
            <p style={{ fontSize: '16px', color: 'var(--app-muted)', margin: '0 0 24px' }}>
              {t('planning.goalAchievedDesc', {
                name: celebrationGoal.name,
                amount: formatMinor(celebrationGoal.target_amount, celebrationGoal.currency, i18n.language),
              })}
            </p>
            <button
              className="primary-button"
              style={{ padding: '12px 32px', fontSize: '16px', borderRadius: '14px' }}
              onClick={() => setCelebrationGoal(null)}
            >
              {t('planning.awesome')}
            </button>
          </div>
        </IonModal>
      )}
    </IonPage>
  );
}
