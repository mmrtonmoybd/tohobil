import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { getDatabase, transaction } from './connection';
import { uuidv7 } from '../lib/ids';
import { addMinor, normalizeDigits } from '../lib/money';
import { debtBalance, installmentAmounts, monthFrom } from '../lib/debt';
import { getCurrentUserId } from './repository';
import { syncEngine } from '../sync/engine';
import type {
  Account,
  Book,
  Debt,
  DebtEntry,
  DebtInstallment,
  DebtView,
  Person,
} from './types';

async function rows<T>(
  db: SQLiteDBConnection,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return ((await db.query(sql, params)).values ?? []) as T[];
}
async function run(
  db: SQLiteDBConnection,
  sql: string,
  params: unknown[],
): Promise<void> {
  await db.run(sql, params, false);
}
const validAmount = (amount: number) =>
  Number.isSafeInteger(amount) && amount > 0;

export async function listPeople(bookId: string): Promise<Person[]> {
  return rows<Person>(
    await getDatabase(),
    'SELECT * FROM people WHERE user_id=? AND book_id=? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE',
    [getCurrentUserId(), bookId],
  );
}
export async function savePerson(
  bookId: string,
  input: { name: string; phone?: string; note?: string },
  id?: string,
): Promise<string> {
  const name = input.name.trim();
  if (!name || name.length > 100) throw new Error('INVALID_NAME');
  const rawPhone = normalizeDigits(input.phone?.trim() ?? '');
  const phone = rawPhone
    ? (await import('libphonenumber-js/min')).parsePhoneNumberFromString(
        rawPhone,
      )
    : undefined;
  if (rawPhone && (!phone || !phone.isValid()))
    throw new Error('INVALID_PHONE');
  const res = await transaction(async (db) => {
    const book = (
      await rows<Book>(
        db,
        'SELECT * FROM books WHERE id=? AND user_id=? AND deleted_at IS NULL',
        [bookId, getCurrentUserId()],
      )
    )[0];
    if (!book) throw new Error('BOOK_NOT_FOUND');
    const now = Date.now();
    if (id) {
      const existing = (
        await rows<Person>(
          db,
          'SELECT * FROM people WHERE id=? AND book_id=? AND user_id=? AND deleted_at IS NULL',
          [id, bookId, getCurrentUserId()],
        )
      )[0];
      if (!existing) throw new Error('PERSON_NOT_FOUND');
      await run(
        db,
        'UPDATE people SET name=?,phone=?,note=?,updated_at=?,sync_state=? WHERE id=?',
        [
          name,
          phone?.number ?? null,
          input.note?.trim() ?? '',
          now,
          'pending',
          id,
        ],
      );
      return id;
    }
    const newId = uuidv7();
    await run(
      db,
      'INSERT INTO people(id,user_id,book_id,name,phone,note,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,0)',
      [
        newId,
        getCurrentUserId(),
        bookId,
        name,
        phone?.number ?? null,
        input.note?.trim() ?? '',
        now,
        now,
        'pending',
      ],
    );
    return newId;
  });
  syncEngine.notifyWrite();
  return res;
}
export async function deletePerson(bookId: string, id: string): Promise<void> {
  await transaction(async (db) => {
    const history = await rows<{ id: string }>(
      db,
      'SELECT id FROM debts WHERE person_id=? AND book_id=? AND deleted_at IS NULL LIMIT 1',
      [id, bookId],
    );
    if (history.length) throw new Error('PERSON_HAS_DEBTS');
    await run(
      db,
      'UPDATE people SET deleted_at=?,updated_at=?,sync_state=? WHERE id=? AND book_id=? AND user_id=? AND deleted_at IS NULL',
      [Date.now(), Date.now(), 'pending', id, bookId, getCurrentUserId()],
    );
  });
  syncEngine.notifyWrite();
}

