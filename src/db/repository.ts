import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
async function run(
  db: SQLiteDBConnection,
  sql: string,
  params: unknown[],
): Promise<void> {
  await db.run(sql, params, false);
}
import { getDatabase, persistWeb, transaction } from './connection';
import { deviceCurrency, seedBook } from './seed';
import { uuidv7 } from '../lib/ids';
import { destinationMinor } from '../lib/currency';
import { addMinor } from '../lib/money';
import { calculateNextRun, calculateRequiredMonthlySavings } from '../lib/recurrence';
import { syncEngine } from '../sync/engine';
import { api, getApiBaseUrl } from '../app/identity';
import type {
  Account,
  Asset,
  AssetType,
  AssetValuation,
  AssetView,
  Attachment,
  AttachmentEntityType,
  AttachmentKind,
  AttachmentUploadState,
  Balance,
  Book,
  Budget,
  BudgetStatus,
  BudgetSummary,
  CalendarDayData,
  Category,
  CsvImportRow,
  Debt,
  Document,
  DocumentFolder,
  DocumentView,
  ExchangeRate,
  Favorite,
  GlobalSearchResult,
  Goal,
  GoalView,
  NetWorthHistoryPoint,
  RecurringFrequency,
  RecurringMode,
  RecurringRule,
  RecurringRuleView,
  ReportAccountBreakdown,
  ReportCategoryBreakdown,
  ReportDailyPoint,
  ReportData,
  ReportTagBreakdown,
  Tag,
  Transaction,
  TransactionRow,
  WealthSummary,
} from './types';

let currentUserId = 'local';
export function setCurrentUserId(id: string): void {
  currentUserId = id;
}
export function getCurrentUserId(): string {
  return currentUserId;
}

export async function migrateLocalUser(newUserId: string): Promise<void> {
  if (!newUserId || newUserId === 'local') return;
  await transaction(async (db) => {
    const tables = [
      'books',
      'accounts',
      'categories',
      'tags',
      'transactions',
      'favorites',
      'people',
      'debts',
      'debt_entries',
      'debt_installments',
      'attachments',
      'documents',
      'recurring_rules',
      'budgets',
      'goals',
      'assets',
      'asset_valuations',
      'exchange_rates',
    ];
    for (const table of tables) {
      await run(
        db,
        `UPDATE ${table} SET user_id=?, sync_state='pending', updated_at=? WHERE user_id='local'`,
        [newUserId, Date.now()],
      );
    }
  });
  setCurrentUserId(newUserId);
  syncEngine.notifyWrite();
}

export async function wipeLocalData(): Promise<void> {
  await transaction(async (db) => {
    const tables = [
      'exchange_rates',
      'asset_valuations',
      'assets',
      'goals',
      'budgets',
      'recurring_rules',
      'documents',
      'attachments',
      'debt_installments',
      'debt_entries',
      'debts',
      'people',
      'transaction_tags',
      'transactions',
      'favorites',
      'categories',
      'accounts',
      'books',
    ];
    for (const table of tables) {
      await run(db, `DELETE FROM ${table}`, []);
    }
    await seedBook(db, 'personal', deviceCurrency(), true, 'local');
  });
  setCurrentUserId('local');
}
async function rows<T>(
  db: SQLiteDBConnection,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await db.query(sql, params);
  return (result.values ?? []) as T[];
}
export async function initializeMoney(): Promise<string> {
  return transaction(async (db) => {
    const books = await rows<Book>(
      db,
      'SELECT * FROM books WHERE user_id=? AND deleted_at IS NULL ORDER BY is_default DESC LIMIT 1',
      [currentUserId],
    );
    return books[0]?.id ?? seedBook(db, 'personal', deviceCurrency(), true, currentUserId);
  });
}
/**
 * Point an untouched default book at the account currency.
 * The first local book is seeded from the device locale, so a Bangladesh
 * account on an en-US emulator would otherwise stay in dollars. Books that
 * already hold money, or whose currency was changed away from that seed,
 * are left alone.
 */
export async function alignEmptyBookCurrency(userId: string, currency: string): Promise<void> {
  const next = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(next) || !userId || userId === 'local') return;
  const seeded = deviceCurrency();
  const db = await getDatabase();
  const books = await rows<{ id: string; currency: string }>(
    db,
    'SELECT id, currency FROM books WHERE user_id=? AND deleted_at IS NULL AND is_default=1',
    [userId],
  );
  let changed = false;
  for (const book of books) {
    if (book.currency === next || book.currency !== seeded) continue;
    const counts = await rows<{ kind: string; c: number }>(
      db,
      `SELECT 'tx' AS kind, COUNT(*) AS c FROM transactions WHERE book_id=? AND deleted_at IS NULL
       UNION ALL SELECT 'debt', COUNT(*) FROM debts WHERE book_id=? AND deleted_at IS NULL
       UNION ALL SELECT 'open', COUNT(*) FROM accounts WHERE book_id=? AND deleted_at IS NULL AND opening_balance!=0
       UNION ALL SELECT 'fav', COUNT(*) FROM favorites WHERE book_id=? AND deleted_at IS NULL
       UNION ALL SELECT 'goal', COUNT(*) FROM goals WHERE book_id=? AND deleted_at IS NULL
       UNION ALL SELECT 'asset', COUNT(*) FROM assets WHERE book_id=? AND deleted_at IS NULL`,
      [book.id, book.id, book.id, book.id, book.id, book.id],
    );
    if (counts.some((row) => Number(row.c) > 0)) continue;
    const now = Date.now();
    await run(db, 'UPDATE books SET currency=?, updated_at=?, sync_state=? WHERE id=?', [
      next,
      now,
      'pending',
      book.id,
    ]);
    await run(
      db,
      'UPDATE accounts SET currency=?, updated_at=?, sync_state=? WHERE book_id=? AND deleted_at IS NULL AND opening_balance=0 AND currency=?',
      [next, now, 'pending', book.id, book.currency],
    );
    changed = true;
  }
  if (changed) syncEngine.notifyWrite();
}

