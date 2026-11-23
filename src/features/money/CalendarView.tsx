import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMoney } from './store';
import { getCalendarData } from '../../db/repository';
import type { CalendarDayData } from '../../db/types';
import { formatMinor } from '../../lib/money';

export function CalendarView({
  onAdd,
  onEdit,
  onDebt,
}: {
  onAdd: (dateMs?: number) => void;
  onEdit: (id: string) => void;
  onDebt: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const bookId = useMoney((s) => s.bookId);
  const books = useMoney((s) => s.books);
  const transactionsVersion = useMoney((s) => s.transactions);
  const currency = books.find((x) => x.id === bookId)?.currency ?? 'BDT';

  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-12
  const [selectedDateKey, setSelectedDateKey] = useState<string>(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  );
  const [calendarData, setCalendarData] = useState<Record<string, CalendarDayData>>({});

  useEffect(() => {
    if (!bookId) return;
    let active = true;
    void getCalendarData(bookId, currentYear, currentMonth).then((res) => {
      if (active) {
        setCalendarData(res);
      }
    });
    return () => {
      active = false;
    };
  }, [bookId, currentYear, currentMonth, transactionsVersion]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Build calendar matrix
  const { daysInMonth, firstDayOfWeek } = useMemo(() => {
    const days = new Date(currentYear, currentMonth, 0).getDate();
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 is Sunday
    return { daysInMonth: days, firstDayOfWeek: firstDay };
  }, [currentYear, currentMonth]);

  const monthLabel = useMemo(() => {
    const d = new Date(currentYear, currentMonth - 1, 1);
    return d.toLocaleDateString(i18n.language === 'bn' ? 'bn-BD' : 'en-GB', {
      month: 'long',
      year: 'numeric',
    });
  }, [currentYear, currentMonth, i18n.language]);

  const dayHeaders = useMemo(() => {
    return i18n.language === 'bn'
      ? ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }, [i18n.language]);

  const selectedTransactions = useMemo(() => {
    return calendarData[selectedDateKey]?.transactions ?? [];
  }, [calendarData, selectedDateKey]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Month Navigation */}
      <div
        className="surface-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: 16,
        }}
      >
        <button
          type="button"
          className="icon-button"
          onClick={handlePrevMonth}
          aria-label={t('common.previous')}
        >
          <span className="material-symbols-rounded">chevron_left</span>
        </button>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{monthLabel}</h2>
        <button
          type="button"
          className="icon-button"
          onClick={handleNextMonth}
          aria-label={t('common.next')}
        >
          <span className="material-symbols-rounded">chevron_right</span>
        </button>
      </div>

      {/* Calendar Grid */}
      <div
        className="surface-card"
        style={{
          padding: 12,
          borderRadius: 16,
        }}
      >
        {/* Days of week header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8, textAlign: 'center' }}>
          {dayHeaders.map((dh) => (
            <span key={dh} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--app-muted)' }}>
              {dh}
            </span>
          ))}
        </div>

        {/* Days matrix */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {/* Empty cells before month start */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} style={{ height: 48 }} />
          ))}

          {/* Days of month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const dayData = calendarData[dateKey];
            const isSelected = selectedDateKey === dateKey;
            const isToday =
              today.getFullYear() === currentYear &&
              today.getMonth() + 1 === currentMonth &&
              today.getDate() === dayNum;

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => setSelectedDateKey(dateKey)}
                style={{
                  height: 48,
                  padding: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: 10,
                  border: isSelected
                    ? '2px solid var(--app-primary)'
                    : isToday
                      ? '1px solid var(--app-primary)'
                      : '1px solid transparent',
                  background: isSelected
                    ? 'var(--app-primary-bg, rgba(14, 165, 233, 0.12))'
                    : 'transparent',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: isSelected || isToday ? 700 : 500,
                    color: isSelected ? 'var(--app-primary)' : 'var(--app-text)',
                  }}
                >
                  {dayNum}
                </span>

                {/* Badges / Dots */}
                <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  {dayData && dayData.income > 0 && (
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: '#22c55e',
                      }}
                    />
                  )}
                  {dayData && dayData.expense > 0 && (
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: '#f43f5e',
                      }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Transaction Breakdown */}
      <div className="surface-card" style={{ padding: 16, borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
              {selectedDateKey}
            </h3>
            {calendarData[selectedDateKey] && (
              <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>
                {t('calendar.net')}:{' '}
                <strong
                  style={{
                    color:
                      calendarData[selectedDateKey].net >= 0 ? '#22c55e' : '#f43f5e',
                  }}
                >
                  {formatMinor(calendarData[selectedDateKey].net, currency, i18n.language)}
                </strong>
              </span>
            )}
          </div>
          <button
            type="button"
            className="primary-button compact-button"
            onClick={() => {
              const dParts = selectedDateKey.split('-').map(Number);
              const ms = new Date(dParts[0], dParts[1] - 1, dParts[2]).getTime();
              onAdd(ms);
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span>
            {t('tabs.add')}
          </button>
        </div>

        {selectedTransactions.length === 0 ? (
          <p style={{ margin: '16px 0', textAlign: 'center', color: 'var(--app-muted)', fontSize: '0.9rem' }}>
            {t('calendar.noTransactionsOnDate')}
          </p>
        ) : (
          <div className="transaction-list">
            {selectedTransactions.map((tx) => (
              <div className="transaction-row" key={tx.id}>
                <button
                  className="transaction-main"
                  onClick={() => (tx.debt_id ? onDebt(tx.debt_id) : onEdit(tx.id))}
                >
                  <span
                    className="tile-icon"
                    style={{
                      background: tx.type === 'income' ? '#22c55e20' : '#f43f5e20',
                      color: tx.type === 'income' ? '#22c55e' : '#f43f5e',
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
                    <span className="transaction-title">
                      {tx.category_name ?? (tx.person_name ? `${t('home.payable')}: ${tx.person_name}` : tx.note || t('money.uncategorized'))}
                    </span>
                    <span className="transaction-account">
                      {tx.account_name || t('money.cashInHand')}
                      {tx.note ? ` • ${tx.note}` : ''}
                    </span>
                  </span>
                  <span
                    className={`transaction-amount ${tx.type === 'income' ? 'income' : 'expense'}`}
                  >
                    {formatMinor(tx.amount, tx.currency || currency, i18n.language)}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