export type CreateDebtInput = {
  personId: string;
  direction: Debt['direction'];
  amount: number;
  date: number;
  dueDate?: number | null;
  interestRateBps?: number;
  note?: string;
  accountId?: string | null;
  installmentCount?: number;
  firstInstallmentDate?: number | null;
};
async function accountInBook(
  db: SQLiteDBConnection,
  bookId: string,
  accountId: string | null | undefined,
): Promise<Account | null> {
  if (!accountId) return null;
  const account = (
    await rows<Account>(
      db,
      'SELECT * FROM accounts WHERE id=? AND book_id=? AND user_id=? AND deleted_at IS NULL AND is_archived=0',
      [accountId, bookId, getCurrentUserId()],
    )
  )[0];
  if (!account) throw new Error('ACCOUNT_NOT_FOUND');
  return account;
}
export async function createDebt(
  bookId: string,
  input: CreateDebtInput,
): Promise<string> {
  if (
    !validAmount(input.amount) ||
    !Number.isSafeInteger(input.date) ||
    input.date > Date.now() + 86_400_000
  )
    throw new Error('INVALID_AMOUNT');
  if (input.direction !== 'receivable' && input.direction !== 'payable')
    throw new Error('INVALID_DIRECTION');
  const rate = input.interestRateBps ?? 0;
  if (!Number.isSafeInteger(rate) || rate < 0 || rate > 100_000)
    throw new Error('INVALID_RATE');
  const amounts =
    input.installmentCount === undefined
      ? []
      : installmentAmounts(input.amount, input.installmentCount);
  if (amounts.length && !input.firstInstallmentDate)
    throw new Error('INVALID_DATE');
  const res = await transaction(async (db) => {
    const book = (
      await rows<Book>(
        db,
        'SELECT * FROM books WHERE id=? AND user_id=? AND deleted_at IS NULL',
        [bookId, getCurrentUserId()],
      )
    )[0];
    const person = (
      await rows<Person>(
        db,
        'SELECT * FROM people WHERE id=? AND book_id=? AND user_id=? AND deleted_at IS NULL',
        [input.personId, bookId, getCurrentUserId()],
      )
    )[0];
    if (!book || !person) throw new Error('PERSON_NOT_FOUND');
    const account = await accountInBook(db, bookId, input.accountId);
    if (account && account.currency !== book.currency)
      throw new Error('INVALID_CURRENCY');
    const now = Date.now(),
      id = uuidv7();
    await run(
      db,
      'INSERT INTO debts(id,user_id,book_id,person_id,direction,amount,currency,date,due_date,interest_rate_bps,note,settled_at,write_off_amount,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)',
      [
        id,
        getCurrentUserId(),
        bookId,
        input.personId,
        input.direction,
        input.amount,
        book.currency,
        input.date,
        input.dueDate ?? null,
        rate,
        input.note?.trim() ?? '',
        null,
        0,
        now,
        now,
        'pending',
      ],
    );
    await run(
      db,
      'INSERT INTO debt_entries(id,user_id,book_id,debt_id,kind,amount,currency,account_id,occurred_at,note,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,0)',
      [
        uuidv7(),
        getCurrentUserId(),
        bookId,
        id,
        input.direction === 'receivable' ? 'lend' : 'borrow',
        input.amount,
        book.currency,
        account?.id ?? null,
        input.date,
        input.note?.trim() ?? '',
        now,
        now,
        'pending',
      ],
    );
    for (let index = 0; index < amounts.length; index++) {
      const due = monthFrom(input.firstInstallmentDate!, index);
      await run(
        db,
        'INSERT INTO debt_installments(id,user_id,book_id,debt_id,due_date,amount,paid_amount,paid_event_id,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,0)',
        [
          uuidv7(),
          getCurrentUserId(),
          bookId,
          id,
          due,
          amounts[index],
          0,
          null,
          now,
          now,
          'pending',
        ],
      );
    }
    return id;
  });
  syncEngine.notifyWrite();
  return res;
}