export async function listBooks(): Promise<Book[]> {
  return rows<Book>(
    await getDatabase(),
    'SELECT * FROM books WHERE user_id=? AND deleted_at IS NULL ORDER BY is_default DESC,created_at',
    [currentUserId],
  );
}
export async function createBook(
  name: string,
  currency: string,
): Promise<string> {
  if (!name.trim() || name.length > 80) throw new Error('INVALID_NAME');
  const res = await transaction((db) => seedBook(db, name.trim(), currency, false, currentUserId));
  syncEngine.notifyWrite();
  return res;
}
export async function renameBook(id: string, name: string): Promise<void> {
  if (!name.trim() || name.length > 80) throw new Error('INVALID_NAME');
  await transaction(async (db) => {
    await run(
      db,
      'UPDATE books SET name=?,updated_at=?,sync_state=? WHERE id=? AND user_id=? AND deleted_at IS NULL',
      [name.trim(), Date.now(), 'pending', id, currentUserId],
    );
  });
  syncEngine.notifyWrite();
}
export async function listAccounts(
  bookId: string,
  includeArchived = false,
): Promise<Account[]> {
  return rows<Account>(
    await getDatabase(),
    `SELECT * FROM accounts WHERE user_id=? AND book_id=? AND deleted_at IS NULL ${includeArchived ? '' : 'AND is_archived=0'} ORDER BY sort_order,created_at`,
    [currentUserId, bookId],
  );
}
export type AccountInput = {
  name: string;
  type: Account['type'];
  provider?: string | null;
  currency: string;
  openingBalance: number;
  color: string;
  icon: string;
  includeInTotal?: boolean;
  creditLimit?: number | null;
  statementDay?: number | null;
  dueDay?: number | null;
};
function validateAccount(input: AccountInput) {
  if (!input.name.trim() || input.name.length > 80)
    throw new Error('INVALID_NAME');
  if (!Number.isSafeInteger(input.openingBalance))
    throw new Error('INVALID_AMOUNT');
  if (
    input.creditLimit !== undefined &&
    input.creditLimit !== null &&
    (!Number.isSafeInteger(input.creditLimit) || input.creditLimit < 0)
  )
    throw new Error('INVALID_AMOUNT');
  if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error('INVALID_CURRENCY');
}
export async function saveAccount(
  bookId: string,
  input: AccountInput,
  id?: string,
): Promise<string> {
  validateAccount(input);
  return transaction(async (db) => {
    const book = (
      await rows<Book>(
        db,
        'SELECT * FROM books WHERE id=? AND user_id=? AND deleted_at IS NULL',
        [bookId, currentUserId],
      )
    )[0];
    if (!book) throw new Error('BOOK_NOT_FOUND');
    if (input.currency !== book.currency) throw new Error('INVALID_CURRENCY');
    const now = Date.now();
    if (id) {
      const existing = (
        await rows<Account>(
          db,
          'SELECT * FROM accounts WHERE id=? AND book_id=? AND user_id=? AND deleted_at IS NULL',
          [id, bookId, currentUserId],
        )
      )[0];
      if (!existing) throw new Error('ACCOUNT_NOT_FOUND');
      await run(
        db,
        'UPDATE accounts SET name=?,type=?,provider=?,currency=?,opening_balance=?,color=?,icon=?,include_in_total=?,credit_limit=?,statement_day=?,due_day=?,updated_at=?,sync_state=? WHERE id=?',
        [
          input.name.trim(),
          input.type,
          input.provider ?? null,
          input.currency,
          input.openingBalance,
          input.color,
          input.icon,
          input.includeInTotal === false ? 0 : 1,
          input.creditLimit ?? null,
          input.statementDay ?? null,
          input.dueDay ?? null,
          now,
          'pending',
          id,
        ],
      );
      syncEngine.notifyWrite();
      return id;
    }
    const newId = uuidv7();
    await run(
      db,
      'INSERT INTO accounts(id,user_id,book_id,name,type,provider,currency,opening_balance,color,icon,include_in_total,is_archived,sort_order,credit_limit,statement_day,due_day,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)',
      [
        newId,
        currentUserId,
        bookId,
        input.name.trim(),
        input.type,
        input.provider ?? null,
        input.currency,
        input.openingBalance,
        input.color,
        input.icon,
        input.includeInTotal === false ? 0 : 1,
        0,
        now,
        input.creditLimit ?? null,
        input.statementDay ?? null,
        input.dueDay ?? null,
        now,
        now,
        'pending',
      ],
    );
    syncEngine.notifyWrite();
    return newId;
  });
}
export async function archiveAccount(
  id: string,
  archived: boolean,
): Promise<void> {
  await transaction(async (db) => {
    await run(
      db,
      'UPDATE accounts SET is_archived=?,updated_at=?,sync_state=? WHERE id=? AND user_id=?',
      [archived ? 1 : 0, Date.now(), 'pending', id, currentUserId],
    );
  });
  syncEngine.notifyWrite();
}
export async function listCategories(
  bookId: string,
  kind?: Category['kind'],
): Promise<Category[]> {
  return rows<Category>(
    await getDatabase(),
    `SELECT * FROM categories WHERE user_id=? AND book_id=? AND deleted_at IS NULL ${kind ? 'AND kind=?' : ''} ORDER BY sort_order,created_at`,
    kind ? [currentUserId, bookId, kind] : [currentUserId, bookId],
  );
}
export async function saveCategory(
  bookId: string,
  input: {
    name: string;
    kind: Category['kind'];
    parentId?: string | null;
    icon: string;
    color: string;
  },
  id?: string,
): Promise<string> {
  if (!input.name.trim() || input.name.length > 80)
    throw new Error('INVALID_NAME');
  return transaction(async (db) => {
    if (input.parentId) {
      const parent = (
        await rows<Category>(
          db,
          'SELECT * FROM categories WHERE id=? AND book_id=? AND kind=? AND deleted_at IS NULL',
          [input.parentId, bookId, input.kind],
        )
      )[0];
      if (!parent || parent.parent_id) throw new Error('INVALID_PARENT');
    }
    const now = Date.now();
    if (id) {
      await run(
        db,
        'UPDATE categories SET name=?,i18n_key=NULL,kind=?,parent_id=?,icon=?,color=?,updated_at=?,sync_state=? WHERE id=? AND user_id=? AND book_id=?',
        [
          input.name.trim(),
          input.kind,
          input.parentId ?? null,
          input.icon,
          input.color,
          now,
          'pending',
          id,
          currentUserId,
          bookId,
        ],
      );
      syncEngine.notifyWrite();
      return id;
    }
    const newId = uuidv7();
    await run(
      db,
      'INSERT INTO categories(id,user_id,book_id,name,kind,parent_id,icon,color,sort_order,is_default,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,0)',
      [
        newId,
        currentUserId,
        bookId,
        input.name.trim(),
        input.kind,
        input.parentId ?? null,
        input.icon,
        input.color,
        now,
        0,
        now,
        now,
        'pending',
      ],
    );
    syncEngine.notifyWrite();
    return newId;
  });
}
export async function listTags(bookId: string): Promise<Tag[]> {
  return rows<Tag>(
    await getDatabase(),
    'SELECT * FROM tags WHERE user_id=? AND book_id=? AND deleted_at IS NULL ORDER BY name',
    [currentUserId, bookId],
  );
}
export async function saveTag(
  bookId: string,
  name: string,
  color = '#64748b',
): Promise<string> {
  if (!name.trim() || name.length > 40) throw new Error('INVALID_NAME');
  const res = await transaction(async (db) => {
    const id = uuidv7(),
      now = Date.now();
    await run(
      db,
      'INSERT INTO tags(id,user_id,book_id,name,color,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,0)',
      [id, currentUserId, bookId, name.trim(), color, now, now, 'pending'],
    );
    return id;
  });
  syncEngine.notifyWrite();
  return res;
}
export async function listFavorites(bookId: string): Promise<Favorite[]> {
  return rows<Favorite>(
    await getDatabase(),
    'SELECT * FROM favorites WHERE user_id=? AND book_id=? AND deleted_at IS NULL ORDER BY updated_at DESC',
    [currentUserId, bookId],
  );
}
export async function saveFavorite(
  bookId: string,
  input: {
    name: string;
    type: Favorite['type'];
    amount: number;
    accountId: string;
    categoryId: string | null;
  },
): Promise<string> {
  if (
    !input.name.trim() ||
    !Number.isSafeInteger(input.amount) ||
    input.amount <= 0
  )
    throw new Error('INVALID_FAVORITE');
  const res = await transaction(async (db) => {
    const id = uuidv7(),
      now = Date.now();
    await run(
      db,
      'INSERT INTO favorites(id,user_id,book_id,name,type,amount,account_id,category_id,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,0)',
      [
        id,
        currentUserId,
        bookId,
        input.name.trim(),
        input.type,
        input.amount,
        input.accountId,
        input.categoryId,
        now,
        now,
        'pending',
      ],
    );
    return id;
  });
  syncEngine.notifyWrite();
  return res;
}
export type TransactionInput = {
  type: Transaction['type'];
  amount: number;
  accountId: string;
  toAccountId?: string | null;
  fee?: number;
  exchangeRate?: number | null;
  categoryId?: string | null;
  occurredAt: number;
  note?: string;
  tagIds?: string[];
  splits?: { categoryId: string; amount: number }[];
  recurringRuleId?: string | null;
  goalId?: string | null;
  assetId?: string | null;
};
export async function saveTransaction(
  bookId: string,
  input: TransactionInput,
  id?: string,
): Promise<string> {
  if (
    !Number.isSafeInteger(input.amount) ||
    input.amount <= 0 ||
    !Number.isSafeInteger(input.fee ?? 0) ||
    (input.fee ?? 0) < 0
  )
    throw new Error('INVALID_AMOUNT');
  if (
    input.splits?.length &&
    input.splits.reduce((sum, x) => addMinor(sum, x.amount), 0) !== input.amount
  )
    throw new Error('SPLIT_MISMATCH');
  const res = await transaction(async (db) => {
    const accounts = await rows<Account>(
      db,
      'SELECT * FROM accounts WHERE book_id=? AND user_id=? AND deleted_at IS NULL AND id IN (?,?)',
      [bookId, currentUserId, input.accountId, input.toAccountId ?? input.accountId],
    );
    const source = accounts.find((x) => x.id === input.accountId);
    if (!source || source.is_archived) throw new Error('ACCOUNT_NOT_FOUND');
    if (input.type === 'transfer') {
      const target = accounts.find((x) => x.id === input.toAccountId);
      if (
        !target ||
        target.is_archived ||
        target.id === source.id
      )
        throw new Error('INVALID_TRANSFER');
      if (target.currency !== source.currency) {
        if (!input.exchangeRate || input.exchangeRate <= 0) {
          throw new Error('CROSS_CURRENCY_REQUIRES_EXCHANGE_RATE');
        }
      }
    }
    if (input.categoryId) {
      const category = (
        await rows<Category>(
          db,
          'SELECT * FROM categories WHERE id=? AND book_id=? AND kind=? AND deleted_at IS NULL',
          [input.categoryId, bookId, input.type],
        )
      )[0];
      if (!category) throw new Error('INVALID_CATEGORY');
    }
    for (const split of input.splits ?? []) {
      if (split.amount <= 0 || !Number.isSafeInteger(split.amount))
        throw new Error('INVALID_SPLIT');
      const category = (
        await rows<Category>(
          db,
          'SELECT * FROM categories WHERE id=? AND book_id=? AND kind=? AND deleted_at IS NULL',
          [split.categoryId, bookId, input.type],
        )
      )[0];
      if (!category) throw new Error('INVALID_CATEGORY');
    }
    const tags = input.tagIds ?? [];
    for (const tagId of tags) {
      if (
        !(
          await rows<Tag>(
            db,
            'SELECT * FROM tags WHERE id=? AND book_id=? AND deleted_at IS NULL',
            [tagId, bookId],
          )
        )[0]
      )
        throw new Error('INVALID_TAG');
    }
    const now = Date.now(),
      txId = id ?? uuidv7();
    if (id) {
      const existing = (
        await rows<Transaction>(
          db,
          'SELECT * FROM transactions WHERE id=? AND book_id=? AND user_id=? AND parent_id IS NULL AND deleted_at IS NULL',
          [id, bookId, currentUserId],
        )
      )[0];
      if (!existing) throw new Error('TRANSACTION_NOT_FOUND');
      await run(db, 'DELETE FROM transaction_tags WHERE transaction_id=?', [
        id,
      ]);
      await run(
        db,
        'UPDATE transactions SET deleted_at=?,updated_at=?,sync_state=? WHERE parent_id=? AND deleted_at IS NULL',
        [now, now, 'pending', id],
      );
      await run(
        db,
        'UPDATE transactions SET type=?,amount=?,currency=?,account_id=?,to_account_id=?,fee=?,exchange_rate=?,category_id=?,occurred_at=?,note=?,recurring_rule_id=?,goal_id=?,asset_id=?,updated_at=?,sync_state=? WHERE id=?',
        [
          input.type,
          input.amount,
          source.currency,
          source.id,
          input.toAccountId ?? null,
          input.fee ?? 0,
          input.exchangeRate ?? null,
          input.splits?.length ? null : (input.categoryId ?? null),
          input.occurredAt,
          input.note ?? '',
          input.recurringRuleId ?? null,
          input.goalId ?? null,
          input.assetId ?? null,
          now,
          'pending',
          id,
        ],
      );
    } else {
      await run(
        db,
        'INSERT INTO transactions(id,user_id,book_id,type,amount,currency,account_id,to_account_id,fee,exchange_rate,category_id,occurred_at,note,recurring_rule_id,goal_id,asset_id,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)',
        [
          txId,
          currentUserId,
          bookId,
          input.type,
          input.amount,
          source.currency,
          source.id,
          input.toAccountId ?? null,
          input.fee ?? 0,
          input.exchangeRate ?? null,
          input.splits?.length ? null : (input.categoryId ?? null),
          input.occurredAt,
          input.note ?? '',
          input.recurringRuleId ?? null,
          input.goalId ?? null,
          input.assetId ?? null,
          now,
          now,
          'pending',
        ],
      );
    }
    for (const split of input.splits ?? []) {
      await run(
        db,
        'INSERT INTO transactions(id,user_id,book_id,type,amount,currency,account_id,fee,category_id,occurred_at,note,parent_id,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)',
        [
          uuidv7(),
          currentUserId,
          bookId,
          input.type,
          split.amount,
          source.currency,
          source.id,
          0,
          split.categoryId,
          input.occurredAt,
          '',
          txId,
          now,
          now,
          'pending',
        ],
      );
    }
    for (const tagId of tags)
      await run(
        db,
        'INSERT INTO transaction_tags(transaction_id,tag_id) VALUES(?,?)',
        [txId, tagId],
      );
    return txId;
  });
  syncEngine.notifyWrite();
  return res;
}
export async function deleteTransaction(id: string): Promise<void> {
  await transaction(async (db) => {
    const now = Date.now();
    await run(
      db,
      'UPDATE transactions SET deleted_at=?,updated_at=?,sync_state=? WHERE (id=? OR parent_id=?) AND user_id=?',
      [now, now, 'pending', id, id, currentUserId],
    );
  });
  syncEngine.notifyWrite();
}
export async function restoreTransaction(id: string): Promise<void> {
  await transaction(async (db) => {
    const parent = (
      await rows<{ deleted_at: number }>(
        db,
        'SELECT deleted_at FROM transactions WHERE id=? AND user_id=? AND parent_id IS NULL',
        [id, currentUserId],
      )
    )[0];
    if (!parent?.deleted_at) return;
    await run(
      db,
      'UPDATE transactions SET deleted_at=NULL,updated_at=?,sync_state=? WHERE (id=? OR parent_id=?) AND user_id=? AND deleted_at=?',
      [Date.now(), 'pending', id, id, currentUserId, parent.deleted_at],
    );
  });
  syncEngine.notifyWrite();
}
export type TransactionFilters = {
  bookId: string;
  type?: string;
  accountId?: string;
  categoryId?: string;
  tagId?: string;
  search?: string;
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
  hasAttachment?: boolean;
};
export async function listTransactions(
  filter: TransactionFilters,
): Promise<TransactionRow[]> {
  let sql = `WITH t AS (
    SELECT x.*,NULL AS debt_id FROM transactions x WHERE x.book_id=? AND x.user_id=? AND x.parent_id IS NULL AND x.deleted_at IS NULL
    UNION ALL
    SELECT e.id,e.user_id,e.book_id,e.kind AS type,e.amount,e.currency,e.account_id,NULL AS to_account_id,0 AS fee,NULL AS category_id,e.occurred_at,e.note,NULL AS parent_id,e.created_at,e.updated_at,e.deleted_at,e.sync_state,e.server_rev,NULL AS recurring_rule_id,NULL AS goal_id,NULL AS asset_id,NULL AS exchange_rate,e.debt_id
    FROM debt_entries e JOIN debts d ON d.id=e.debt_id WHERE e.book_id=? AND e.user_id=? AND e.deleted_at IS NULL AND d.deleted_at IS NULL
  ) SELECT t.*,COALESCE(a.name,p.name,'') AS account_name,p.name AS person_name,c.name AS category_name,c.i18n_key AS category_key,(SELECT group_concat(g.name,', ') FROM transaction_tags tt JOIN tags g ON g.id=tt.tag_id WHERE tt.transaction_id=t.id) AS tags,(SELECT COUNT(*) FROM transactions s WHERE s.parent_id=t.id AND s.deleted_at IS NULL) AS split_count,(SELECT group_concat(s.category_id) FROM transactions s WHERE s.parent_id=t.id AND s.deleted_at IS NULL) AS split_category_ids,(SELECT COUNT(*) FROM attachments att WHERE att.entity_id=t.id AND att.deleted_at IS NULL) AS attachment_count FROM t LEFT JOIN accounts a ON a.id=t.account_id LEFT JOIN debts d ON d.id=t.debt_id LEFT JOIN people p ON p.id=d.person_id LEFT JOIN categories c ON c.id=t.category_id WHERE 1=1`;
  const params: unknown[] = [filter.bookId, currentUserId, filter.bookId, currentUserId];
  if (filter.hasAttachment) {
    sql += ' AND EXISTS(SELECT 1 FROM attachments att WHERE att.entity_id=t.id AND att.deleted_at IS NULL)';
  }
  if (filter.type) {
    if (filter.type === 'debt')
      sql += " AND t.type IN ('lend','borrow','collect','repay','write_off')";
    else {
      sql += ' AND t.type=?';
      params.push(filter.type);
    }
  }
  if (filter.accountId) {
    sql += ' AND (t.account_id=? OR t.to_account_id=?)';
    params.push(filter.accountId, filter.accountId);
  }
  if (filter.categoryId) {
    sql +=
      ' AND (t.category_id=? OR EXISTS(SELECT 1 FROM transactions s WHERE s.parent_id=t.id AND s.category_id=? AND s.deleted_at IS NULL))';
    params.push(filter.categoryId, filter.categoryId);
  }
  if (filter.tagId) {
    sql +=
      ' AND EXISTS(SELECT 1 FROM transaction_tags tt WHERE tt.transaction_id=t.id AND tt.tag_id=?)';
    params.push(filter.tagId);
  }
  if (filter.search?.trim()) {
    sql +=
      ' AND (t.note LIKE ? OR a.name LIKE ? OR p.name LIKE ? OR CAST(t.amount AS TEXT) LIKE ?)';
    const term = `%${filter.search.trim()}%`;
    params.push(term, term, term, term);
  }
  if (filter.from) {
    sql += ' AND t.occurred_at>=?';
    params.push(filter.from);
  }
  if (filter.to) {
    sql += ' AND t.occurred_at<?';
    params.push(filter.to);
  }
  sql += ' ORDER BY t.occurred_at DESC,t.id DESC LIMIT ? OFFSET ?';
  params.push(Math.min(filter.limit ?? 60, 200), filter.offset ?? 0);
  return rows<TransactionRow>(await getDatabase(), sql, params);
}
export async function getTransaction(id: string): Promise<{
  transaction: Transaction;
  tagIds: string[];
  splits: { categoryId: string; amount: number }[];
} | null> {
  const db = await getDatabase(),
    record = (
      await rows<Transaction>(
        db,
        'SELECT * FROM transactions WHERE id=? AND user_id=? AND parent_id IS NULL AND deleted_at IS NULL',
        [id, currentUserId],
      )
    )[0];
  if (!record) return null;
  const tags = await rows<{ tag_id: string }>(
    db,
    'SELECT tag_id FROM transaction_tags WHERE transaction_id=?',
    [id],
  );
  const splits = await rows<{ categoryId: string; amount: number }>(
    db,
    'SELECT category_id AS categoryId,amount FROM transactions WHERE parent_id=? AND deleted_at IS NULL',
    [id],
  );
  return { transaction: record, tagIds: tags.map((x) => x.tag_id), splits };
}
export async function getBalances(bookId: string): Promise<Balance[]> {
  const db = await getDatabase();
  const accounts = await listAccounts(bookId, true);
  const entries = await rows<{ account_id: string; delta: number }>(
    db,
    `SELECT account_id,SUM(delta) AS delta FROM (SELECT account_id,CASE type WHEN 'income' THEN amount WHEN 'expense' THEN -amount WHEN 'transfer' THEN -(amount+fee) END AS delta FROM transactions WHERE book_id=? AND parent_id IS NULL AND deleted_at IS NULL UNION ALL SELECT account_id,CASE kind WHEN 'lend' THEN -amount WHEN 'borrow' THEN amount WHEN 'collect' THEN amount WHEN 'repay' THEN -amount ELSE 0 END AS delta FROM debt_entries WHERE book_id=? AND deleted_at IS NULL AND account_id IS NOT NULL) GROUP BY account_id`,
    [bookId, bookId],
  );
  const transfers = await rows<{
    to_account_id: string;
    amount: number;
    currency: string;
    exchange_rate: number | null;
  }>(
    db,
    `SELECT to_account_id,amount,currency,exchange_rate FROM transactions WHERE book_id=? AND type='transfer' AND parent_id IS NULL AND deleted_at IS NULL AND to_account_id IS NOT NULL`,
    [bookId],
  );
  const map = new Map(entries.map((x) => [x.account_id, x.delta]));
  const currencyByAccount = new Map(accounts.map((account) => [account.id, account.currency]));
  for (const transfer of transfers) {
    const credit = destinationMinor(
      transfer.amount,
      transfer.currency,
      currencyByAccount.get(transfer.to_account_id),
      transfer.exchange_rate,
    );
    map.set(transfer.to_account_id, addMinor(map.get(transfer.to_account_id) ?? 0, credit));
  }
  return accounts.map((a) => ({
    account_id: a.id,
    balance: addMinor(a.opening_balance, map.get(a.id) ?? 0),
  }));
}
export async function getMonthlyTotals(
  bookId: string,
  from: number,
  to: number,
): Promise<Array<{ type: 'income' | 'expense'; currency: string; total: number }>> {
  return rows<{ type: 'income' | 'expense'; currency: string; total: number }>(
    await getDatabase(),
    "SELECT type,currency,SUM(amount) AS total FROM transactions WHERE user_id=? AND book_id=? AND parent_id IS NULL AND deleted_at IS NULL AND occurred_at>=? AND occurred_at<? AND type IN('income','expense') GROUP BY type,currency",
    [currentUserId, bookId, from, to],
  );
}
export async function queryRaw<T>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return rows<T>(await getDatabase(), sql, params);
}
export async function closeMoney(): Promise<void> {
  await persistWeb();
}

