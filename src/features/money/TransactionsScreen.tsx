import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { addMinor, formatMinor } from '../../lib/money';
import { listTransactions } from '../../db/repository';
import { useMoney } from './store';
import type { TransactionRow } from '../../db/types';
import { activityCashDelta, isDebtActivity } from '../../lib/activity';
import { CalendarView } from './CalendarView';
import { GlobalSearchModal } from '../search/GlobalSearchModal';
export function TransactionsScreen({
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
  const { t, i18n } = useTranslation();
  const transactionsVersion = useMoney((s) => s.transactions),
    books = useMoney((s) => s.books),
    bookId = useMoney((s) => s.bookId),
    accounts = useMoney((s) => s.accounts),
    categories = useMoney((s) => s.categories),
    tags = useMoney((s) => s.tags),
    deleteTransaction = useMoney((s) => s.deleteTransaction),
    restoreTransaction = useMoney((s) => s.restoreTransaction);
  const [search, setSearch] = useState(''),
    [type, setType] = useState(''),
    [account, setAccount] = useState(''),
    [category, setCategory] = useState(''),
    [tag, setTag] = useState(''),
    [hasAttachment, setHasAttachment] = useState(false),
    [viewMode, setViewMode] = useState<'list' | 'calendar'>('list'),
    [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [page, setPage] = useState<TransactionRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currency = books.find((x) => x.id === bookId)?.currency ?? 'BDT';
  useEffect(() => {
    if (!bookId) return;
    let active = true;
    void listTransactions({
      bookId,
      type: type || undefined,
      accountId: account || undefined,
      categoryId: category || undefined,
      tagId: tag || undefined,
      hasAttachment: hasAttachment || undefined,
      search,
      limit: 51,
    })
      .then((rows) => {
        if (!active) return;
        setPage(rows.slice(0, 50));
        setHasMore(rows.length > 50);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [bookId, type, account, category, tag, hasAttachment, search, transactionsVersion]);
  const loadMore = async () => {
    if (!bookId || loading || !hasMore) return;
    setLoading(true);
    try {
      const rows = await listTransactions({
        bookId,
        type: type || undefined,
        accountId: account || undefined,
        categoryId: category || undefined,
        tagId: tag || undefined,
        hasAttachment: hasAttachment || undefined,
        search,
        limit: 51,
        offset: page.length,
      });
      setPage((current) => [...current, ...rows.slice(0, 50)]);
      setHasMore(rows.length > 50);
    } finally {
      setLoading(false);
    }
  };
  const groups = useMemo(() => {
    const data: { date: string; items: TransactionRow[]; total: number }[] = [];
    for (const tx of page) {
      const key = new Date(tx.occurred_at).toLocaleDateString(
        i18n.language === 'bn' ? 'bn-BD' : 'en-GB',
        { day: 'numeric', month: 'long', year: 'numeric' },
      );
      let last = data[data.length - 1];
      if (!last || last.date !== key) {
        last = { date: key, items: [], total: 0 };
        data.push(last);
      }
      last.items.push(tx);
      last.total = addMinor(last.total, activityCashDelta(tx));
    }
    return data;
  }, [page, i18n.language]);
  // TanStack Virtual manages its own changing measurements.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => 66 + groups[index].items.length * 82,
    overscan: 3,
  });
  const remove = (id: string) => {
    void deleteTransaction(id).then(() =>
      onToast(t('money.transactionDeleted'), () => void restoreTransaction(id)),
    );
  };
  return (
    <div className="page-pad">
      <div className="screen-title-row">
        <h1 className="page-heading">{t('transactions.title')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="icon-button"
            onClick={() => setGlobalSearchOpen(true)}
            aria-label={t('search.title')}
            title={t('search.title')}
          >
            <span className="material-symbols-rounded">search</span>
          </button>
          <div className="kind-tabs" style={{ margin: 0, padding: 2, display: 'inline-flex' }}>
            <button
              type="button"
              className={`choice ${viewMode === 'list' ? 'selected' : ''}`}
              onClick={() => setViewMode('list')}
              style={{ padding: '6px 10px', height: 32 }}
              aria-label={t('transactions.listView')}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>view_list</span>
            </button>
            <button
              type="button"
              className={`choice ${viewMode === 'calendar' ? 'selected' : ''}`}
              onClick={() => setViewMode('calendar')}
              style={{ padding: '6px 10px', height: 32 }}
              aria-label={t('transactions.calendarView')}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>calendar_month</span>
            </button>
          </div>
          <button className="primary-button compact-button" onClick={onAdd}>
            {t('tabs.add')}
          </button>
        </div>
      </div>
      {viewMode === 'calendar' ? (
        <CalendarView onAdd={() => onAdd()} onEdit={onEdit} onDebt={onDebt} />
      ) : (
        <>
      <input
        className="search-box"
        aria-label={t('money.search')}
        placeholder={t('money.searchHint')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="filter-strip">
        <select
          aria-label={t('money.filterType')}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">{t('money.all')}</option>
          {(['expense', 'income', 'transfer'] as const).map((v) => (
            <option key={v} value={v}>
              {t(`money.${v}`)}
            </option>
          ))}
          <option value="debt">{t('debtFlow.loanActivity')}</option>
        </select>
        <select
          aria-label={t('money.filterAccount')}
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        >
          <option value="">{t('money.allAccounts')}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name === 'cash' ? t('money.cashInHand') : a.name}
            </option>
          ))}
        </select>
        <select
          aria-label={t('money.filterCategory')}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">{t('money.allCategories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name ?? t(`categories.${c.i18n_key}`)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('money.filterTag')}
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        >
          <option value="">{t('money.allTags')}</option>
          {tags.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`choice ${hasAttachment ? 'selected' : ''}`}
          onClick={() => setHasAttachment(!hasAttachment)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 38 }}
          aria-label={t('vault.filterProof')}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
            attach_file
          </span>
          {t('vault.hasProof')}
        </button>
      </div>
      {groups.length ? (
        <div className="transaction-scroll" ref={scrollRef}>
          <div
            style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const group = groups[item.index];
              return (
                <section
                  className="day-group"
                  key={group.date}
                  ref={virtualizer.measureElement}
                  data-index={item.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <div className="day-heading">
                    <strong>{group.date}</strong>
                    <span>
                      {formatMinor(group.total, currency, i18n.language)}
                    </span>
                  </div>
                  <div className="surface-card transaction-list">
                    {group.items.map((tx) => (
                      <div className="transaction-row" key={tx.id}>
                        <button
                          className="transaction-main"
                          onClick={() =>
                            tx.debt_id ? onDebt(tx.debt_id) : onEdit(tx.id)
                          }
                        >
                          <span
                            className="tile-icon"
                            style={{
                              background:
                                tx.type === 'income'
                                  ? '#22c55e20'
                                  : '#f43f5e20',
                              color:
                                tx.type === 'income' ? '#22c55e' : '#f43f5e',
                            }}
                          >
                            <span className="material-symbols-rounded">
                              {tx.type === 'transfer'
                                ? 'swap_horiz'
                                : tx.type === 'income'
                                  ? 'south_west'
                                  : 'north_east'}
                            </span>
                          </span>
                          <span className="transaction-meta">
                            <strong>
                              {isDebtActivity(tx)
                                ? t(`debtFlow.events.${tx.type}`)
                                : (tx.category_name ??
                                  (tx.category_key
                                    ? t(`categories.${tx.category_key}`)
                                    : t(`money.${tx.type}`)))}
                              {tx.split_count > 0 && ` · ${t('money.split')}`}
                              {(tx.attachment_count ?? 0) > 0 && (
                                <span
                                  className="material-symbols-rounded"
                                  style={{
                                    fontSize: 14,
                                    verticalAlign: 'middle',
                                    marginLeft: 4,
                                    color: 'var(--app-muted)',
                                  }}
                                  title={t('vault.hasProof')}
                                >
                                  attach_file
                                </span>
                              )}
                            </strong>
                            <small>
                              {tx.person_name
                                ? `${tx.person_name}${tx.note ? ` · ${tx.note}` : ''}`
                                : tx.note ||
                                  (tx.account_name === 'cash'
                                    ? t('money.cashInHand')
                                    : tx.account_name)}
                            </small>
                          </span>
                          <b
                            className={
                              activityCashDelta(tx) > 0
                                ? 'income-text'
                                : 'expense-text'
                            }
                          >
                            {activityCashDelta(tx) > 0
                              ? '+'
                              : activityCashDelta(tx) < 0
                                ? '−'
                                : ''}
                            {formatMinor(tx.amount, currency, i18n.language)}
                          </b>
                        </button>
                        {!isDebtActivity(tx) && (
                          <button
                            className="icon-button delete-small"
                            aria-label={t('money.deleteTransaction')}
                            onClick={() => remove(tx.id)}
                          >
                            <span className="material-symbols-rounded">
                              delete
                            </span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="surface-card empty-state">
          <div className="empty-icon">
            <span className="material-symbols-rounded">receipt_long</span>
          </div>
          <h2>
            {t(
              search || type || account || category || tag
                ? 'money.noResults'
                : 'transactions.emptyTitle',
            )}
          </h2>
          <p>{t('transactions.emptyBody')}</p>
          <button className="primary-button" onClick={onAdd}>
            {t('transactions.add')}
          </button>
        </div>
      )}
      {hasMore && (
        <button
          className="secondary-button load-more"
          disabled={loading}
          onClick={() => void loadMore()}
        >
          {t('money.hasMore')}
        </button>
      )}
        </>
      )}

      <GlobalSearchModal
        isOpen={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        onEditTransaction={onEdit}
        onViewDebt={onDebt}
      />
    </div>
  );
}
