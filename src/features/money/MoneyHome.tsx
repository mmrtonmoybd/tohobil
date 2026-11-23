import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMoney } from './store';
import { formatMinor } from '../../lib/money';
import { addMinor } from '../../lib/money';
import { activityCashDelta, isDebtActivity } from '../../lib/activity';
import {
  getBudgetSummaries,
  listGoals,
  listRecurringRules,
} from '../../db/repository';
import type {
  BudgetSummary,
  GoalView,
  RecurringRuleView,
} from '../../db/types';
function Icon({ name }: { name: string }) {
  return <span className="material-symbols-rounded">{name}</span>;
}
import {
  isHideBalances,
  toggleHideBalances,
  subscribeHideBalances,
} from '../../lib/security';
import { updateWidgetBalance } from '../../lib/widget';
import { NotificationInboxModal } from '../notifications/NotificationInboxModal';

export function MoneyHome({
  onAdd,
  onAccounts,
  onDebts,
}: {
  onAdd: () => void;
  onAccounts: () => void;
  onDebts: (id?: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(() => !isHideBalances());
  const [now, setNow] = useState(() => Date.now());
  const [upcomingBills, setUpcomingBills] = useState<RecurringRuleView[]>([]);
  const [riskBudgets, setRiskBudgets] = useState<BudgetSummary[]>([]);
  const [activeGoals, setActiveGoals] = useState<GoalView[]>([]);

  useEffect(() => {
    return subscribeHideBalances((hide) => setVisible(!hide));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const books = useMoney((s) => s.books),
    bookId = useMoney((s) => s.bookId),
    setBook = useMoney((s) => s.setBook),
    accounts = useMoney((s) => s.accounts),
    balances = useMoney((s) => s.balances),
    total = useMoney((s) => s.total),
    cash = useMoney((s) => s.cash),
    unconvertedCurrencies = useMoney((s) => s.unconvertedCurrencies),
    income = useMoney((s) => s.income),
    expense = useMoney((s) => s.expense),
    receivable = useMoney((s) => s.receivable),
    payable = useMoney((s) => s.payable),
    debts = useMoney((s) => s.debts),
    transactions = useMoney((s) => s.transactions),
    assets = useMoney((s) => s.assets),
    investments = useMoney((s) => s.investments),
    error = useMoney((s) => s.error);

  useEffect(() => {
    if (!bookId) return;
    void Promise.all([
      listRecurringRules(bookId),
      getBudgetSummaries(bookId),
      listGoals(bookId),
    ]).then(([rules, budgetRes, goals]) => {
      const bills = rules.filter(
        (r) => r.next_run_at <= now + 7 * 86_400_000 || r.is_overdue,
      );
      setUpcomingBills(bills);

      const risks: BudgetSummary[] = [];
      if (
        budgetRes.overall &&
        (budgetRes.overall.status === 'warning' ||
          budgetRes.overall.status === 'exceeded')
      ) {
        risks.push(budgetRes.overall);
      }
      for (const s of budgetRes.summaries) {
        if (s.status === 'warning' || s.status === 'exceeded') {
          risks.push(s);
        }
      }
      setRiskBudgets(risks);
      setActiveGoals(goals.filter((g) => !g.is_achieved).slice(0, 3));
    });
  }, [bookId, now]);
  const currency = books.find((x) => x.id === bookId)?.currency ?? 'BDT';

  useEffect(() => {
    void updateWidgetBalance(total, currency, !visible || unconvertedCurrencies.length > 0, i18n.language);
  }, [total, currency, visible, unconvertedCurrencies, i18n.language]);

  const money = (value: number) =>
    visible ? formatMinor(value, currency, i18n.language) : '••••';
  const aggregateMoney = (value: number) =>
    unconvertedCurrencies.length && visible ? '—' : money(value);
  const balanceMap = new Map(balances.map((x) => [x.account_id, x.balance]));
  const upcoming = debts
    .filter(
      (x) =>
        x.outstanding > 0 &&
        x.next_due_date &&
        x.next_due_date <= now + 7 * 86_400_000,
    )
    .sort((a, b) => (a.next_due_date ?? 0) - (b.next_due_date ?? 0))
    .slice(0, 4);
  const upcomingAssets = assets
    .filter((a) => a.maturity_date && a.maturity_date <= now + 7 * 86_400_000)
    .sort((a, b) => (a.maturity_date ?? 0) - (b.maturity_date ?? 0))
    .slice(0, 4);
  return (
    <div className="page-pad">
      <div className="home-title-row">
        <div>
          <p className="eyebrow">{t('home.greeting')}</p>
          <h1 className="page-heading">{t('home.overview')}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setInboxOpen(true)}
            aria-label={t('notifications.inboxTitle')}
            style={{
              position: 'relative',
              background: 'var(--app-surface, #ffffff)',
              border: '1px solid var(--app-border, rgba(0,0,0,0.1))',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--app-text, inherit)',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 20 }}>
              notifications
            </span>
            {unreadNotifications > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  background: 'var(--app-danger, #ef4444)',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 16,
                  height: 16,
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>
          <select
            aria-label={t('money.switchBook')}
            className="book-picker"
            value={bookId ?? ''}
            onChange={(e) => void setBook(e.target.value)}
          >
            {books.map((book) => (
              <option value={book.id} key={book.id}>
                {book.name === 'personal' ? t('money.personal') : book.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <div className="surface-card error-card">
          {t('money.databaseError')}
        </div>
      )}
      {unconvertedCurrencies.length > 0 && <div className="surface-card error-card" role="status">
        {t('home.missingExchangeRate', { currencies: unconvertedCurrencies.join(', ') })}
      </div>}
      <div className="hero">
        <span className="hero-label">{t('home.totalBalance')}</span>
        <div className="hero-balance">{aggregateMoney(total)}</div>
        <span className="hero-foot">
          {books.find((x) => x.id === bookId)?.name === 'personal'
            ? t('money.personal')
            : books.find((x) => x.id === bookId)?.name}
        </span>
        <button
          className="hero-eye"
          onClick={() => toggleHideBalances()}
          aria-label={t(visible ? 'a11y.hideBalance' : 'a11y.showBalance')}
        >
          <Icon name={visible ? 'visibility_off' : 'visibility'} />
        </button>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <span
            className="stat-icon"
            style={{ background: '#0ea5e920', color: '#0ea5e9' }}
          >
            <Icon name="handshake" />
          </span>
          <p className="stat-label">{t('home.receivable')}</p>
          <p className="stat-value">{money(receivable)}</p>
        </div>
        <div className="stat-card">
          <span
            className="stat-icon"
            style={{ background: '#f59e0b20', color: '#f59e0b' }}
          >
            <Icon name="request_quote" />
          </span>
          <p className="stat-label">{t('home.payable')}</p>
          <p className="stat-value">{money(payable)}</p>
        </div>
        <div className="stat-card">
          <span
            className="stat-icon"
            style={{ background: '#14b8a620', color: '#14b8a6' }}
          >
            <Icon name="payments" />
          </span>
          <p className="stat-label">{t('home.cash')}</p>
          <p className="stat-value">{aggregateMoney(cash)}</p>
        </div>
        <div className="stat-card">
          <span
            className="stat-icon"
            style={{ background: '#22c55e20', color: '#22c55e' }}
          >
            <Icon name="south_west" />
          </span>
          <p className="stat-label">{t('home.income')}</p>
          <p className="stat-value">{aggregateMoney(income)}</p>
        </div>
        <div className="stat-card">
          <span
            className="stat-icon"
            style={{ background: '#f43f5e20', color: '#f43f5e' }}
          >
            <Icon name="north_east" />
          </span>
          <p className="stat-label">{t('home.expense')}</p>
          <p className="stat-value">{aggregateMoney(expense)}</p>
        </div>
        <div className="stat-card" onClick={() => navigate('/tabs/more/assets')} style={{ cursor: 'pointer' }}>
          <span
            className="stat-icon"
            style={{ background: '#6366f120', color: '#6366f1' }}
          >
            <Icon name="trending_up" />
          </span>
          <p className="stat-label">{t('home.investments')}</p>
          <p className="stat-value">{money(investments)}</p>
        </div>
        <div className="stat-card">
          <span
            className="stat-icon"
            style={{ background: '#6366f120', color: '#6366f1' }}
          >
            <Icon name="account_balance" />
          </span>
          <p className="stat-label">{t('home.netWorth')}</p>
          <p className="stat-value">
            {aggregateMoney(addMinor(total, receivable, investments, -payable))}
          </p>
        </div>
      </div>
      <div className="section-heading">
        <h2 className="section-title">{t('more.accounts')}</h2>
        <button className="text-button" onClick={onAccounts}>
          {t('money.more')}
        </button>
      </div>
      <div className="account-carousel">
        {accounts
          .filter((account) => !account.is_archived)
          .map((account) => (
            <div className="account-mini" key={account.id}>
              <span
                className="tile-icon"
                style={{
                  background: `${account.color}20`,
                  color: account.color,
                }}
              >
                <Icon name={account.icon} />
              </span>
              <div className="account-name">
                {account.name === 'cash' ? t('money.cashInHand') : account.name}
              </div>
              <div className="account-balance">
                {visible
                  ? formatMinor(balanceMap.get(account.id) ?? account.opening_balance, account.currency, i18n.language)
                  : '••••'}
              </div>
            </div>
          ))}
      </div>
      <h2 className="section-title">{t('home.thisMonth')}</h2>
      <div className="surface-card month-summary">
        <div>
          <small>{t('money.monthIncome')}</small>
          <strong className="income-text">+{money(income)}</strong>
        </div>
        <div>
          <small>{t('money.monthExpense')}</small>
          <strong className="expense-text">−{money(expense)}</strong>
        </div>
      </div>
      {income > 0 && (
        <div
          className="surface-card"
          onClick={() => navigate('/tabs/more/reports')}
          style={{
            padding: 12,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            borderLeft: `4px solid ${income >= expense ? '#22c55e' : '#f59e0b'}`,
            marginBottom: 16,
          }}
        >
          <span
            className="material-symbols-rounded"
            style={{ color: income >= expense ? '#22c55e' : '#f59e0b', fontSize: 24 }}
          >
            {income >= expense ? 'trending_up' : 'trending_down'}
          </span>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', fontSize: '0.9rem' }}>
              {income >= expense ? t('insights.savingsUpTitle') : t('insights.savingsDownTitle')}
            </strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>
              {t('reports.savingsRate')}: {income > 0 ? Math.max(0, Math.round(((income - expense) / income) * 100)) : 0}% • {t('more.reports')}
            </span>
          </div>
          <span className="material-symbols-rounded" style={{ color: 'var(--app-muted)', fontSize: 18 }}>
            chevron_right
          </span>
        </div>
      )}
      <div className="section-heading">
        <h2 className="section-title">{t('home.upcoming')}</h2>
        <button className="text-button" onClick={() => navigate('/tabs/more/bills')}>
          {t('money.more')}
        </button>
      </div>
      {upcoming.length || upcomingBills.length || upcomingAssets.length ? (
        <div className="surface-card recent-list">
          {upcomingAssets.map((asset) => (
            <button
              className="debt-person-row"
              key={asset.id}
              onClick={() => navigate('/tabs/more/assets')}
            >
              <span
                className="tile-icon"
                style={{
                  background: '#6366f120',
                  color: '#6366f1',
                }}
              >
                <Icon name="trending_up" />
              </span>
              <span>
                <strong>{asset.name}</strong>
                <small>
                  {asset.isMatured
                    ? t('wealth.matured')
                    : t('wealth.maturesInDays', { count: asset.daysToMaturity ?? 0 })}
                  {asset.institution ? ` • ${asset.institution}` : ''}
                </small>
              </span>
              <b>{money(asset.current_value)}</b>
            </button>
          ))}
          {upcomingBills.map((b) => (
            <button
              className="debt-person-row"
              key={b.id}
              onClick={() => navigate('/tabs/more/bills')}
            >
              <span
                className="tile-icon"
                style={{
                  background: `${b.category_color ?? '#f97316'}20`,
                  color: b.category_color ?? '#f97316',
                }}
              >
                <Icon name={b.category_icon ?? 'receipt'} />
              </span>
              <span>
                <strong>{b.name}</strong>
                <small>
                  {b.is_overdue
                    ? t('planning.overdue')
                    : new Date(b.next_run_at).toLocaleDateString(
                        i18n.language === 'bn' ? 'bn-BD' : 'en-GB',
                        { day: 'numeric', month: 'short' },
                      )}
                </small>
              </span>
              <b>{money(b.amount)}</b>
            </button>
          ))}
          {upcoming.map((debt) => (
            <button
              className="debt-person-row"
              key={debt.id}
              onClick={() => onDebts(debt.id)}
            >
              <span
                className="tile-icon"
                style={{
                  color:
                    debt.direction === 'receivable' ? '#0ea5e9' : '#f59e0b',
                }}
              >
                <Icon name="handshake" />
              </span>
              <span>
                <strong>{debt.person_name}</strong>
                <small>
                  {debt.overdue
                    ? t('debtFlow.overdue')
                    : new Date(debt.next_due_date!).toLocaleDateString(
                        i18n.language === 'bn' ? 'bn-BD' : 'en-GB',
                        { day: 'numeric', month: 'short' },
                      )}
                </small>
              </span>
              <b>{money(debt.outstanding)}</b>
            </button>
          ))}
        </div>
      ) : (
        <div className="surface-card compact-empty">
          <p>{t('home.upcomingEmpty')}</p>
        </div>
      )}

      {/* Budgets at Risk Section */}
      {riskBudgets.length > 0 && (
        <>
          <div className="section-heading">
            <h2 className="section-title" style={{ color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon name="warning" />
              {t('planning.budgetsAtRisk')}
            </h2>
            <button className="text-button" onClick={() => navigate('/tabs/more/budgets')}>
              {t('money.more')}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {riskBudgets.map((b) => (
              <div
                key={b.id ?? 'overall'}
                className="surface-card"
                style={{
                  padding: '12px 16px',
                  borderRadius: '14px',
                  border: b.status === 'exceeded' ? '1px solid #f43f5e' : '1px solid #f59e0b',
                  cursor: 'pointer',
                }}
                onClick={() => navigate('/tabs/more/budgets')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>
                    {b.category_key ? t(`categories.${b.category_key}`) : (b.category_name ?? t('planning.overallMonthlyBudget'))}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      color: b.status === 'exceeded' ? '#f43f5e' : '#f59e0b',
                    }}
                  >
                    {b.percentage}%
                  </span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: 'var(--app-border)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, b.percentage)}%`,
                      height: '100%',
                      background: b.status === 'exceeded' ? '#f43f5e' : '#f59e0b',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--app-muted)', marginTop: '4px' }}>
                  <span>{money(b.spent_amount)} / {money(b.effective_budget)}</span>
                  <span>{b.status === 'exceeded' ? t('planning.exceeded') : t('planning.nearLimit')}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Goals Progress Section */}
      {activeGoals.length > 0 && (
        <>
          <div className="section-heading">
            <h2 className="section-title">{t('planning.goalsProgress')}</h2>
            <button className="text-button" onClick={() => navigate('/tabs/more/goals')}>
              {t('money.more')}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {activeGoals.map((g) => (
              <div
                key={g.id}
                className="surface-card"
                style={{
                  padding: '12px 16px',
                  borderRadius: '14px',
                  cursor: 'pointer',
                }}
                onClick={() => navigate('/tabs/more/goals')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-rounded" style={{ color: g.color, fontSize: '20px' }}>
                      {g.icon}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{g.name}</span>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: g.color }}>
                    {g.percentage}%
                  </span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: 'var(--app-border)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, g.percentage)}%`,
                      height: '100%',
                      background: g.color,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--app-muted)', marginTop: '4px' }}>
                  <span>{money(g.current_amount)} / {money(g.target_amount)}</span>
                  <span>{t('planning.daysLeft', { count: g.days_remaining })}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <h2 className="section-title">{t('home.recent')}</h2>
      {transactions.length ? (
        <div className="surface-card recent-list">
          {transactions.slice(0, 4).map((tx) => (
            <div className="recent-item" key={tx.id}>
              <span
                className="tile-icon"
                style={{
                  background:
                    activityCashDelta(tx) > 0 ? '#22c55e20' : '#f43f5e20',
                  color: activityCashDelta(tx) > 0 ? '#22c55e' : '#f43f5e',
                }}
              >
                <Icon
                  name={
                    tx.type === 'transfer'
                      ? 'swap_horiz'
                      : tx.type === 'income'
                        ? 'south_west'
                        : 'north_east'
                  }
                />
              </span>
              <div>
                <strong>
                  {isDebtActivity(tx)
                    ? t(`debtFlow.events.${tx.type}`)
                    : (tx.category_name ??
                      (tx.category_key
                        ? t(`categories.${tx.category_key}`)
                        : t(`money.${tx.type}`)))}
                </strong>
                <small>
                  {tx.person_name ??
                    (tx.account_name === 'cash'
                      ? t('money.cashInHand')
                      : tx.account_name)}
                </small>
              </div>
              <b
                className={
                  activityCashDelta(tx) > 0
                    ? 'income-text'
                    : activityCashDelta(tx) < 0
                      ? 'expense-text'
                      : ''
                }
              >
                {activityCashDelta(tx) > 0
                  ? '+'
                  : activityCashDelta(tx) < 0
                    ? '−'
                    : ''}
                {money(tx.amount)}
              </b>
            </div>
          ))}
        </div>
      ) : (
        <div className="surface-card empty-state compact-empty">
          <p>{t('money.emptyTransactions')}</p>
          <button className="primary-button" onClick={onAdd}>
            {t('transactions.add')}
          </button>
        </div>
      )}
      <NotificationInboxModal
        isOpen={inboxOpen}
        onClose={() => setInboxOpen(false)}
        onUnreadChange={setUnreadNotifications}
      />
    </div>
  );
}