// Attachments
export async function createAttachment(input: {
  id?: string;
  book_id: string;
  entity_type: AttachmentEntityType;
  entity_id: string;
  kind: AttachmentKind;
  mime: string;
  size: number;
  original_name: string;
  sha256: string;
  width?: number | null;
  height?: number | null;
  local_path?: string | null;
  thumb_local_path?: string | null;
  remote_id?: string | null;
  upload_state?: AttachmentUploadState;
}): Promise<Attachment> {
  const id = input.id ?? uuidv7();
  const now = Date.now();
  const attachment: Attachment = {
    id,
    user_id: currentUserId,
    book_id: input.book_id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    kind: input.kind,
    mime: input.mime,
    size: input.size,
    original_name: input.original_name,
    sha256: input.sha256,
    width: input.width ?? null,
    height: input.height ?? null,
    local_path: input.local_path ?? null,
    thumb_local_path: input.thumb_local_path ?? null,
    remote_id: input.remote_id ?? null,
    upload_state: input.upload_state ?? 'local',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    sync_state: 'pending',
    server_rev: 0,
  };

  await transaction(async (db) => {
    await run(
      db,
      `INSERT INTO attachments(id,user_id,book_id,entity_type,entity_id,kind,mime,size,original_name,sha256,width,height,local_path,thumb_local_path,remote_id,upload_state,created_at,updated_at,deleted_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        attachment.id,
        attachment.user_id,
        attachment.book_id,
        attachment.entity_type,
        attachment.entity_id,
        attachment.kind,
        attachment.mime,
        attachment.size,
        attachment.original_name,
        attachment.sha256,
        attachment.width,
        attachment.height,
        attachment.local_path,
        attachment.thumb_local_path,
        attachment.remote_id,
        attachment.upload_state,
        attachment.created_at,
        attachment.updated_at,
        attachment.deleted_at,
        attachment.sync_state,
        attachment.server_rev,
      ],
    );
  });

  syncEngine.notifyWrite();
  return attachment;
}

export async function getAttachment(id: string): Promise<Attachment | null> {
  const list = await rows<Attachment>(
    await getDatabase(),
    'SELECT * FROM attachments WHERE id=? AND deleted_at IS NULL',
    [id],
  );
  return list[0] ?? null;
}

export async function listAttachmentsForEntity(
  entityType: string,
  entityId: string,
): Promise<Attachment[]> {
  return rows<Attachment>(
    await getDatabase(),
    'SELECT * FROM attachments WHERE entity_type=? AND entity_id=? AND deleted_at IS NULL ORDER BY created_at ASC',
    [entityType, entityId],
  );
}

export async function countAttachmentsForEntities(
  entityType: string,
  entityIds: string[],
): Promise<Record<string, number>> {
  if (entityIds.length === 0) return {};
  const placeholders = entityIds.map(() => '?').join(',');
  const results = await rows<{ entity_id: string; c: number }>(
    await getDatabase(),
    `SELECT entity_id, COUNT(*) as c FROM attachments WHERE entity_type=? AND entity_id IN (${placeholders}) AND deleted_at IS NULL GROUP BY entity_id`,
    [entityType, ...entityIds],
  );
  const map: Record<string, number> = {};
  for (const r of results) {
    map[r.entity_id] = r.c;
  }
  return map;
}

export async function listPendingUploads(): Promise<Attachment[]> {
  return rows<Attachment>(
    await getDatabase(),
    `SELECT * FROM attachments WHERE remote_id IS NULL AND upload_state IN ('local','failed') AND deleted_at IS NULL ORDER BY created_at ASC`,
    [],
  );
}

export async function updateAttachmentUploadState(
  id: string,
  remoteId: string | null,
  uploadState: AttachmentUploadState,
): Promise<void> {
  const now = Date.now();
  await transaction(async (db) => {
    await run(
      db,
      `UPDATE attachments SET remote_id=COALESCE(?,remote_id), upload_state=?, updated_at=?, sync_state='pending' WHERE id=?`,
      [remoteId, uploadState, now, id],
    );
  });
  syncEngine.notifyWrite();
}

export async function updateAttachmentLocalPaths(
  id: string,
  localPath: string | null,
  thumbLocalPath: string | null,
): Promise<void> {
  await transaction(async (db) => {
    await run(
      db,
      `UPDATE attachments SET local_path=COALESCE(?,local_path), thumb_local_path=COALESCE(?,thumb_local_path) WHERE id=?`,
      [localPath, thumbLocalPath, id],
    );
  });
}

export async function deleteAttachment(id: string): Promise<void> {
  const now = Date.now();
  await transaction(async (db) => {
    await run(
      db,
      `UPDATE attachments SET deleted_at=?, updated_at=?, sync_state='pending' WHERE id=?`,
      [now, now, id],
    );
  });
  syncEngine.notifyWrite();
}

export async function getAttachmentStorageUsage(): Promise<{
  total_size: number;
  total_count: number;
}> {
  const res = await rows<{ total_size: number; total_count: number }>(
    await getDatabase(),
    `SELECT COALESCE(SUM(size), 0) AS total_size, COUNT(*) AS total_count FROM attachments WHERE deleted_at IS NULL`,
    [],
  );
  return {
    total_size: res[0]?.total_size ?? 0,
    total_count: res[0]?.total_count ?? 0,
  };
}

// Documents
export async function createDocument(input: {
  id?: string;
  book_id: string;
  title: string;
  folder: DocumentFolder;
  date: number;
  expiry_date?: number | null;
  tags?: string | null;
  note?: string;
  entity_type?: string | null;
  entity_id?: string | null;
}): Promise<Document> {
  const id = input.id ?? uuidv7();
  const now = Date.now();
  const doc: Document = {
    id,
    user_id: currentUserId,
    book_id: input.book_id,
    title: input.title.trim(),
    folder: input.folder,
    date: input.date,
    expiry_date: input.expiry_date ?? null,
    tags: input.tags?.trim() ?? null,
    note: input.note?.trim() ?? '',
    entity_type: input.entity_type ?? null,
    entity_id: input.entity_id ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    sync_state: 'pending',
    server_rev: 0,
  };

  await transaction(async (db) => {
    await run(
      db,
      `INSERT INTO documents(id,user_id,book_id,title,folder,date,expiry_date,tags,note,entity_type,entity_id,created_at,updated_at,deleted_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        doc.id,
        doc.user_id,
        doc.book_id,
        doc.title,
        doc.folder,
        doc.date,
        doc.expiry_date,
        doc.tags,
        doc.note,
        doc.entity_type,
        doc.entity_id,
        doc.created_at,
        doc.updated_at,
        doc.deleted_at,
        doc.sync_state,
        doc.server_rev,
      ],
    );
  });

  syncEngine.notifyWrite();
  return doc;
}