async function currentDebt(
  db: SQLiteDBConnection,
  bookId: string,
  id: string,
): Promise<{ debt: Debt; entries: DebtEntry[] }> {
  const debt = (
    await rows<Debt>(
      db,
      'SELECT * FROM debts WHERE id=? AND book_id=? AND user_id=? AND deleted_at IS NULL',
      [id, bookId, getCurrentUserId()],
    )
  )[0];
  if (!debt) throw new Error('DEBT_NOT_FOUND');
  const entries = await rows<DebtEntry>(
    db,
    'SELECT * FROM debt_entries WHERE debt_id=? AND deleted_at IS NULL ORDER BY occurred_at,rowid',
    [id],
  );
  return { debt, entries };
}
export async function listDebts(
  bookId: string,
  asOf = Date.now(),
): Promise<DebtView[]> {
  const db = await getDatabase();
  const debts = await rows<
    Debt & { person_name: string; person_phone: string | null }
  >(
    db,
    'SELECT d.*,p.name AS person_name,p.phone AS person_phone FROM debts d JOIN people p ON p.id=d.person_id WHERE d.book_id=? AND d.user_id=? AND d.deleted_at IS NULL ORDER BY d.updated_at DESC',
    [bookId, getCurrentUserId()],
  );
  const unpaidInstallments = await rows<{ debt_id: string; due_date: number }>(
    db,
    'SELECT debt_id,due_date FROM debt_installments WHERE book_id=? AND user_id=? AND deleted_at IS NULL AND paid_amount<amount',
    [bookId, getCurrentUserId()],
  );
  const overdueInstallments = new Set(
    unpaidInstallments.filter((x) => x.due_date < asOf).map((x) => x.debt_id),
  );
  const nextInstallment = new Map<string, number>();
  for (const item of unpaidInstallments) {
    const current = nextInstallment.get(item.debt_id);
    if (current === undefined || item.due_date < current)
      nextInstallment.set(item.debt_id, item.due_date);
  }
  const entries = await rows<DebtEntry>(
    db,
    'SELECT e.* FROM debt_entries e JOIN debts d ON d.id=e.debt_id WHERE d.book_id=? AND d.user_id=? AND d.deleted_at IS NULL AND e.deleted_at IS NULL ORDER BY e.occurred_at,e.rowid',
    [bookId, getCurrentUserId()],
  );
  const byDebt = new Map<string, DebtEntry[]>();
  for (const entry of entries)
    byDebt.set(entry.debt_id, [...(byDebt.get(entry.debt_id) ?? []), entry]);
  return debts.map((debt) => {
    const balance = debtBalance(
      byDebt.get(debt.id) ?? [],
      debt.interest_rate_bps,
      Math.min(asOf, debt.settled_at ?? asOf),
    );
    const next = Math.min(
      debt.due_date ?? Infinity,
      nextInstallment.get(debt.id) ?? Infinity,
    );
    return {
      ...debt,
      ...balance,
      next_due_date:
        balance.outstanding > 0 && Number.isFinite(next) ? next : null,
      overdue:
        balance.outstanding > 0 &&
        ((!!debt.due_date && debt.due_date < asOf) ||
          overdueInstallments.has(debt.id)),
    };
  });
}
export async function getDebtDetail(
  bookId: string,
  id: string,
): Promise<{
  debt: DebtView;
  person: Person;
  entries: (DebtEntry & { account_name: string | null })[];
  installments: DebtInstallment[];
}> {
  const db = await getDatabase();
  const debt = (await listDebts(bookId)).find((x) => x.id === id);
  if (!debt) throw new Error('DEBT_NOT_FOUND');
  const person = (
    await rows<Person>(
      db,
      'SELECT * FROM people WHERE id=? AND book_id=? AND user_id=? AND deleted_at IS NULL',
      [debt.person_id, bookId, getCurrentUserId()],
    )
  )[0];
  const entries = await rows<DebtEntry & { account_name: string | null }>(
    db,
    'SELECT e.*,a.name AS account_name FROM debt_entries e LEFT JOIN accounts a ON a.id=e.account_id WHERE e.debt_id=? AND e.deleted_at IS NULL ORDER BY e.occurred_at DESC,e.rowid DESC',
    [id],
  );
  const installments = await rows<DebtInstallment>(
    db,
    'SELECT * FROM debt_installments WHERE debt_id=? AND deleted_at IS NULL ORDER BY due_date,id',
    [id],
  );
  return { debt, person, entries, installments };
}
export async function getPersonTimeline(
  bookId: string,
  personId: string,
): Promise<
  (DebtEntry & { direction: Debt['direction']; account_name: string | null })[]
