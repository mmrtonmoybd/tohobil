import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import {
  addMinor,
  formatMinor,
  normalizeDigits,
  parseMinor,
  minorToInput,
} from '../../lib/money';
import { getDebtDetail, getPersonTimeline } from '../../db/debts';
import { useMoney } from '../money/store';
import type {
  DebtEntry,
  DebtInstallment,
  DebtView,
  Person,
} from '../../db/types';
import { sharePersonStatement } from '../../lib/statement';
import { enableDebtReminders } from '../../lib/debtReminders';

const shareWasCanceled = (error: unknown) =>
  error instanceof Error && /share cancel(l)?ed/i.test(error.message);

const localDate = (ms?: number | null) => {
  const d = ms ? new Date(ms) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dateMs = (value: string) =>
  value ? new Date(`${value}T12:00:00`).getTime() : null;
type Detail = Awaited<ReturnType<typeof getDebtDetail>>;
type Timeline = (DebtEntry & {
  direction: DebtView['direction'];
  account_name: string | null;
})[];

export function DebtsScreen({
  onToast,
}: {
  onToast: (message: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const bookId = useMoney((s) => s.bookId);
  const books = useMoney((s) => s.books);
  const people = useMoney((s) => s.people);
  const debts = useMoney((s) => s.debts);
  const accounts = useMoney((s) => s.accounts);
  const receivable = useMoney((s) => s.receivable);
  const payable = useMoney((s) => s.payable);
  const overdue = useMoney((s) => s.overdue);
  const savePerson = useMoney((s) => s.savePerson);
  const deletePerson = useMoney((s) => s.deletePerson);
  const createDebt = useMoney((s) => s.createDebt);
  const addDebtEntry = useMoney((s) => s.addDebtEntry);
  const settleDebt = useMoney((s) => s.settleDebt);
  const updateDebtDetails = useMoney((s) => s.updateDebtDetails);
  const currency = books.find((x) => x.id === bookId)?.currency ?? 'BDT';
  const money = (value: number) => formatMinor(value, currency, i18n.language);
  const date = (value: number) =>
    new Date(value).toLocaleDateString(
      i18n.language === 'bn' ? 'bn-BD' : 'en-GB',
      { day: 'numeric', month: 'short', year: 'numeric' },
    );
  const [personId, setPersonId] = useState<string | null>(null);
  const [debtId, setDebtId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [timeline, setTimeline] = useState<Timeline>([]);
  const [form, setForm] = useState<
    'person' | 'debt' | 'event' | 'details' | null
  >(null);
  const [editingPerson, setEditingPerson] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [direction, setDirection] = useState<'receivable' | 'payable'>(
    'receivable',
  );
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [when, setWhen] = useState(localDate());
  const [due, setDue] = useState('');
  const [rate, setRate] = useState('');
  const [installments, setInstallments] = useState('');
  const [firstDue, setFirstDue] = useState('');
  const [action, setAction] = useState<'more' | 'payment'>('payment');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const person = people.find((x) => x.id === personId) ?? null;
  const currentDebt = debts.find((x) => x.id === debtId) ?? null;
  const activeAccounts = accounts.filter((x) => !x.is_archived);
  const personDebts = useMemo(
    () => debts.filter((x) => x.person_id === personId),
    [debts, personId],
  );
  const peopleRows = useMemo(
    () =>
      people.map((person) => ({
        person,
        receivable: addMinor(
          ...debts
            .filter(
              (x) => x.person_id === person.id && x.direction === 'receivable',
            )
            .map((x) => x.outstanding),
        ),
        payable: addMinor(
          ...debts
            .filter(
              (x) => x.person_id === person.id && x.direction === 'payable',
            )
            .map((x) => x.outstanding),
        ),
        overdue: debts.some((x) => x.person_id === person.id && x.overdue),
      })),
    [people, debts],
  );
  useEffect(() => {
    const target = new URLSearchParams(location.search).get('debt');
    const debt = debts.find((x) => x.id === target);
    if (!debt) return;
    // Follow a transaction link into the corresponding person and debt.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPersonId(debt.person_id);
    setDebtId(debt.id);
  }, [location.search, debts]);

  useEffect(() => {
    if (!bookId || !debtId) return;
    let active = true;
    void getDebtDetail(bookId, debtId)
      .then((result) => {
        if (active) setDetail(result);
      })
      .catch(() => {
        if (active) setDetail(null);
      });
    return () => {
      active = false;
    };
  }, [bookId, debtId, debts]);
  useEffect(() => {
    if (!bookId || !personId) return;
    let active = true;
    void getPersonTimeline(bookId, personId)
      .then((result) => {
        if (active) setTimeline(result);
      })
      .catch(() => {
        if (active) setTimeline([]);
      });
    return () => {
      active = false;
    };
  }, [bookId, personId, debts]);
  const openPersonForm = (target?: Person) => {
    setEditingPerson(target?.id ?? null);
    setName(target?.name ?? '');
    setPhone(target?.phone ?? '');
    setNote(target?.note ?? '');
    setError('');
    setForm('person');
  };
  const openDebtForm = (targetPerson?: string) => {
    if (!people.length) {
      openPersonForm();
      return;
    }
    setPersonId(targetPerson ?? personId ?? people[0].id);
    setDirection('receivable');
    setAmount('');
    setAccountId('');
    setWhen(localDate());
    setDue('');
    setRate('');
    setInstallments('');
    setFirstDue('');
    setNote('');
    setError('');
    setForm('debt');
  };
  const openEventForm = (
    nextAction: 'more' | 'payment',
    amountMinor?: number,
  ) => {
    setAction(nextAction);
    setAmount(amountMinor ? minorToInput(amountMinor, currency) : '');
    setAccountId('');
    setWhen(localDate());
    setNote('');
    setError('');
    setForm('event');
  };
  const openDetailsForm = () => {
    setDue(localDate(detail?.debt.due_date));
    if (!detail?.debt.due_date) setDue('');
    setNote(detail?.debt.note ?? '');
    setError('');
    setForm('details');
  };
  const back = () => {
    if (form) {
      setForm(null);
      return;
    }
    if (debtId) {
      if (location.search) navigate('/tabs/debts', { replace: true });
      setDebtId(null);
      setDetail(null);
      return;
    }
    setPersonId(null);
  };
  const save = async () => {
    if (saving || !bookId) return;
    setSaving(true);
    setError('');
    try {
      if (form === 'person') {
        const id = await savePerson(
          { name, phone, note },
          editingPerson ?? undefined,
        );
        setPersonId(id);
        onToast(t('debtFlow.personSaved'));
      } else if (form === 'debt') {
        if (!personId) throw new Error('PERSON_NOT_FOUND');
        const id = await createDebt({
          personId,
          direction,
          amount: parseMinor(amount, currency),
          date: dateMs(when)!,
          dueDate: dateMs(due),
          interestRateBps: rate ? parseMinor(rate, 'USD') : 0,
          accountId: accountId || null,
          note,
          installmentCount: installments
            ? Number(normalizeDigits(installments))
            : undefined,
          firstInstallmentDate: dateMs(firstDue),
        });
        setDebtId(id);
        onToast(t('debtFlow.debtSaved'));
      } else if (form === 'event' && debtId) {
        await addDebtEntry(
          debtId,
          {
            amount: parseMinor(amount, currency),
            accountId: accountId || null,
            occurredAt: dateMs(when)!,
            note,
          },
          action,
        );
        onToast(t('debtFlow.paymentSaved'));
      } else if (form === 'details' && debtId) {
        await updateDebtDetails(debtId, { dueDate: dateMs(due), note });
        onToast(t('debtFlow.detailsSaved'));
      }
      setForm(null);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(
        t(
          `debtFlow.errors.${['INVALID_NAME', 'INVALID_PHONE', 'INVALID_AMOUNT', 'INVALID_DATE', 'INVALID_RATE', 'INVALID_INSTALLMENTS', 'OVERPAYMENT', 'PERSON_NOT_FOUND', 'ACCOUNT_NOT_FOUND', 'DEBT_SETTLED'].includes(code) ? code : 'GENERIC'}`,
        ),
      );
    } finally {
      setSaving(false);
    }
  };
  const removePerson = async () => {
    if (!personId || !window.confirm(t('debtFlow.deletePersonConfirm'))) return;
    try {
      await deletePerson(personId);
      setPersonId(null);
      onToast(t('debtFlow.personDeleted'));
    } catch {
      setError(t('debtFlow.errors.PERSON_HAS_DEBTS'));
    }
  };
  const writeOff = async () => {
    if (!debtId || !window.confirm(t('debtFlow.writeOffConfirm'))) return;
    try {
      await settleDebt(debtId);
      window.dispatchEvent(
        new CustomEvent('tohobil:positive-moment', { detail: 'debt_settled' }),
      );
      onToast(t('debtFlow.settled'));
    } catch {
      setError(t('debtFlow.errors.GENERIC'));
    }
  };
  const remind = async () => {
    if (!person || !currentDebt) return;
    const message = t(
      currentDebt.direction === 'receivable'
        ? 'debtFlow.reminderText'
        : 'debtFlow.reminderTextPayable',
      {
        name: person.name,
        amount: money(currentDebt.outstanding),
        date: currentDebt.due_date
          ? date(currentDebt.due_date)
          : t('debtFlow.noDueDate'),
      },
    );
    try {
      await Share.share({ text: message, title: t('debtFlow.remind') });
    } catch (error) {
      if (shareWasCanceled(error)) return;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(message);
          onToast(t('debtFlow.reminderCopied'));
        } catch {
          onToast(t('debtFlow.errors.SHARE'));
        }
      } else onToast(t('debtFlow.errors.SHARE'));
    }
  };
  const statement = async () => {
    if (!person || !bookId) return;
    try {
      await sharePersonStatement(
        person,
        personDebts,
        timeline,
        currency,
        i18n.language,
        t,
      );
    } catch (error) {
      if (shareWasCanceled(error)) return;
      onToast(t('debtFlow.errors.SHARE'));
    }
  };
  const enableReminders = async () => {
    try {
      await enableDebtReminders(i18n.language, t);
      onToast(t('debtFlow.remindersEnabled'));
    } catch {
      onToast(t('debtFlow.errors.NOTIFICATION'));
    }
  };
  const summary = (label: string, value: number, color: string) => (
    <div className="debt-summary-card" style={{ borderColor: color }}>
      <small>{label}</small>
      <strong>{money(value)}</strong>
    </div>
  );
  return (
    <div className="page-pad debts-screen">
      {(personId || form) && (
        <button className="text-button debt-back" onClick={back}>
          <span className="material-symbols-rounded">arrow_back</span>
          {t('feature.back')}
        </button>
      )}
      {form ? (
        <section className="surface-card debt-form">
          <h1 className="page-heading">
            {t(
              form === 'person'
                ? editingPerson
                  ? 'debtFlow.editPerson'
                  : 'debtFlow.addPerson'
                : form === 'debt'
                  ? 'debtFlow.addDebt'
                  : form === 'details'
                    ? 'debtFlow.editDetails'
                    : action === 'more'
                      ? 'debtFlow.more'
                      : 'debtFlow.payment',
            )}
          </h1>
          {form === 'person' ? (
            <>
              <label>
                {t('debtFlow.name')}
                <input
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                {t('debtFlow.phone')}
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('debtFlow.phoneHint')}
                />
              </label>
              <label>
                {t('debtFlow.note')}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </>
          ) : form === 'debt' ? (
            <>
              <label>
                {t('debtFlow.person')}
                <select
                  value={personId ?? ''}
                  onChange={(e) => setPersonId(e.target.value)}
                >
                  {people.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('debtFlow.direction')}
                <select
                  value={direction}
                  onChange={(e) =>
                    setDirection(e.target.value as typeof direction)
                  }
                >
                  <option value="receivable">{t('home.receivable')}</option>
                  <option value="payable">{t('home.payable')}</option>
                </select>
              </label>
              <label>
                {t('debtFlow.amount')}
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label>
                {t('debtFlow.date')}
                <input
                  type="date"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </label>
              <label>
                {t('debtFlow.dueDate')}
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </label>
              <label>
                {t('debtFlow.interestRate')}
                <input
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder={t('debtFlow.optional')}
                />
              </label>
              <label>
                {t('debtFlow.installments')}
                <input
                  inputMode="numeric"
                  min="1"
                  max="120"
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                  placeholder={t('debtFlow.optional')}
                />
              </label>
              {!!installments && (
                <label>
                  {t('debtFlow.firstDue')}
                  <input
                    type="date"
                    value={firstDue}
                    onChange={(e) => setFirstDue(e.target.value)}
                  />
                </label>
              )}
              <label>
                {t('debtFlow.account')}
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="">{t('debtFlow.recordOnly')}</option>
                  {activeAccounts.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name === 'cash' ? t('money.cashInHand') : x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('debtFlow.note')}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </>
          ) : form === 'details' ? (
            <>
              <label>
                {t('debtFlow.dueDate')}
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </label>
              <label>
                {t('debtFlow.note')}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <p>
                {currentDebt?.person_name} ·{' '}
                {t(`debtFlow.${currentDebt?.direction}`)}
              </p>
              <label>
                {t('debtFlow.amount')}
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label>
                {t('debtFlow.date')}
                <input
                  type="date"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </label>
              <label>
                {t('debtFlow.account')}
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="">{t('debtFlow.recordOnly')}</option>
                  {activeAccounts.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name === 'cash' ? t('money.cashInHand') : x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('debtFlow.note')}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button
            className="primary-button"
            disabled={saving}
            onClick={() => void save()}
          >
            {t('money.save')}
          </button>
        </section>
      ) : debtId && currentDebt ? (
        <>
          <div className="debt-detail-hero">
            <small>{currentDebt.person_name}</small>
            <h1>{money(currentDebt.outstanding)}</h1>
            <p>
              {currentDebt.outstanding
                ? t(
                    currentDebt.direction === 'receivable'
                      ? 'debtFlow.owesYou'
                      : 'debtFlow.youOwe',
                    { name: currentDebt.person_name },
                  )
                : t('debtFlow.settledStatus')}
            </p>
            {currentDebt.overdue && (
              <b className="debt-overdue">{t('debtFlow.overdue')}</b>
            )}
          </div>
          <div className="debt-actions">
            <button
              onClick={() => openEventForm('payment')}
              disabled={!currentDebt.outstanding}
            >
              {t(
                currentDebt.direction === 'receivable'
                  ? 'debtFlow.received'
                  : 'debtFlow.paid',
              )}
            </button>
            <button
              onClick={() => openEventForm('more')}
              disabled={!!currentDebt.settled_at}
            >
              {t(
                currentDebt.direction === 'receivable'
                  ? 'debtFlow.gaveMore'
                  : 'debtFlow.tookMore',
              )}
            </button>
            <button
              onClick={() => void remind()}
              disabled={!currentDebt.outstanding}
            >
              {t('debtFlow.remind')}
            </button>
          </div>
          <div className="debt-facts surface-card">
            <div>
              <span>{t('debtFlow.principal')}</span>
              <strong>{money(currentDebt.principal)}</strong>
            </div>
            <div>
              <span>{t('debtFlow.interest')}</span>
              <strong>{money(currentDebt.interest)}</strong>
            </div>
            <div>
              <span>{t('debtFlow.dueDate')}</span>
              <strong>
                {currentDebt.due_date
                  ? date(currentDebt.due_date)
                  : t('debtFlow.noDueDate')}
              </strong>
            </div>
            <div>
              <span>{t('debtFlow.interestRate')}</span>
              <strong>
                {minorToInput(currentDebt.interest_rate_bps, 'USD')}%
              </strong>
            </div>
          </div>
          {Capacitor.isNativePlatform() && (
            <p className="debt-reminder-explainer">
              {t('debtFlow.reminderExplanation')}
            </p>
          )}
          <div className="debt-secondary-actions">
            <button onClick={openDetailsForm}>
              {t('debtFlow.editDetails')}
            </button>
            {Capacitor.isNativePlatform() && (
              <button onClick={() => void enableReminders()}>
                {t('debtFlow.enableReminders')}
              </button>
            )}
            <button
              onClick={() => void writeOff()}
              disabled={!currentDebt.outstanding}
            >
              {t('debtFlow.writeOff')}
            </button>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {!!detail?.installments.length && (
            <>
              <h2 className="section-title">{t('debtFlow.schedule')}</h2>
              <div className="surface-card debt-list">
                {detail.installments.map(
                  (x: DebtInstallment, index: number) => (
                    <div className="debt-installment" key={x.id}>
                      <div>
                        <strong>
                          {t('debtFlow.installmentNumber', {
                            number: index + 1,
                          })}
                        </strong>
                        <small>
                          {date(x.due_date)} · {money(x.paid_amount)} /{' '}
                          {money(x.amount)}
                        </small>
                      </div>
                      <button
                        disabled={
                          x.paid_amount >= x.amount || !currentDebt.outstanding
                        }
                        onClick={() =>
                          openEventForm(
                            'payment',
                            addMinor(
                              x.amount - x.paid_amount,
                              currentDebt.interest,
                            ),
                          )
                        }
                      >
                        {x.paid_amount >= x.amount
                          ? t('debtFlow.paidStatus')
                          : currentDebt.settled_at
                            ? t('debtFlow.waived')
                            : t('debtFlow.markPaid')}
                      </button>
                    </div>
                  ),
                )}
              </div>
            </>
          )}
          <h2 className="section-title">{t('debtFlow.timeline')}</h2>
          <div className="surface-card debt-list">
            {detail?.entries.map((x) => (
              <div className="debt-event" key={x.id}>
                <span className="material-symbols-rounded">
                  {x.kind === 'write_off'
                    ? 'cancel'
                    : x.kind === 'lend' || x.kind === 'repay'
                      ? 'north_east'
                      : 'south_west'}
                </span>
                <div>
                  <strong>{t(`debtFlow.events.${x.kind}`)}</strong>
                  <small>
                    {date(x.occurred_at)} ·{' '}
                    {x.account_name
                      ? x.account_name === 'cash'
                        ? t('money.cashInHand')
                        : x.account_name
                      : t('debtFlow.recordOnly')}
                    {x.note ? ` · ${x.note}` : ''}
                  </small>
                </div>
                <b>{money(x.amount)}</b>
              </div>
            ))}
          </div>
        </>
      ) : personId && person ? (
        <>
          <div className="screen-title-row">
            <div>
              <p className="eyebrow">{t('debts.subtitle')}</p>
              <h1 className="page-heading">{person.name}</h1>
            </div>
            <button
              className="primary-button compact-button"
              onClick={() => openDebtForm(personId)}
            >
              {t('debtFlow.addDebt')}
            </button>
          </div>
          {person.phone && (
            <a className="debt-call" href={`tel:${person.phone}`}>
              {t('debtFlow.call')} · {person.phone}
            </a>
          )}
          <div className="debt-secondary-actions">
            <button onClick={() => openPersonForm(person)}>
              {t('debtFlow.editPerson')}
            </button>
            <button onClick={() => void statement()}>
              {t('debtFlow.statement')}
            </button>
            <button onClick={() => void removePerson()}>
              {t('debtFlow.deletePerson')}
            </button>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <h2 className="section-title">{t('debtFlow.activeDebts')}</h2>
          <div className="surface-card debt-list">
            {personDebts.map((x) => (
              <button
                className="debt-person-row"
                key={x.id}
                onClick={() => setDebtId(x.id)}
              >
                <span
                  className="tile-icon"
                  style={{
                    color: x.direction === 'receivable' ? '#0ea5e9' : '#f59e0b',
                  }}
                >
                  <span className="material-symbols-rounded">
                    {x.direction === 'receivable' ? 'south_west' : 'north_east'}
                  </span>
                </span>
                <span>
                  <strong>{t(`debtFlow.${x.direction}`)}</strong>
                  <small>
                    {x.due_date ? date(x.due_date) : t('debtFlow.noDueDate')}
                    {x.overdue ? ` · ${t('debtFlow.overdue')}` : ''}
                  </small>
                </span>
                <b>{money(x.outstanding)}</b>
              </button>
            ))}
          </div>
          <h2 className="section-title">{t('debtFlow.timeline')}</h2>
          <div className="surface-card debt-list">
            {timeline.map((x) => (
              <div className="debt-event" key={x.id}>
                <span className="material-symbols-rounded">
                  {x.kind === 'write_off' ? 'cancel' : 'sync_alt'}
                </span>
                <div>
                  <strong>{t(`debtFlow.events.${x.kind}`)}</strong>
                  <small>
                    {date(x.occurred_at)} ·{' '}
                    {x.account_name === 'cash'
                      ? t('money.cashInHand')
                      : (x.account_name ?? t('debtFlow.recordOnly'))}
                  </small>
                </div>
                <b>{money(x.amount)}</b>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="screen-title-row">
            <div>
              <p className="eyebrow">{t('debts.subtitle')}</p>
              <h1 className="page-heading">{t('debts.title')}</h1>
            </div>
            <button
              className="primary-button compact-button"
              onClick={() => openDebtForm()}
            >
              {t('debtFlow.addDebt')}
            </button>
          </div>
          <div className="debt-summary-grid">
            {summary(t('home.receivable'), receivable, '#0ea5e9')}
            {summary(t('home.payable'), payable, '#f59e0b')}
            {summary(t('debtFlow.overdue'), overdue, '#f43f5e')}
          </div>
          <div className="section-heading">
            <h2 className="section-title">{t('debtFlow.people')}</h2>
            <button className="text-button" onClick={() => openPersonForm()}>
              {t('debtFlow.addPerson')}
            </button>
          </div>
          {peopleRows.length ? (
            <div className="surface-card debt-list">
              {peopleRows.map(({ person, receivable, payable, overdue }) => (
                <button
                  className="debt-person-row"
                  key={person.id}
                  onClick={() => setPersonId(person.id)}
                >
                  <span className="tile-icon debt-avatar">
                    {person.name.slice(0, 1).toLocaleUpperCase(i18n.language)}
                  </span>
                  <span>
                    <strong>{person.name}</strong>
                    <small>
                      {overdue
                        ? t('debtFlow.overdue')
                        : (person.phone ??
                          (receivable && payable
                            ? t('debtFlow.activeDebts')
                            : receivable
                              ? t('debtFlow.receivable')
                              : payable
                                ? t('debtFlow.payable')
                                : t('debtFlow.noActiveDebts')))}
                    </small>
                  </span>
                  <span className="debt-person-amount">
                    {receivable > 0 && (
                      <b className="receivable-text">{money(receivable)}</b>
                    )}
                    {payable > 0 && (
                      <b className="payable-text">{money(payable)}</b>
                    )}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="surface-card empty-state">
              <div className="empty-icon">
                <span className="material-symbols-rounded">handshake</span>
              </div>
              <h2>{t('debts.emptyTitle')}</h2>
              <p>{t('debts.emptyBody')}</p>
              <button
                className="primary-button"
                onClick={() => openPersonForm()}
              >
                {t('debtFlow.addPerson')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