export async function updateDocument(
  id: string,
  changes: Partial<
    Pick<
      Document,
      | 'title'
      | 'folder'
      | 'date'
      | 'expiry_date'
      | 'tags'
      | 'note'
      | 'entity_type'
      | 'entity_id'
    >
  >,
): Promise<void> {
  const now = Date.now();
  const existing = await rows<Document>(
    await getDatabase(),
    'SELECT * FROM documents WHERE id=? AND deleted_at IS NULL',
    [id],
  );
  if (!existing[0]) return;
  const current = existing[0];

  const updated: Document = {
    ...current,
    title: changes.title !== undefined ? changes.title.trim() : current.title,
    folder: changes.folder !== undefined ? changes.folder : current.folder,
    date: changes.date !== undefined ? changes.date : current.date,
    expiry_date:
      changes.expiry_date !== undefined
        ? changes.expiry_date
        : current.expiry_date,
    tags: changes.tags !== undefined ? (changes.tags?.trim() ?? null) : current.tags,
    note: changes.note !== undefined ? changes.note.trim() : current.note,
    entity_type:
      changes.entity_type !== undefined
        ? changes.entity_type
        : current.entity_type,
    entity_id:
      changes.entity_id !== undefined ? changes.entity_id : current.entity_id,
    updated_at: now,
    sync_state: 'pending',
  };

  await transaction(async (db) => {
    await run(
      db,
      `UPDATE documents SET title=?, folder=?, date=?, expiry_date=?, tags=?, note=?, entity_type=?, entity_id=?, updated_at=?, sync_state='pending' WHERE id=?`,
      [
        updated.title,
        updated.folder,
        updated.date,
        updated.expiry_date,
        updated.tags,
        updated.note,
        updated.entity_type,
        updated.entity_id,
        updated.updated_at,
        id,
      ],
    );
  });

  syncEngine.notifyWrite();
}

export async function getDocument(id: string): Promise<DocumentView | null> {
  const docList = await rows<Document>(
    await getDatabase(),
    'SELECT * FROM documents WHERE id=? AND deleted_at IS NULL',
    [id],
  );
  const doc = docList[0];
  if (!doc) return null;

  const attachments = await listAttachmentsForEntity('document', doc.id);
  const now = Date.now();
  const is_expired = doc.expiry_date ? doc.expiry_date < now : false;
  const days_to_expiry = doc.expiry_date
    ? Math.round((doc.expiry_date - now) / (1000 * 60 * 60 * 24))
    : null;
  const is_expiring_soon =
    days_to_expiry !== null && days_to_expiry >= 0 && days_to_expiry <= 30;

  return {
    ...doc,
    attachments,
    attachment_count: attachments.length,
    is_expired,
    is_expiring_soon,
    days_to_expiry,
  };
}

export async function listDocuments(
  bookId: string,
  options: { folder?: string; search?: string; tag?: string } = {},
): Promise<DocumentView[]> {
  let sql = 'SELECT * FROM documents WHERE book_id=? AND deleted_at IS NULL';
  const params: unknown[] = [bookId];

  if (options.folder && options.folder !== 'all') {
    sql += ' AND folder=?';
    params.push(options.folder);
  }

  if (options.tag) {
    sql += ' AND tags LIKE ?';
    params.push(`%${options.tag}%`);
  }

  if (options.search?.trim()) {
    sql += ' AND (title LIKE ? OR note LIKE ? OR tags LIKE ?)';
    const term = `%${options.search.trim()}%`;
    params.push(term, term, term);
  }

  sql += ' ORDER BY date DESC, created_at DESC';

  const docs = await rows<Document>(await getDatabase(), sql, params);
  if (docs.length === 0) return [];

  const docIds = docs.map((d) => d.id);
  const countMap = await countAttachmentsForEntities('document', docIds);
  const now = Date.now();

  return docs.map((doc) => {
    const is_expired = doc.expiry_date ? doc.expiry_date < now : false;
    const days_to_expiry = doc.expiry_date
      ? Math.round((doc.expiry_date - now) / (1000 * 60 * 60 * 24))
      : null;
    const is_expiring_soon =
      days_to_expiry !== null && days_to_expiry >= 0 && days_to_expiry <= 30;

    return {
      ...doc,
      attachment_count: countMap[doc.id] ?? 0,
      is_expired,
      is_expiring_soon,
      days_to_expiry,
    };
  });
}

export async function deleteDocument(id: string): Promise<void> {
  const now = Date.now();
  await transaction(async (db) => {
    await run(
      db,
      `UPDATE documents SET deleted_at=?, updated_at=?, sync_state='pending' WHERE id=?`,
      [now, now, id],
    );
    // Also soft-delete attachments belonging to this document
    await run(
      db,
      `UPDATE attachments SET deleted_at=?, updated_at=?, sync_state='pending' WHERE entity_type='document' AND entity_id=? AND deleted_at IS NULL`,
      [now, now, id],
    );
  });
  syncEngine.notifyWrite();
}

// -----------------------------------------------------------------------------
// Planning: Recurring Rules & Subscriptions
// -----------------------------------------------------------------------------

export interface RecurringRuleInput {
  name: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  currency?: string;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  personId?: string | null;
  note?: string;
  frequency: RecurringFrequency;
  intervalStep?: number;
  byDay?: string | null;
  startDate: number;
  endDate?: number | null;
  maxCount?: number | null;
  mode: RecurringMode;
  isSubscription?: boolean;
  icon?: string | null;
  color?: string | null;
}

export async function createRecurringRule(
  bookId: string,
  input: RecurringRuleInput,
): Promise<RecurringRule> {
  const id = uuidv7();
  const now = Date.now();
  const db = await getDatabase();
  const book = (await rows<Book>(db, 'SELECT * FROM books WHERE id=?', [bookId]))[0];
  const currency = input.currency ?? book?.currency ?? 'BDT';
  const nextRunAt = input.startDate;

  const rule: RecurringRule = {
    id,
    user_id: currentUserId,
    book_id: bookId,
    name: input.name.trim(),
    type: input.type,
    amount: input.amount,
    currency,
    account_id: input.accountId,
    to_account_id: input.toAccountId ?? null,
    category_id: input.categoryId ?? null,
    person_id: input.personId ?? null,
    note: input.note?.trim() ?? '',
    frequency: input.frequency,
    interval_step: Math.max(1, input.intervalStep ?? 1),
    by_day: input.byDay ?? null,
    start_date: input.startDate,
    end_date: input.endDate ?? null,
    max_count: input.maxCount ?? null,
    current_count: 0,
    mode: input.mode,
    next_run_at: nextRunAt,
    is_subscription: input.isSubscription ? 1 : 0,
    icon: input.icon ?? null,
    color: input.color ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    sync_state: 'pending',
    server_rev: 0,
  };

  await run(
    db,
    'INSERT INTO recurring_rules(id,user_id,book_id,name,type,amount,currency,account_id,to_account_id,category_id,person_id,note,frequency,interval_step,by_day,start_date,end_date,max_count,current_count,mode,next_run_at,is_subscription,icon,color,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)',
    [
      rule.id,
      rule.user_id,
      rule.book_id,
      rule.name,
      rule.type,
      rule.amount,
      rule.currency,
      rule.account_id,
      rule.to_account_id,
      rule.category_id,
      rule.person_id,
      rule.note,
      rule.frequency,
      rule.interval_step,
      rule.by_day,
      rule.start_date,
      rule.end_date,
      rule.max_count,
      rule.current_count,
      rule.mode,
      rule.next_run_at,
      rule.is_subscription,
      rule.icon,
      rule.color,
      rule.created_at,
      rule.updated_at,
      rule.sync_state,
    ],
  );

  syncEngine.notifyWrite();
  return rule;
}

export async function updateRecurringRule(
  id: string,
  input: Partial<RecurringRuleInput>,
): Promise<void> {
  const db = await getDatabase();
  const existing = (
    await rows<RecurringRule>(
      db,
      'SELECT * FROM recurring_rules WHERE id=? AND deleted_at IS NULL',
      [id],
    )
  )[0];
  if (!existing) throw new Error('RULE_NOT_FOUND');

  const now = Date.now();
  await run(
    db,
    'UPDATE recurring_rules SET name=?,type=?,amount=?,account_id=?,to_account_id=?,category_id=?,person_id=?,note=?,frequency=?,interval_step=?,by_day=?,start_date=?,end_date=?,max_count=?,mode=?,is_subscription=?,icon=?,color=?,updated_at=?,sync_state=? WHERE id=?',
    [
      input.name !== undefined ? input.name.trim() : existing.name,
      input.type ?? existing.type,
      input.amount ?? existing.amount,
      input.accountId ?? existing.account_id,
      input.toAccountId !== undefined ? input.toAccountId : existing.to_account_id,
      input.categoryId !== undefined ? input.categoryId : existing.category_id,
      input.personId !== undefined ? input.personId : existing.person_id,
      input.note !== undefined ? input.note.trim() : existing.note,
      input.frequency ?? existing.frequency,
      input.intervalStep !== undefined ? Math.max(1, input.intervalStep) : existing.interval_step,
      input.byDay !== undefined ? input.byDay : existing.by_day,
      input.startDate ?? existing.start_date,
      input.endDate !== undefined ? input.endDate : existing.end_date,
      input.maxCount !== undefined ? input.maxCount : existing.max_count,
      input.mode ?? existing.mode,
      input.isSubscription !== undefined ? (input.isSubscription ? 1 : 0) : existing.is_subscription,
      input.icon !== undefined ? input.icon : existing.icon,
      input.color !== undefined ? input.color : existing.color,
      now,
      'pending',
      id,
    ],
  );
  syncEngine.notifyWrite();
}

export async function deleteRecurringRule(id: string): Promise<void> {
  const now = Date.now();
  await run(
    await getDatabase(),
    'UPDATE recurring_rules SET deleted_at=?,updated_at=?,sync_state=? WHERE id=?',
    [now, now, 'pending', id],
  );
  syncEngine.notifyWrite();
}

