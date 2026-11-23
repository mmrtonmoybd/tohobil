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
  createBudget,
  deleteBudget,
  getBudgetSummaries,
  updateBudget,
} from '../../db/repository';
import type { BudgetSummary } from '../../db/types';
import { formatMinor, minorToInput, parseMinor } from '../../lib/money';

export function BudgetsScreen({
  onToast,
}: {
  onToast?: (message: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const bookId = useMoney((s) => s.bookId);
  const categories = useMoney((s) => s.categories);
  const books = useMoney((s) => s.books);

  const currency = books.find((b) => b.id === bookId)?.currency ?? 'BDT';

  const [dateCursor, setDateCursor] = useState(() => new Date());
  const [summaries, setSummaries] = useState<BudgetSummary[]>([]);
  const [overall, setOverall] = useState<BudgetSummary | null>(null);

  // Modal State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('overall');
  const [amount, setAmount] = useState('');
  const [rollover, setRollover] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const monthStr = `${dateCursor.getFullYear()}-${String(dateCursor.getMonth() + 1).padStart(2, '0')}`;

  const reload = async () => {
    if (!bookId) return;
    try {
      const res = await getBudgetSummaries(bookId, monthStr);
      setSummaries(res.summaries);
      setOverall(res.overall);
    } catch (e) {
      console.error('Failed to load budgets', e);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, monthStr]);

  const changeMonth = (delta: number) => {
    setDateCursor(new Date(dateCursor.getFullYear(), dateCursor.getMonth() + delta, 1));
  };

  const expenseCategories = categories.filter((c) => c.kind === 'expense');

  const openAdd = () => {
    setEditId(null);
    setSelectedCategoryId(overall ? (expenseCategories[0]?.id ?? '') : 'overall');
    setAmount('');
    setRollover(true);
    setError('');
    setEditorOpen(true);
  };

  const openEdit = (summary: BudgetSummary) => {
    setEditId(summary.id ?? null);
    setSelectedCategoryId(summary.category_id ?? 'overall');
    setAmount(minorToInput(summary.budget_amount, currency));
    setRollover(summary.rollover === 1);
    setError('');
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!bookId) return;
    const minor = parseMinor(amount, currency);
    if (minor <= 0) {
      setError(t('money.invalidAmount'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      const catId = selectedCategoryId === 'overall' ? null : selectedCategoryId;
      if (editId) {
        await updateBudget(editId, {
          categoryId: catId,
          amount: minor,
          rollover,
        });
        onToast?.(t('planning.budgetUpdated'));
      } else {
        await createBudget(bookId, {
          categoryId: catId,
          amount: minor,
          currency,
          period: 'monthly',
          rollover,
        });
        onToast?.(t('planning.budgetCreated'));
      }
      void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      setEditorOpen(false);
      await reload();
    } catch (e) {
      console.error('Error saving budget', e);
      setError(t('money.error'));
      void Haptics.notification({ type: NotificationType.Error }).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    try {
      await deleteBudget(id);
      void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      onToast?.(t('planning.budgetDeleted'));
      await reload();
    } catch (e) {
      console.error('Error deleting budget', e);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#f43f5e'; // red
    if (percentage >= 80) return '#f59e0b'; // amber
    return '#22c55e'; // green
  };

  const monthDisplay = dateCursor.toLocaleDateString(
    i18n.language === 'bn' ? 'bn-BD' : 'en-GB',
    { month: 'long', year: 'numeric' },
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButton slot="start" fill="clear" aria-label={t('a11y.back')} onClick={() => navigate(-1)}>
            <span className="material-symbols-rounded">arrow_back</span>
          </IonButton>
          <IonTitle>{t('planning.budgets')}</IonTitle>
          <IonButton
            slot="end"
            fill="clear"
            aria-label={t('planning.addBudget')}
            onClick={openAdd}
          >
            <span className="material-symbols-rounded">add</span>
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent className="shell-content">
        <div className="page-pad">
          {/* Month Navigator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <button
              type="button"
              className="icon-button"
              onClick={() => changeMonth(-1)}
              aria-label={t('planning.prevMonth')}
            >
              <span className="material-symbols-rounded">chevron_left</span>
            </button>
            <span style={{ fontWeight: 700, fontSize: '17px' }}>{monthDisplay}</span>
            <button
              type="button"
              className="icon-button"
              onClick={() => changeMonth(1)}
              aria-label={t('planning.nextMonth')}
            >
              <span className="material-symbols-rounded">chevron_right</span>
            </button>
          </div>

          {/* Overall Monthly Budget Card */}
          {overall ? (
            <div
              className="surface-card"
              style={{
                padding: '20px',
                borderRadius: '20px',
                marginBottom: '20px',
                border: overall.status === 'exceeded' ? '1px solid #f43f5e' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '13px', color: 'var(--app-muted)', textTransform: 'uppercase' }}>
                    {t('planning.overallBudget')}
                  </span>
                  <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '2px' }}>
                    {formatMinor(overall.spent_amount, currency, i18n.language)}{' '}
                    <span style={{ fontSize: '15px', color: 'var(--app-muted)', fontWeight: 500 }}>
                      / {formatMinor(overall.effective_budget, currency, i18n.language)}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => openEdit(overall)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--app-muted)' }}
                    aria-label={t('common.edit')}
                  >
                    <span className="material-symbols-rounded">edit</span>
                  </button>
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
                  margin: '14px 0 8px',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, overall.percentage)}%`,
                    height: '100%',
                    borderRadius: '5px',
                    background: getProgressColor(overall.percentage),
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--app-muted)' }}>
                <span>{overall.percentage}% {t('planning.spent')}</span>
                <span>
                  {overall.remaining_amount >= 0
                    ? `${formatMinor(overall.remaining_amount, currency, i18n.language)} ${t('planning.left')}`
                    : `${formatMinor(Math.abs(overall.remaining_amount), currency, i18n.language)} ${t('planning.overspent')}`}
                </span>
              </div>

              {/* Rollover notice */}
              {overall.rollover_amount > 0 && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#14b8a6', fontWeight: 600 }}>
                  +{formatMinor(overall.rollover_amount, currency, i18n.language)} {t('planning.rolledOver')}
                </div>
              )}

              {/* Status alerts */}
              {overall.status === 'exceeded' && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: '#f43f5e15',
                    color: '#f43f5e',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>error</span>
                  <span>{t('planning.overallExceededAlert')}</span>
                </div>
              )}
              {overall.status === 'warning' && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: '#f59e0b15',
                    color: '#f59e0b',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>warning</span>
                  <span>{t('planning.overallWarningAlert')}</span>
                </div>
              )}
            </div>
          ) : (
            <div
              className="surface-card"
              style={{
                padding: '16px',
                borderRadius: '16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px dashed var(--app-border)',
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>{t('planning.noOverallBudget')}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--app-muted)' }}>
                  {t('planning.noOverallBudgetDesc')}
                </p>
              </div>
              <button
                type="button"
                className="primary-button"
                style={{ padding: '6px 14px', fontSize: '13px' }}
                onClick={() => {
                  setEditId(null);
                  setSelectedCategoryId('overall');
                  setAmount('');
                  setRollover(true);
                  setEditorOpen(true);
                }}
              >
                {t('planning.setBudget')}
              </button>
            </div>
          )}

          {/* Category Budgets */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              {t('planning.categoryBudgets')}
            </h2>
            <span style={{ fontSize: '13px', color: 'var(--app-muted)' }}>
              {summaries.length} {t('planning.budgetsConfigured')}
            </span>
          </div>

          {summaries.length === 0 ? (
            <div className="surface-card empty-state" style={{ textAlign: 'center', padding: '36px 20px' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '48px', color: '#f97316' }}>
                donut_large
              </span>
              <p style={{ fontWeight: 600, fontSize: '16px', margin: '12px 0 4px' }}>
                {t('planning.noCategoryBudgets')}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--app-muted)', margin: 0 }}>
                {t('planning.noCategoryBudgetsDesc')}
              </p>
              <button
                className="primary-button"
                style={{ marginTop: '16px' }}
                onClick={openAdd}
              >
                {t('planning.addCategoryBudget')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {summaries.map((s) => {
                const label = s.category_key ? t(`categories.${s.category_key}`) : (s.category_name ?? '—');
                return (
                  <div
                    key={s.id ?? s.category_id}
                    className="surface-card"
                    style={{
                      padding: '16px',
                      borderRadius: '16px',
                      border: s.status === 'exceeded' ? '1px solid #f43f5e' : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          className="tile-icon"
                          style={{
                            background: `${s.category_color ?? '#14b8a6'}20`,
                            color: s.category_color ?? '#14b8a6',
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span className="material-symbols-rounded">{s.category_icon ?? 'category'}</span>
                        </span>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>{label}</p>
                          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--app-muted)' }}>
                            {formatMinor(s.spent_amount, currency, i18n.language)} / {formatMinor(s.effective_budget, currency, i18n.language)}
                          </p>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: `${getProgressColor(s.percentage)}20`,
                            color: getProgressColor(s.percentage),
                          }}
                        >
                          {s.percentage}%
                        </span>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '4px' }}>
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--app-muted)', padding: 0 }}
                            aria-label={t('common.edit')}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#f43f5e', padding: 0 }}
                            aria-label={t('common.delete')}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>delete</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div
                      style={{
                        width: '100%',
                        height: '6px',
                        borderRadius: '3px',
                        background: 'var(--app-border)',
                        overflow: 'hidden',
                        margin: '12px 0 6px',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, s.percentage)}%`,
                          height: '100%',
                          borderRadius: '3px',
                          background: getProgressColor(s.percentage),
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--app-muted)' }}>
                      <span>
                        {s.rollover_amount > 0 && `+${formatMinor(s.rollover_amount, currency, i18n.language)} ${t('planning.rolledOver')}`}
                      </span>
                      <span>
                        {s.remaining_amount >= 0
                          ? `${formatMinor(s.remaining_amount, currency, i18n.language)} ${t('planning.left')}`
                          : `${formatMinor(Math.abs(s.remaining_amount), currency, i18n.language)} ${t('planning.overspent')}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </IonContent>

      {/* Add / Edit Budget Modal */}
      <IonModal isOpen={editorOpen} onDidDismiss={() => setEditorOpen(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{editId ? t('planning.editBudget') : t('planning.newBudget')}</IonTitle>
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

            <label className="field-label">{t('planning.budgetCategory')}</label>
            <select
              className="text-input"
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              disabled={editId !== null}
            >
              <option value="overall">{t('planning.overallMonthlyBudget')}</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.i18n_key ? t(`categories.${c.i18n_key}`) : c.name}
                </option>
              ))}
            </select>

            <label className="field-label">{t('planning.budgetAmount')}</label>
            <input
              type="text"
              inputMode="decimal"
              className="text-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0' }}>
              <input
                type="checkbox"
                id="rolloverCheck"
                checked={rollover}
                onChange={(e) => setRollover(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <div>
                <label htmlFor="rolloverCheck" style={{ fontSize: '14px', fontWeight: 600 }}>
                  {t('planning.enableRollover')}
                </label>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--app-muted)' }}>
                  {t('planning.rolloverDesc')}
                </p>
              </div>
            </div>
          </div>
        </IonContent>
      </IonModal>
    </IonPage>
  );
}