> {
  return rows(
    await getDatabase(),
    'SELECT e.*,d.direction,a.name AS account_name FROM debt_entries e JOIN debts d ON d.id=e.debt_id LEFT JOIN accounts a ON a.id=e.account_id WHERE d.book_id=? AND d.person_id=? AND d.deleted_at IS NULL AND e.deleted_at IS NULL ORDER BY e.occurred_at DESC,e.rowid DESC',
    [bookId, personId],
  );
}
export async function listUpcomingInstallments(
  bookId: string,
): Promise<(DebtInstallment & { person_name: string; currency: string })[]> {
  return rows(
    await getDatabase(),
    'SELECT i.*,p.name AS person_name,d.currency FROM debt_installments i JOIN debts d ON d.id=i.debt_id JOIN people p ON p.id=d.person_id WHERE i.book_id=? AND i.user_id=? AND i.deleted_at IS NULL AND i.paid_amount<i.amount AND d.deleted_at IS NULL AND d.settled_at IS NULL ORDER BY i.due_date LIMIT 100',
    [bookId, getCurrentUserId()],
  );
}
export type DebtEventInput = {
  amount: number;
  accountId?: string | null;
  occurredAt?: number;
  note?: string;
};
export async function addDebtEntry(
  bookId: string,
  id: string,
  input: DebtEventInput,
  action: 'more' | 'payment',
): Promise<string> {
  if (!validAmount(input.amount)) throw new Error('INVALID_AMOUNT');
  const res = await transaction(async (db) => {
    const { debt, entries } = await currentDebt(db, bookId, id);
    if (debt.settled_at) throw new Error('DEBT_SETTLED');
    const occurredAt = input.occurredAt ?? Date.now();
    if (
      !Number.isSafeInteger(occurredAt) ||
      occurredAt < entries.at(-1)!.occurred_at ||
      occurredAt > Date.now() + 86_400_000
    )
      throw new Error('INVALID_DATE');
    const account = await accountInBook(db, bookId, input.accountId);
    if (account && account.currency !== debt.currency)
      throw new Error('INVALID_CURRENCY');
    const kind =
      action === 'more'
        ? debt.direction === 'receivable'
          ? 'lend'
          : 'borrow'
        : debt.direction === 'receivable'
          ? 'collect'
          : 'repay';
    if (action === 'payment') {
      const balance = debtBalance(entries, debt.interest_rate_bps, occurredAt);
      if (input.amount > balance.outstanding) throw new Error('OVERPAYMENT');
    }
    const now = Date.now(),
      eventId = uuidv7();
    await run(
      db,
      'INSERT INTO debt_entries(id,user_id,book_id,debt_id,kind,amount,currency,account_id,occurred_at,note,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,0)',
      [
        eventId,
        getCurrentUserId(),
        bookId,
        id,
        kind,
        input.amount,
        debt.currency,
        account?.id ?? null,
        occurredAt,
        input.note?.trim() ?? '',
        now,
        now,
        'pending',
      ],
    );
    if (action === 'payment') {
      const before = debtBalance(entries, debt.interest_rate_bps, occurredAt);
      const after = debtBalance(
        [...entries, { kind, amount: input.amount, occurred_at: occurredAt }],
        debt.interest_rate_bps,
        occurredAt,
      );
      let remaining = before.principal - after.principal;
      const installments = await rows<DebtInstallment>(
        db,
        'SELECT * FROM debt_installments WHERE debt_id=? AND deleted_at IS NULL AND paid_amount<amount ORDER BY due_date,id',
        [id],
      );
      for (const installment of installments) {
        if (!remaining) break;
        const applied = Math.min(
          remaining,
          installment.amount - installment.paid_amount,
        );
        await run(
          db,
          'UPDATE debt_installments SET paid_amount=?,paid_event_id=?,updated_at=?,sync_state=? WHERE id=?',
          [
            addMinor(installment.paid_amount, applied),
            eventId,
            now,
            'pending',
            installment.id,
          ],
        );
        remaining -= applied;
      }
      if (after.outstanding === 0)
        await run(
          db,
          'UPDATE debts SET settled_at=?,updated_at=?,sync_state=? WHERE id=?',
          [occurredAt, now, 'pending', id],
        );
      else
        await run(db, 'UPDATE debts SET updated_at=?,sync_state=? WHERE id=?', [
          now,
          'pending',
          id,
        ]);
    } else
      await run(db, 'UPDATE debts SET updated_at=?,sync_state=? WHERE id=?', [
        now,
        'pending',
        id,
      ]);
    return eventId;
  });
  syncEngine.notifyWrite();
  return res;
}
export async function settleDebt(bookId: string, id: string): Promise<void> {
  const db = await getDatabase();
  const { debt, entries } = await currentDebt(db, bookId, id);
  const balance = debtBalance(entries, debt.interest_rate_bps, Date.now());
  if (!balance.outstanding) return;
  await transaction(async (txDb) => {
    const current = await currentDebt(txDb, bookId, id);
    if (current.debt.settled_at) throw new Error('DEBT_SETTLED');
    const now = Date.now();
    const remaining = debtBalance(
      current.entries,
      current.debt.interest_rate_bps,
      now,
    ).outstanding;
    const eventId = uuidv7();
    await run(
      txDb,
      'INSERT INTO debt_entries(id,user_id,book_id,debt_id,kind,amount,currency,account_id,occurred_at,note,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,0)',
      [
        eventId,
        getCurrentUserId(),
        bookId,
        id,
        'write_off',
        remaining,
        current.debt.currency,
        null,
        now,
        '',
        now,
        now,
        'pending',
      ],
    );
    await run(
      txDb,
      'UPDATE debts SET write_off_amount=?,settled_at=?,updated_at=?,sync_state=? WHERE id=?',
      [
        addMinor(current.debt.write_off_amount, remaining),
        now,
        now,
        'pending',
        id,
      ],
    );
  });
  syncEngine.notifyWrite();
}
export async function updateDebtDetails(
  bookId: string,
  id: string,
  input: { dueDate?: number | null; note?: string },
): Promise<void> {
  await transaction(async (db) => {
    const { debt } = await currentDebt(db, bookId, id);
    await run(
      db,
      'UPDATE debts SET due_date=?,note=?,updated_at=?,sync_state=? WHERE id=?',
      [
        input.dueDate ?? null,
        input.note?.trim() ?? debt.note,
        Date.now(),
        'pending',
        debt.id,
      ],
    );
  });
  syncEngine.notifyWrite();
}