export async function listRecurringRules(
  bookId: string,
  options?: { isSubscription?: boolean },
): Promise<RecurringRuleView[]> {
  const db = await getDatabase();
  let sql = `
    SELECT r.*,
           a.name AS account_name,
           ta.name AS to_account_name,
           c.name AS category_name,
           c.i18n_key AS category_key,
           c.icon AS category_icon,
           c.color AS category_color,
           p.name AS person_name
    FROM recurring_rules r
    LEFT JOIN accounts a ON a.id = r.account_id
    LEFT JOIN accounts ta ON ta.id = r.to_account_id
    LEFT JOIN categories c ON c.id = r.category_id
    LEFT JOIN people p ON p.id = r.person_id
    WHERE r.book_id = ? AND r.deleted_at IS NULL
  `;
  const params: unknown[] = [bookId];
  if (options?.isSubscription !== undefined) {
    sql += ' AND r.is_subscription = ?';
    params.push(options.isSubscription ? 1 : 0);
  }
  sql += ' ORDER BY r.next_run_at ASC, r.created_at DESC';

  const rowsList = await rows<RecurringRuleView>(db, sql, params);
  const now = Date.now();
  return rowsList.map((r) => {
    const is_overdue = r.next_run_at < now;
    const days_until_run = Math.round((r.next_run_at - now) / 86_400_000);
    return {
      ...r,
      is_overdue,
      days_until_run,
    };
  });
}

export async function getRecurringRule(id: string): Promise<RecurringRuleView | null> {
  const db = await getDatabase();
  const sql = `
    SELECT r.*,
           a.name AS account_name,
           ta.name AS to_account_name,
           c.name AS category_name,
           c.i18n_key AS category_key,
           c.icon AS category_icon,
           c.color AS category_color,
           p.name AS person_name
    FROM recurring_rules r
    LEFT JOIN accounts a ON a.id = r.account_id
    LEFT JOIN accounts ta ON ta.id = r.to_account_id
    LEFT JOIN categories c ON c.id = r.category_id
    LEFT JOIN people p ON p.id = r.person_id
    WHERE r.id = ? AND r.deleted_at IS NULL
  `;
  const rowsList = await rows<RecurringRuleView>(db, sql, [id]);
  const r = rowsList[0];
  if (!r) return null;

  const now = Date.now();
  return {
    ...r,
    is_overdue: r.next_run_at < now,
    days_until_run: Math.round((r.next_run_at - now) / 86_400_000),
  };
}

export async function executeRecurringRuleNow(
  ruleId: string,
  customDate?: number,
): Promise<string> {
  const db = await getDatabase();
  const rule = (
    await rows<RecurringRule>(
      db,
      'SELECT * FROM recurring_rules WHERE id=? AND deleted_at IS NULL',
      [ruleId],
    )
  )[0];
  if (!rule) throw new Error('RULE_NOT_FOUND');

  const occurredAt = customDate ?? Date.now();
  const txId = await saveTransaction(rule.book_id, {
    type: rule.type,
    amount: rule.amount,
    accountId: rule.account_id,
    toAccountId: rule.to_account_id,
    categoryId: rule.category_id,
    occurredAt,
    note: rule.note || rule.name,
    recurringRuleId: rule.id,
  });

  const nextRunAt = calculateNextRun(
    rule.next_run_at,
    rule.frequency,
    rule.interval_step,
    rule.by_day,
  );
  const nextCount = rule.current_count + 1;
  const now = Date.now();

  await run(
    db,
    'UPDATE recurring_rules SET next_run_at=?, current_count=?, updated_at=?, sync_state=? WHERE id=?',
    [nextRunAt, nextCount, now, 'pending', rule.id],
  );

  syncEngine.notifyWrite();
  return txId;
}

export async function skipRecurringRuleNextRun(ruleId: string): Promise<void> {
  const db = await getDatabase();
  const rule = (
    await rows<RecurringRule>(
      db,
      'SELECT * FROM recurring_rules WHERE id=? AND deleted_at IS NULL',
      [ruleId],
    )
  )[0];
  if (!rule) throw new Error('RULE_NOT_FOUND');

  const nextRunAt = calculateNextRun(
    rule.next_run_at,
    rule.frequency,
    rule.interval_step,
    rule.by_day,
  );
  const now = Date.now();

  await run(
    db,
    'UPDATE recurring_rules SET next_run_at=?, updated_at=?, sync_state=? WHERE id=?',
    [nextRunAt, now, 'pending', rule.id],
  );

  syncEngine.notifyWrite();
}

export async function processDueRecurringRules(
  bookId: string,
): Promise<{ autoCreatedCount: number; reminderCount: number }> {
  const db = await getDatabase();
  const now = Date.now();
  const dueRules = await rows<RecurringRule>(
    db,
    'SELECT * FROM recurring_rules WHERE book_id=? AND deleted_at IS NULL AND next_run_at <= ?',
    [bookId, now],
  );

  let autoCreatedCount = 0;
  let reminderCount = 0;

  for (const rule of dueRules) {
    if (rule.max_count && rule.current_count >= rule.max_count) continue;
    if (rule.end_date && rule.next_run_at > rule.end_date) continue;

    if (rule.mode === 'auto_create') {
      await executeRecurringRuleNow(rule.id, rule.next_run_at);
      autoCreatedCount++;
    } else {
      reminderCount++;
    }
  }

  return { autoCreatedCount, reminderCount };
}

// -----------------------------------------------------------------------------
// Planning: Budgets with Rollover
// -----------------------------------------------------------------------------

export interface BudgetInput {
  categoryId?: string | null;
  amount: number;
  currency?: string;
  period?: string;
  rollover?: boolean;
}

export async function createBudget(
  bookId: string,
  input: BudgetInput,
): Promise<Budget> {
  const id = uuidv7();
  const now = Date.now();
  const db = await getDatabase();
  const book = (await rows<Book>(db, 'SELECT * FROM books WHERE id=?', [bookId]))[0];
  const currency = input.currency ?? book?.currency ?? 'BDT';

  const budget: Budget = {
    id,
    user_id: currentUserId,
    book_id: bookId,
    category_id: input.categoryId ?? null,
    amount: input.amount,
    currency,
    period: input.period ?? 'monthly',
    rollover: input.rollover ? 1 : 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    sync_state: 'pending',
    server_rev: 0,
  };

  await run(
    db,
    'INSERT INTO budgets(id,user_id,book_id,category_id,amount,currency,period,rollover,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,0)',
    [
      budget.id,
      budget.user_id,
      budget.book_id,
      budget.category_id,
      budget.amount,
      budget.currency,
      budget.period,
      budget.rollover,
      budget.created_at,
      budget.updated_at,
      budget.sync_state,
    ],
  );

  syncEngine.notifyWrite();
  return budget;
}

export async function updateBudget(
  id: string,
  input: Partial<BudgetInput>,
): Promise<void> {
  const db = await getDatabase();
  const existing = (
    await rows<Budget>(db, 'SELECT * FROM budgets WHERE id=? AND deleted_at IS NULL', [id])
  )[0];
  if (!existing) throw new Error('BUDGET_NOT_FOUND');

  const now = Date.now();
  await run(
    db,
    'UPDATE budgets SET category_id=?,amount=?,period=?,rollover=?,updated_at=?,sync_state=? WHERE id=?',
    [
      input.categoryId !== undefined ? input.categoryId : existing.category_id,
      input.amount ?? existing.amount,
      input.period ?? existing.period,
      input.rollover !== undefined ? (input.rollover ? 1 : 0) : existing.rollover,
      now,
      'pending',
      id,
    ],
  );
  syncEngine.notifyWrite();
}

export async function deleteBudget(id: string): Promise<void> {
  const now = Date.now();
  await run(
    await getDatabase(),
    'UPDATE budgets SET deleted_at=?,updated_at=?,sync_state=? WHERE id=?',
    [now, now, 'pending', id],
  );
  syncEngine.notifyWrite();
}

export async function listBudgets(bookId: string): Promise<Budget[]> {
  const db = await getDatabase();
  return rows<Budget>(
    db,
    'SELECT * FROM budgets WHERE book_id=? AND deleted_at IS NULL ORDER BY created_at DESC',
    [bookId],
  );
}

export async function getBudgetSummaries(
  bookId: string,
  targetMonth?: string,
): Promise<{ summaries: BudgetSummary[]; overall: BudgetSummary | null }> {
  const db = await getDatabase();
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const month = targetMonth || currentMonthStr;

  const [yearStr, mStr] = month.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(mStr, 10) - 1;

  const startOfMonth = new Date(y, m, 1).getTime();
  const endOfMonth = new Date(y, m + 1, 1).getTime();

  const startOfPrevMonth = new Date(y, m - 1, 1).getTime();
  const endOfPrevMonth = startOfMonth;

  const budgets = await listBudgets(bookId);
  const categories = await listCategories(bookId);

  const currentExpenses = await rows<{ category_id: string; total: number }>(
    db,
    `SELECT category_id, SUM(amount) as total
     FROM transactions
     WHERE book_id=? AND type='expense' AND parent_id IS NULL AND deleted_at IS NULL
       AND occurred_at >= ? AND occurred_at < ?
     GROUP BY category_id`,
    [bookId, startOfMonth, endOfMonth],
  );
  const currentSpendMap = new Map(currentExpenses.map((e) => [e.category_id, e.total]));

  const prevExpenses = await rows<{ category_id: string; total: number }>(
    db,
    `SELECT category_id, SUM(amount) as total
     FROM transactions
     WHERE book_id=? AND type='expense' AND parent_id IS NULL AND deleted_at IS NULL
       AND occurred_at >= ? AND occurred_at < ?
     GROUP BY category_id`,
    [bookId, startOfPrevMonth, endOfPrevMonth],
  );
  const prevSpendMap = new Map(prevExpenses.map((e) => [e.category_id, e.total]));

  const overallSpent = currentExpenses.reduce((acc, curr) => acc + curr.total, 0);
  const prevOverallSpent = prevExpenses.reduce((acc, curr) => acc + curr.total, 0);

  const summaries: BudgetSummary[] = [];
  let overallSummary: BudgetSummary | null = null;

  for (const b of budgets) {
    if (b.category_id === null) {
      let rolloverAmount = 0;
      if (b.rollover === 1) {
        rolloverAmount = Math.max(0, b.amount - prevOverallSpent);
      }
      const effectiveBudget = b.amount + rolloverAmount;
      const spent = overallSpent;
      const remaining = effectiveBudget - spent;
      const percentage =
        effectiveBudget > 0 ? Math.round((spent / effectiveBudget) * 100) : 0;
      const status: BudgetStatus =
        spent > effectiveBudget ? 'exceeded' : percentage >= 80 ? 'warning' : 'normal';

      overallSummary = {
        id: b.id,
        category_id: null,
        category_name: null,
        category_key: null,
        category_icon: 'donut_large',
        category_color: '#f97316',
        budget_amount: b.amount,
        effective_budget: effectiveBudget,
        spent_amount: spent,
        remaining_amount: remaining,
        percentage,
        status,
        rollover: b.rollover,
        rollover_amount: rolloverAmount,
      };
    } else {
      const cat = categories.find((c) => c.id === b.category_id);
      const spent = currentSpendMap.get(b.category_id) ?? 0;
      let rolloverAmount = 0;
      if (b.rollover === 1) {
        const prevSpent = prevSpendMap.get(b.category_id) ?? 0;
        rolloverAmount = Math.max(0, b.amount - prevSpent);
      }
      const effectiveBudget = b.amount + rolloverAmount;
      const remaining = effectiveBudget - spent;
      const percentage =
        effectiveBudget > 0 ? Math.round((spent / effectiveBudget) * 100) : 0;
      const status: BudgetStatus =
        spent > effectiveBudget ? 'exceeded' : percentage >= 80 ? 'warning' : 'normal';

      summaries.push({
        id: b.id,
        category_id: b.category_id,
        category_name: cat?.name ?? null,
        category_key: cat?.i18n_key ?? null,
        category_icon: cat?.icon ?? 'category',
        category_color: cat?.color ?? '#14b8a6',
        budget_amount: b.amount,
        effective_budget: effectiveBudget,
        spent_amount: spent,
        remaining_amount: remaining,
        percentage,
        status,
        rollover: b.rollover,
        rollover_amount: rolloverAmount,
      });
    }
  }

  return { summaries, overall: overallSummary };
}

// -----------------------------------------------------------------------------
// Planning: Savings Goals & Celebration
// -----------------------------------------------------------------------------

export interface GoalInput {
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  currency?: string;
  targetDate: number;
  linkedAccountId?: string | null;
  currentAmount?: number;
  note?: string;
}

export async function createGoal(
  bookId: string,
  input: GoalInput,
): Promise<Goal> {
  const id = uuidv7();
  const now = Date.now();
  const db = await getDatabase();
  const book = (await rows<Book>(db, 'SELECT * FROM books WHERE id=?', [bookId]))[0];
  const currency = input.currency ?? book?.currency ?? 'BDT';
  const initialCurrent = input.currentAmount ?? 0;
  const isAchieved = initialCurrent >= input.targetAmount;

  const goal: Goal = {
    id,
    user_id: currentUserId,
    book_id: bookId,
    name: input.name.trim(),
    icon: input.icon,
    color: input.color,
    target_amount: input.targetAmount,
    currency,
    target_date: input.targetDate,
    linked_account_id: input.linkedAccountId ?? null,
    current_amount: initialCurrent,
    achieved_at: isAchieved ? now : null,
    note: input.note?.trim() ?? '',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    sync_state: 'pending',
    server_rev: 0,
  };

  await run(
    db,
    'INSERT INTO goals(id,user_id,book_id,name,icon,color,target_amount,currency,target_date,linked_account_id,current_amount,achieved_at,note,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)',
    [
      goal.id,
      goal.user_id,
      goal.book_id,
      goal.name,
      goal.icon,
      goal.color,
      goal.target_amount,
      goal.currency,
      goal.target_date,
      goal.linked_account_id,
      goal.current_amount,
      goal.achieved_at,
      goal.note,
      goal.created_at,
      goal.updated_at,
      goal.sync_state,
    ],
  );

  syncEngine.notifyWrite();
  return goal;
}

export async function updateGoal(
  id: string,
  input: Partial<GoalInput>,
): Promise<void> {
  const db = await getDatabase();
  const existing = (
    await rows<Goal>(db, 'SELECT * FROM goals WHERE id=? AND deleted_at IS NULL', [id])
  )[0];
  if (!existing) throw new Error('GOAL_NOT_FOUND');

  const now = Date.now();
  const targetAmount = input.targetAmount ?? existing.target_amount;
  const currentAmount =
    input.currentAmount !== undefined ? input.currentAmount : existing.current_amount;
  const isAchieved = currentAmount >= targetAmount;
  const achievedAt = isAchieved ? (existing.achieved_at ?? now) : null;

  await run(
    db,
    'UPDATE goals SET name=?,icon=?,color=?,target_amount=?,target_date=?,linked_account_id=?,current_amount=?,achieved_at=?,note=?,updated_at=?,sync_state=? WHERE id=?',
    [
      input.name !== undefined ? input.name.trim() : existing.name,
      input.icon ?? existing.icon,
      input.color ?? existing.color,
      targetAmount,
      input.targetDate ?? existing.target_date,
      input.linkedAccountId !== undefined ? input.linkedAccountId : existing.linked_account_id,
      currentAmount,
      achievedAt,
      input.note !== undefined ? input.note.trim() : existing.note,
      now,
      'pending',
      id,
    ],
  );
  syncEngine.notifyWrite();
}

export async function deleteGoal(id: string): Promise<void> {
  const now = Date.now();
  await run(
    await getDatabase(),
    'UPDATE goals SET deleted_at=?,updated_at=?,sync_state=? WHERE id=?',
    [now, now, 'pending', id],
  );
  syncEngine.notifyWrite();
}

export async function listGoals(bookId: string): Promise<GoalView[]> {
  const db = await getDatabase();
  const sql = `
    SELECT g.*, a.name AS linked_account_name
    FROM goals g
    LEFT JOIN accounts a ON a.id = g.linked_account_id
    WHERE g.book_id = ? AND g.deleted_at IS NULL
    ORDER BY (g.achieved_at IS NOT NULL) ASC, g.target_date ASC, g.created_at DESC
  `;
  const rawGoals = await rows<Goal & { linked_account_name?: string | null }>(db, sql, [bookId]);
  const now = Date.now();

  return rawGoals.map((g) => {
    const is_achieved = g.current_amount >= g.target_amount || g.achieved_at !== null;
    const percentage =
      g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
    const days_remaining = Math.max(0, Math.round((g.target_date - now) / 86_400_000));
    const required_monthly_saving = calculateRequiredMonthlySavings(
      g.target_amount,
      g.current_amount,
      g.target_date,
      now,
    );

    return {
      ...g,
      percentage,
      required_monthly_saving,
      days_remaining,
      is_achieved,
    };
  });
}

export async function getGoal(id: string): Promise<GoalView | null> {
  const db = await getDatabase();
  const sql = `
    SELECT g.*, a.name AS linked_account_name
    FROM goals g
    LEFT JOIN accounts a ON a.id = g.linked_account_id
    WHERE g.id = ? AND g.deleted_at IS NULL
  `;
  const rawGoals = await rows<Goal & { linked_account_name?: string | null }>(db, sql, [id]);
  const g = rawGoals[0];
  if (!g) return null;

  const now = Date.now();
  const is_achieved = g.current_amount >= g.target_amount || g.achieved_at !== null;
  const percentage =
    g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
  const days_remaining = Math.max(0, Math.round((g.target_date - now) / 86_400_000));
  const required_monthly_saving = calculateRequiredMonthlySavings(
    g.target_amount,
    g.current_amount,
    g.target_date,
    now,
  );

  return {
    ...g,
    percentage,
    required_monthly_saving,
    days_remaining,
    is_achieved,
  };
}

export async function contributeToGoal(input: {
  goalId: string;
  accountId: string;
  amount: number;
  date: number;
  note?: string;
}): Promise<string> {
  const db = await getDatabase();
  const goal = (
    await rows<Goal>(db, 'SELECT * FROM goals WHERE id=? AND deleted_at IS NULL', [input.goalId])
  )[0];
  if (!goal) throw new Error('GOAL_NOT_FOUND');

  // 1. Create transaction linked to goal
  const txId = await saveTransaction(goal.book_id, {
    type: 'expense',
    amount: input.amount,
    accountId: input.accountId,
    occurredAt: input.date,
    note: input.note || `Goal: ${goal.name}`,
    goalId: goal.id,
  });

  // 2. Increment goal current_amount
  const newAmount = goal.current_amount + input.amount;
  const isAchieved = newAmount >= goal.target_amount;
  const achievedAt = isAchieved ? (goal.achieved_at ?? Date.now()) : null;
  const now = Date.now();

  await run(
    db,
    'UPDATE goals SET current_amount=?, achieved_at=?, updated_at=?, sync_state=? WHERE id=?',
    [newAmount, achievedAt, now, 'pending', goal.id],
  );

  syncEngine.notifyWrite();
  return txId;
}

// ==========================================
// 14. Exchange Rates
// ==========================================

export async function listExchangeRates(bookId: string): Promise<ExchangeRate[]> {
  const db = await getDatabase();
  return rows<ExchangeRate>(
    db,
    'SELECT * FROM exchange_rates WHERE book_id=? AND deleted_at IS NULL ORDER BY base, quote',
    [bookId],
  );
}

export async function saveExchangeRate(
  bookId: string,
  input: {
    base: string;
    quote: string;
    rate: number;
    date?: number;
    source?: 'server' | 'manual';
  },
  id?: string,
): Promise<string> {
  const db = await getDatabase();
  const rateId = id ?? uuidv7();
  const now = Date.now();
  const date = input.date ?? now;
  const source = input.source ?? 'manual';

  const existing = (
    await rows<ExchangeRate>(
      db,
      'SELECT * FROM exchange_rates WHERE book_id=? AND base=? AND quote=? AND deleted_at IS NULL',
      [bookId, input.base.toUpperCase(), input.quote.toUpperCase()],
    )
  )[0];

  if (existing) {
    if (existing.source === source && existing.rate === input.rate) return existing.id;
    await run(
      db,
      'UPDATE exchange_rates SET rate=?, date=?, source=?, updated_at=?, sync_state=? WHERE id=?',
      [input.rate, date, source, now, 'pending', existing.id],
    );
    syncEngine.notifyWrite();
    return existing.id;
  }

  await run(
    db,
    'INSERT INTO exchange_rates (id, user_id, book_id, base, quote, rate, date, source, created_at, updated_at, sync_state, server_rev) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending", 0)',
    [
      rateId,
      currentUserId,
      bookId,
      input.base.toUpperCase(),
      input.quote.toUpperCase(),
      input.rate,
      date,
      source,
      now,
      now,
    ],
  );
  syncEngine.notifyWrite();
  return rateId;
}

export async function getExchangeRate(
  bookId: string,
  base: string,
  quote: string,
): Promise<number | null> {
  const b = base.toUpperCase();
  const q = quote.toUpperCase();
  if (b === q) return 1.0;

  const db = await getDatabase();
  // Check direct rate
  const direct = (
    await rows<ExchangeRate>(
      db,
      'SELECT rate FROM exchange_rates WHERE book_id=? AND base=? AND quote=? AND deleted_at IS NULL',
      [bookId, b, q],
    )
  )[0];
  if (direct && direct.rate > 0) return direct.rate;

  // Check inverse rate
  const inverse = (
    await rows<ExchangeRate>(
      db,
      'SELECT rate FROM exchange_rates WHERE book_id=? AND base=? AND quote=? AND deleted_at IS NULL',
      [bookId, q, b],
    )
  )[0];
  if (inverse && inverse.rate > 0) return 1 / inverse.rate;

  return null;
}

export async function fetchAndStoreServerRates(
  bookId: string,
  baseCurrency = 'BDT',
): Promise<void> {
  try {
    if (!getApiBaseUrl()) return;
    const data = await api<{ base: string; rates: Record<string, number> }>(
      `rates?base=${encodeURIComponent(baseCurrency)}`,
    );
    if (!data?.rates) return;

    for (const [quote, rate] of Object.entries(data.rates)) {
      if (rate && typeof rate === 'number' && rate > 0) {
        await saveExchangeRate(bookId, {
          base: data.base,
          quote,
          rate,
          source: 'server',
        });
      }
    }
  } catch {
    // Offline or network error - skip silently
  }
}

// ==========================================
// 15. Assets and Investments
// ==========================================

export async function createAsset(
  bookId: string,
  input: {
    type: AssetType;
    name: string;
    institution?: string | null;
    principal: number;
    currentValue?: number;
    profitRate?: number | null;
    startDate: number;
    maturityDate?: number | null;
    unit?: string | null;
    currency: string;
    note?: string;
    fundingAccountId?: string | null;
  },
): Promise<string> {
  if (input.principal < 0 || (input.currentValue !== undefined && input.currentValue < 0)) {
    throw new Error('INVALID_AMOUNT');
  }

  const db = await getDatabase();
  const assetId = uuidv7();
  const valuationId = uuidv7();
  const now = Date.now();
  const curVal = input.currentValue !== undefined ? input.currentValue : input.principal;

  await run(
    db,
    'INSERT INTO assets (id, user_id, book_id, type, name, institution, principal, current_value, profit_rate, start_date, maturity_date, unit, currency, note, created_at, updated_at, sync_state, server_rev) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending", 0)',
    [
      assetId,
      currentUserId,
      bookId,
      input.type,
      input.name.trim(),
      input.institution?.trim() || null,
      input.principal,
      curVal,
      input.profitRate ?? null,
      input.startDate,
      input.maturityDate ?? null,
      input.unit?.trim() || null,
      input.currency,
      input.note?.trim() || '',
      now,
      now,
    ],
  );

  // Initial valuation
  await run(
    db,
    'INSERT INTO asset_valuations (id, user_id, book_id, asset_id, date, value, created_at, updated_at, sync_state, server_rev) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "pending", 0)',
    [
      valuationId,
      currentUserId,
      bookId,
      assetId,
      input.startDate,
      curVal,
      now,
      now,
    ],
  );

  // Optional funding account transaction
  if (input.fundingAccountId && input.principal > 0) {
    await saveTransaction(bookId, {
      type: 'expense',
      amount: input.principal,
      accountId: input.fundingAccountId,
      occurredAt: input.startDate,
      note: `Investment: ${input.name.trim()}`,
      assetId,
    });
  }

  syncEngine.notifyWrite();
  return assetId;
}

export async function updateAsset(
  id: string,
  input: {
    type?: AssetType;
    name?: string;
    institution?: string | null;
    principal?: number;
    currentValue?: number;
    profitRate?: number | null;
    startDate?: number;
    maturityDate?: number | null;
    unit?: string | null;
    currency?: string;
    note?: string;
  },
): Promise<void> {
  const db = await getDatabase();
  const asset = (
    await rows<Asset>(db, 'SELECT * FROM assets WHERE id=? AND deleted_at IS NULL', [id])
  )[0];
  if (!asset) throw new Error('ASSET_NOT_FOUND');

  const now = Date.now();
  const type = input.type ?? asset.type;
  const name = input.name !== undefined ? input.name.trim() : asset.name;
  const institution = input.institution !== undefined ? input.institution?.trim() || null : asset.institution;
  const principal = input.principal !== undefined ? input.principal : asset.principal;
  const currentValue = input.currentValue !== undefined ? input.currentValue : asset.current_value;
  const profitRate = input.profitRate !== undefined ? input.profitRate : asset.profit_rate;
  const startDate = input.startDate !== undefined ? input.startDate : asset.start_date;
  const maturityDate = input.maturityDate !== undefined ? input.maturityDate : asset.maturity_date;
  const unit = input.unit !== undefined ? input.unit?.trim() || null : asset.unit;
  const currency = input.currency ?? asset.currency;
  const note = input.note !== undefined ? input.note.trim() : asset.note;

  await run(
    db,
    'UPDATE assets SET type=?, name=?, institution=?, principal=?, current_value=?, profit_rate=?, start_date=?, maturity_date=?, unit=?, currency=?, note=?, updated_at=?, sync_state="pending" WHERE id=?',
    [
      type,
      name,
      institution,
      principal,
      currentValue,
      profitRate,
      startDate,
      maturityDate,
      unit,
      currency,
      note,
      now,
      id,
    ],
  );

  syncEngine.notifyWrite();
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await run(
    db,
    'UPDATE assets SET deleted_at=?, updated_at=?, sync_state="pending" WHERE id=?',
    [now, now, id],
  );
  await run(
    db,
    'UPDATE asset_valuations SET deleted_at=?, updated_at=?, sync_state="pending" WHERE asset_id=?',
    [now, now, id],
  );
  syncEngine.notifyWrite();
}

export async function listAssets(bookId: string, type?: AssetType): Promise<AssetView[]> {
  const db = await getDatabase();
  let sql = 'SELECT * FROM assets WHERE book_id=? AND deleted_at IS NULL';
  const params: unknown[] = [bookId];
  if (type) {
    sql += ' AND type=?';
    params.push(type);
  }
  sql += ' ORDER BY current_value DESC, created_at DESC';

  const assetList = await rows<Asset>(db, sql, params);
  const now = Date.now();

  return assetList.map((a) => {
    const profit = a.current_value - a.principal;
    const profitPercentage = a.principal > 0 ? (profit / a.principal) * 100 : 0;
    let daysToMaturity: number | null = null;
    let isMatured = false;
    let isMaturingSoon = false;

    if (a.maturity_date) {
      daysToMaturity = Math.ceil((a.maturity_date - now) / 86400000);
      isMatured = a.maturity_date < now;
      isMaturingSoon = !isMatured && daysToMaturity <= 30;
    }

    return {
      ...a,
      profit,
      profitPercentage,
      daysToMaturity,
      isMatured,
      isMaturingSoon,
    };
  });
}

export async function getAsset(id: string): Promise<AssetView | null> {
  const db = await getDatabase();
  const asset = (
    await rows<Asset>(db, 'SELECT * FROM assets WHERE id=? AND deleted_at IS NULL', [id])
  )[0];
  if (!asset) return null;

  const now = Date.now();
  const profit = asset.current_value - asset.principal;
  const profitPercentage = asset.principal > 0 ? (profit / asset.principal) * 100 : 0;
  let daysToMaturity: number | null = null;
  let isMatured = false;
  let isMaturingSoon = false;

  if (asset.maturity_date) {
    daysToMaturity = Math.ceil((asset.maturity_date - now) / 86400000);
    isMatured = asset.maturity_date < now;
    isMaturingSoon = !isMatured && daysToMaturity <= 30;
  }

  return {
    ...asset,
    profit,
    profitPercentage,
    daysToMaturity,
    isMatured,
    isMaturingSoon,
  };
}

export async function recordAssetValuation(
  assetId: string,
  input: { value: number; date: number },
): Promise<string> {
  if (input.value < 0) throw new Error('INVALID_AMOUNT');
  const db = await getDatabase();
  const asset = (
    await rows<Asset>(db, 'SELECT * FROM assets WHERE id=? AND deleted_at IS NULL', [assetId])
  )[0];
  if (!asset) throw new Error('ASSET_NOT_FOUND');

  const valuationId = uuidv7();
  const now = Date.now();

  await run(
    db,
    'INSERT INTO asset_valuations (id, user_id, book_id, asset_id, date, value, created_at, updated_at, sync_state, server_rev) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "pending", 0)',
    [
      valuationId,
      currentUserId,
      asset.book_id,
      assetId,
      input.date,
      input.value,
      now,
      now,
    ],
  );

  await run(
    db,
    'UPDATE assets SET current_value=?, updated_at=?, sync_state="pending" WHERE id=?',
    [input.value, now, assetId],
  );

  syncEngine.notifyWrite();
  return valuationId;
}

export async function listAssetValuations(assetId: string): Promise<AssetValuation[]> {
  const db = await getDatabase();
  return rows<AssetValuation>(
    db,
    'SELECT * FROM asset_valuations WHERE asset_id=? AND deleted_at IS NULL ORDER BY date ASC, created_at ASC',
    [assetId],
  );
}

export async function getWealthSummary(bookId: string): Promise<WealthSummary> {
  const assets = await listAssets(bookId);

  let totalInvested = 0;
  let currentValue = 0;

  const byType: Record<AssetType, { count: number; totalValue: number; totalInvested: number }> = {
    fdr: { count: 0, totalValue: 0, totalInvested: 0 },
    dps: { count: 0, totalValue: 0, totalInvested: 0 },
    sanchayapatra: { count: 0, totalValue: 0, totalInvested: 0 },
    gold: { count: 0, totalValue: 0, totalInvested: 0 },
    land: { count: 0, totalValue: 0, totalInvested: 0 },
    shares: { count: 0, totalValue: 0, totalInvested: 0 },
    crypto: { count: 0, totalValue: 0, totalInvested: 0 },
    other: { count: 0, totalValue: 0, totalInvested: 0 },
  };

  const maturingSoon: AssetView[] = [];

  for (const a of assets) {
    totalInvested = addMinor(totalInvested, a.principal);
    currentValue = addMinor(currentValue, a.current_value);

    if (byType[a.type]) {
      byType[a.type].count++;
      byType[a.type].totalValue = addMinor(byType[a.type].totalValue, a.current_value);
      byType[a.type].totalInvested = addMinor(byType[a.type].totalInvested, a.principal);
    }

    if (a.isMaturingSoon || a.isMatured) {
      maturingSoon.push(a);
    }
  }

  const totalProfit = currentValue - totalInvested;
  const profitPercentage = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  return {
    totalInvested,
    currentValue,
    totalProfit,
    profitPercentage,
    assetCount: assets.length,
    byType,
    maturingSoon,
  };
}

export async function getNetWorthHistory(bookId: string, days = 30): Promise<NetWorthHistoryPoint[]> {
  const db = await getDatabase();
  const accounts = await listAccounts(bookId, true);
  const activeAccountIds = new Set(accounts.filter((x) => x.include_in_total).map((x) => x.id));
  const currencyByAccount = new Map(accounts.map((account) => [account.id, account.currency]));
  const totalOpening = accounts
    .filter((x) => activeAccountIds.has(x.id))
    .reduce((s, a) => addMinor(s, a.opening_balance), 0);

  const transactions = await rows<Transaction>(
    db,
    'SELECT * FROM transactions WHERE book_id=? AND parent_id IS NULL AND deleted_at IS NULL ORDER BY occurred_at ASC',
    [bookId],
  );

  const debts = await rows<Debt>(
    db,
    'SELECT * FROM debts WHERE book_id=? AND deleted_at IS NULL ORDER BY date ASC',
    [bookId],
  );

  const debtEntries = await rows<{ kind: string; amount: number; occurred_at: number; debt_id: string }>(
    db,
    'SELECT kind, amount, occurred_at, debt_id FROM debt_entries WHERE book_id=? AND deleted_at IS NULL ORDER BY occurred_at ASC',
    [bookId],
  );

  const valuations = await rows<{ asset_id: string; date: number; value: number }>(
    db,
    'SELECT asset_id, date, value FROM asset_valuations WHERE book_id=? AND deleted_at IS NULL ORDER BY date ASC',
    [bookId],
  );

  const assets = await rows<Asset>(
    db,
    'SELECT id, start_date, principal, current_value FROM assets WHERE book_id=? AND deleted_at IS NULL',
    [bookId],
  );

  const now = new Date();
  const points: NetWorthHistoryPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59, 999);
    const time = d.getTime();
    const dateStr = d.toISOString().slice(0, 10);

    // 1. Account balances up to day
    let accountDeltas = 0;
    for (const tx of transactions) {
      if (tx.occurred_at > time) break;
      if (activeAccountIds.has(tx.account_id)) {
        if (tx.type === 'income') accountDeltas = addMinor(accountDeltas, tx.amount);
        else if (tx.type === 'expense') accountDeltas = addMinor(accountDeltas, -tx.amount);
        else if (tx.type === 'transfer') accountDeltas = addMinor(accountDeltas, -(tx.amount + (tx.fee ?? 0)));
      }
      if (tx.type === 'transfer' && tx.to_account_id && activeAccountIds.has(tx.to_account_id)) {
        const added = destinationMinor(
          tx.amount,
          tx.currency,
          currencyByAccount.get(tx.to_account_id),
          tx.exchange_rate,
        );
        accountDeltas = addMinor(accountDeltas, added);
      }
    }

    for (const de of debtEntries) {
      if (de.occurred_at > time) break;
      if (de.kind === 'lend' || de.kind === 'repay') accountDeltas = addMinor(accountDeltas, -de.amount);
      else if (de.kind === 'borrow' || de.kind === 'collect') accountDeltas = addMinor(accountDeltas, de.amount);
    }

    const currentBalances = addMinor(totalOpening, accountDeltas);

    // 2. Receivables & Payables up to day
    let currentReceivables = 0;
    let currentPayables = 0;
    for (const debt of debts) {
      if (debt.date > time) continue;
      let outstanding = debt.amount;
      for (const de of debtEntries) {
        if (de.debt_id !== debt.id || de.occurred_at > time) continue;
        if (de.kind === 'collect' || de.kind === 'repay' || de.kind === 'write_off') {
          outstanding = Math.max(0, outstanding - de.amount);
        } else if (de.kind === 'lend' || de.kind === 'borrow') {
          outstanding = addMinor(outstanding, de.amount);
        }
      }
      if (debt.direction === 'receivable') {
        currentReceivables = addMinor(currentReceivables, outstanding);
      } else {
        currentPayables = addMinor(currentPayables, outstanding);
      }
    }

    // 3. Asset valuations up to day
    let currentInvestments = 0;
    for (const asset of assets) {
      if (asset.start_date > time) continue;
      // Find latest valuation on or before time
      let val = asset.principal;
      for (const v of valuations) {
        if (v.asset_id === asset.id && v.date <= time) {
          val = v.value;
        }
      }
      currentInvestments = addMinor(currentInvestments, val);
    }

    const totalAssets = addMinor(Math.max(0, currentBalances), currentReceivables, currentInvestments);
    const totalLiabilities = addMinor(Math.max(0, -currentBalances), currentPayables);
    const netWorth = totalAssets - totalLiabilities;

    points.push({
      date: dateStr,
      timestamp: time,
      assets: totalAssets,
      liabilities: totalLiabilities,
      netWorth,
    });
  }

  return points;
}

export async function getReportData(
  bookId: string,
  from: number,
  to: number,
): Promise<ReportData> {
  const allTx = await listTransactions({ bookId, from, to, limit: 1000 });
  const categories = await listCategories(bookId);
  const accounts = await listAccounts(bookId);
  const tags = await listTags(bookId);

  let totalIncome = 0;
  let totalExpense = 0;

  const categoryMap = new Map<string, { amount: number; count: number }>();
  const tagMap = new Map<string, { amount: number; count: number }>();
  const accountMap = new Map<string, { income: number; expense: number }>();
  const dayMap = new Map<string, { day: number; expense: number; income: number }>();

  for (const tx of allTx) {
    if (tx.type === 'income') {
      totalIncome = addMinor(totalIncome, tx.amount);
      if (tx.account_id) {
        const acc = accountMap.get(tx.account_id) ?? { income: 0, expense: 0 };
        acc.income = addMinor(acc.income, tx.amount);
        accountMap.set(tx.account_id, acc);
      }
    } else if (tx.type === 'expense') {
      totalExpense = addMinor(totalExpense, tx.amount);
      const catId = tx.category_id ?? 'uncategorized';
      const cat = categoryMap.get(catId) ?? { amount: 0, count: 0 };
      cat.amount = addMinor(cat.amount, tx.amount);
      cat.count += 1;
      categoryMap.set(catId, cat);

      if (tx.account_id) {
        const acc = accountMap.get(tx.account_id) ?? { income: 0, expense: 0 };
        acc.expense = addMinor(acc.expense, tx.amount);
        accountMap.set(tx.account_id, acc);
      }

      if (tx.tags) {
        const tagNames = tx.tags.split(',').map((s) => s.trim());
        for (const tName of tagNames) {
          const foundTag = tags.find((t) => t.name.toLowerCase() === tName.toLowerCase());
          if (foundTag) {
            const tEntry = tagMap.get(foundTag.id) ?? { amount: 0, count: 0 };
            tEntry.amount = addMinor(tEntry.amount, tx.amount);
            tEntry.count += 1;
            tagMap.set(foundTag.id, tEntry);
          }
        }
      }
    }

    // Daily distribution
    const d = new Date(tx.occurred_at);
    const dateStr = d.toISOString().slice(0, 10);
    const dayPoint = dayMap.get(dateStr) ?? { day: d.getDate(), expense: 0, income: 0 };
    if (tx.type === 'expense') dayPoint.expense = addMinor(dayPoint.expense, tx.amount);
    if (tx.type === 'income') dayPoint.income = addMinor(dayPoint.income, tx.amount);
    dayMap.set(dateStr, dayPoint);
  }

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;

  // Elapsed days in period
  const durationDays = Math.max(1, Math.round((to - from) / (1000 * 60 * 60 * 24)));
  const now = Date.now();
  const daysPassed = Math.max(1, Math.min(durationDays, Math.round((Math.min(now, to) - from) / (1000 * 60 * 60 * 24))));
  const dailyAverageExpense = Math.round(totalExpense / daysPassed);
  const monthEndForecast = dailyAverageExpense * durationDays;

  // Category breakdown
  const categoryBreakdown: ReportCategoryBreakdown[] = [];
  categoryMap.forEach((val, catId) => {
    const matched = categories.find((c) => c.id === catId);
    categoryBreakdown.push({
      categoryId: catId,
      name: matched?.name ?? (catId === 'uncategorized' ? 'Other' : 'Category'),
      icon: matched?.icon ?? 'category',
      color: matched?.color ?? '#64748b',
      amount: val.amount,
      percentage: totalExpense > 0 ? Math.round((val.amount / totalExpense) * 100) : 0,
      count: val.count,
    });
  });
  categoryBreakdown.sort((a, b) => b.amount - a.amount);

  // Tag breakdown
  const tagBreakdown: ReportTagBreakdown[] = [];
  tagMap.forEach((val, tagId) => {
    const matched = tags.find((t) => t.id === tagId);
    tagBreakdown.push({
      tagId,
      name: matched?.name ?? 'Tag',
      amount: val.amount,
      count: val.count,
    });
  });
  tagBreakdown.sort((a, b) => b.amount - a.amount);

  // Account breakdown
  const accountBreakdown: ReportAccountBreakdown[] = [];
  accountMap.forEach((val, accId) => {
    const matched = accounts.find((a) => a.id === accId);
    accountBreakdown.push({
      accountId: accId,
      name: matched?.name ?? 'Account',
      type: matched?.type ?? 'cash',
      currency: matched?.currency ?? 'BDT',
      income: val.income,
      expense: val.expense,
      net: val.income - val.expense,
    });
  });
  accountBreakdown.sort((a, b) => b.expense - a.expense);

  // Daily trend
  const dailyTrend: ReportDailyPoint[] = Array.from(dayMap.entries())
    .map(([date, val]) => ({ date, dayOfMonth: val.day, expense: val.expense, income: val.income }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top expenses
  const topExpenses = allTx.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 10);

  // Comparison period
  const duration = to - from;
  const prevFrom = from - duration;
  const prevTo = from;
  const prevTx = await listTransactions({ bookId, from: prevFrom, to: prevTo, limit: 1000 });
  let prevIncome = 0;
  let prevExpense = 0;
  for (const pt of prevTx) {
    if (pt.type === 'income') prevIncome = addMinor(prevIncome, pt.amount);
    if (pt.type === 'expense') prevExpense = addMinor(prevExpense, pt.amount);
  }
  const incomeDeltaPct = prevIncome > 0 ? Math.round(((totalIncome - prevIncome) / prevIncome) * 100) : 0;
  const expenseDeltaPct = prevExpense > 0 ? Math.round(((totalExpense - prevExpense) / prevExpense) * 100) : 0;

  return {
    from,
    to,
    totalIncome,
    totalExpense,
    netSavings,
    savingsRate,
    dailyAverageExpense,
    monthEndForecast,
    categories: categoryBreakdown,
    tags: tagBreakdown,
    accounts: accountBreakdown,
    dailyTrend,
    topExpenses,
    comparison: {
      prevIncome,
      prevExpense,
      incomeDeltaPct,
      expenseDeltaPct,
    },
  };
}

export async function getCalendarData(
  bookId: string,
  year: number,
  month: number, // 1-12
): Promise<Record<string, CalendarDayData>> {
  const start = new Date(year, month - 1, 1).getTime();
  const end = new Date(year, month, 1).getTime();

  const txList = await listTransactions({ bookId, from: start, to: end, limit: 1000 });
  const result: Record<string, CalendarDayData> = {};

  for (const tx of txList) {
    const d = new Date(tx.occurred_at);
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!result[dateKey]) {
      result[dateKey] = {
        date: dateKey,
        day: d.getDate(),
        income: 0,
        expense: 0,
        net: 0,
        count: 0,
        transactions: [],
      };
    }
    const day = result[dateKey];
    day.count += 1;
    day.transactions.push(tx);
    if (tx.type === 'income') {
      day.income = addMinor(day.income, tx.amount);
      day.net += tx.amount;
    } else if (tx.type === 'expense') {
      day.expense = addMinor(day.expense, tx.amount);
      day.net -= tx.amount;
    }
  }

  return result;
}

export async function searchAll(bookId: string, query: string): Promise<GlobalSearchResult> {
  const term = query.trim();
  if (!term) {
    return { transactions: [], people: [], accounts: [], assets: [], documents: [] };
  }

  const txs = await listTransactions({ bookId, search: term, limit: 20 });
  const people = await rows<{ id: string; name: string; phone: string | null }>(
    await getDatabase(),
    'SELECT id, name, phone FROM people WHERE book_id=? AND deleted_at IS NULL',
    [bookId],
  );
  const accounts = await listAccounts(bookId);
  const assets = await listAssets(bookId);
  const docs = await listDocuments(bookId);

  const lower = term.toLowerCase();

  const matchedPeople = people
    .filter((p: { name: string; phone: string | null }) => p.name.toLowerCase().includes(lower) || (p.phone && p.phone.includes(lower)))
    .map((p: { id: string; name: string; phone: string | null }) => ({ id: p.id, name: p.name, phone: p.phone, balance: 0 }));

  const matchedAccounts = accounts
    .filter((a) => a.name.toLowerCase().includes(lower) || a.currency.toLowerCase().includes(lower))
    .map((a) => ({ id: a.id, name: a.name, type: a.type, currency: a.currency, balance: 0 }));

  const matchedAssets = assets
    .filter((a) => a.name.toLowerCase().includes(lower) || (a.institution && a.institution.toLowerCase().includes(lower)))
    .map((a) => ({ id: a.id, name: a.name, type: a.type, current_value: a.current_value, currency: a.currency }));

  const matchedDocs = docs
    .filter((d) => d.title.toLowerCase().includes(lower) || (d.note && d.note.toLowerCase().includes(lower)))
    .map((d) => ({ id: d.id, title: d.title, folder: d.folder }));

  return {
    transactions: txs,
    people: matchedPeople,
    accounts: matchedAccounts,
    assets: matchedAssets,
    documents: matchedDocs,
  };
}

export async function importTransactionsFromCsv(
  bookId: string,
  rows: CsvImportRow[],
): Promise<{ imported: number; duplicatesSkipped: number }> {
  let imported = 0;
  let duplicatesSkipped = 0;

  const existingTx = await listTransactions({ bookId, limit: 1000 });

  for (const r of rows) {
    const timestamp = typeof r.date === 'number' ? r.date : new Date(r.date).getTime();
    const isDup = existingTx.some(
      (t) =>
        t.type === r.type &&
        t.amount === r.amount &&
        t.account_id === r.accountId &&
        Math.abs(t.occurred_at - timestamp) < 86400000 &&
        (r.note ? t.note === r.note : true)
    );

    if (isDup) {
      duplicatesSkipped += 1;
      continue;
    }

    await saveTransaction(bookId, {
      accountId: r.accountId,
      categoryId: r.categoryId || null,
      type: r.type,
      amount: r.amount,
      fee: 0,
      occurredAt: timestamp,
      note: r.note ?? '',
      tagIds: [],
    });
    imported += 1;
  }

  return { imported, duplicatesSkipped };
}



