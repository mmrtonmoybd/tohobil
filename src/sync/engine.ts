import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { getDatabase, transaction } from '../db/connection';
import { token } from '../app/identity';
import { pushChanges, pullChanges } from './api';
import { resolveConflict } from './merge';
import { getBackoffDelay } from './backoff';
import type {
  SyncChangeSet,
  SyncPullResult,
  SyncPushResult,
  SyncState,
  SyncStatus,
} from './types';
import type {
  Account,
  Asset,
  AssetValuation,
  Attachment,
  Book,
  Budget,
  Category,
  Debt,
  DebtEntry,
  DebtInstallment,
  Document,
  ExchangeRate,
  Favorite,
  Goal,
  Person,
  RecurringRule,
  Tag,
  Transaction,
} from '../db/types';

const CURSOR_KEY = 'tohobil.sync.cursor';
const LAST_SYNC_KEY = 'tohobil.sync.last_time';

export type SyncListener = (state: SyncState) => void;

class SyncEngine {
  private status: SyncStatus = 'idle';
  private lastSyncTime: number | null = null;
  private pendingCount = 0;
  private lastError: string | null = null;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private syncing = false;
  private retryAttempt = 0;
  private retryTimer: number | null = null;
  private debounceTimer: number | null = null;
  private intervalTimer: number | null = null;
  private listeners = new Set<SyncListener>();
  private started = false;

  public getState(): SyncState {
    return {
      status: this.status,
      lastSyncTime: this.lastSyncTime,
      pendingCount: this.pendingCount,
      lastError: this.lastError,
      isOnline: this.isOnline,
    };
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch {
        // ignore subscriber errors
      }
    }
  }

  public async init(): Promise<void> {
    try {
      const savedTime = await SecureStorage.getItem(LAST_SYNC_KEY);
      if (savedTime) {
        this.lastSyncTime = parseInt(savedTime, 10) || null;
      }
      await this.refreshPendingCount();
    } catch {
      // ignore init storage errors
    }
  }

  public async getCursor(): Promise<number> {
    try {
      const saved = await SecureStorage.getItem(CURSOR_KEY);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }

  public async setCursor(rev: number): Promise<void> {
    try {
      await SecureStorage.setItem(CURSOR_KEY, String(rev));
    } catch {
      // fallback
    }
  }

  public async refreshPendingCount(): Promise<number> {
    try {
      const db = await getDatabase();
      const queries = [
        'SELECT COUNT(*) as c FROM books WHERE sync_state="pending"',
        'SELECT COUNT(*) as c FROM accounts WHERE sync_state="pending"',
        'SELECT COUNT(*) as c FROM categories WHERE sync_state="pending"',
        'SELECT COUNT(*) as c FROM tags WHERE sync_state="pending"',
        'SELECT COUNT(*) as c FROM people WHERE sync_state="pending"',
        'SELECT COUNT(*) as c FROM debts WHERE sync_state="pending"',
        'SELECT COUNT(*) as c FROM debt_entries WHERE sync_state="pending"',
        'SELECT COUNT(*) as c FROM debt_installments WHERE sync_state="pending"',
        'SELECT COUNT(*) as c FROM transactions WHERE sync_state="pending"',
        'SELECT COUNT(*) as c FROM favorites WHERE sync_state="pending"',
        'SELECT COUNT(*) as c FROM attachments WHERE sync_state="pending"',
        'SELECT COUNT(*) as c FROM documents WHERE sync_state="pending"',
        'SELECT COUNT(*) as c FROM recurring_rules WHERE sync_state="pending"',
        'SELECT COUNT(*) as c FROM budgets WHERE sync_state="pending"',
        'SELECT COUNT(*) as c FROM goals WHERE sync_state="pending"',
        'SELECT COUNT(*) as c FROM assets WHERE sync_state="pending"',
        'SELECT COUNT(*) as c FROM asset_valuations WHERE sync_state="pending"',
        'SELECT COUNT(*) as c FROM exchange_rates WHERE sync_state="pending"',
      ];

      let total = 0;
      for (const q of queries) {
        const res = await db.query(q);
        const count = Number((res.values?.[0] as Record<string, number> | undefined)?.c ?? 0);
        total += count;
      }
      this.pendingCount = total;
      this.notify();
      return total;
    } catch {
      return this.pendingCount;
    }
  }

  private async collectPendingChanges(): Promise<SyncChangeSet> {
    const db = await getDatabase();
    const queryTable = async <T>(table: string): Promise<T[]> => {
      const res = await db.query(`SELECT * FROM ${table} WHERE sync_state='pending'`);
      return (res.values ?? []) as T[];
    };

    const books = await queryTable<Book>('books');
    const accounts = await queryTable<Account>('accounts');
    const categories = await queryTable<Category>('categories');
    const tags = await queryTable<Tag>('tags');
    const people = await queryTable<Person>('people');
    const debts = await queryTable<Debt>('debts');
    const debt_entries = await queryTable<DebtEntry>('debt_entries');
    const debt_installments = await queryTable<DebtInstallment>('debt_installments');
    const transactions = await queryTable<Transaction>('transactions');
    const favorites = await queryTable<Favorite>('favorites');
    const attachments = await queryTable<Attachment>('attachments');
    const documents = await queryTable<Document>('documents');
    const recurring_rules = await queryTable<RecurringRule>('recurring_rules');
    const budgets = await queryTable<Budget>('budgets');
    const goals = await queryTable<Goal>('goals');
    const assets = await queryTable<Asset>('assets');
    const asset_valuations = await queryTable<AssetValuation>('asset_valuations');
    const exchange_rates = await queryTable<ExchangeRate>('exchange_rates');

    const result: SyncChangeSet = {};
    if (books.length) result.books = books;
    if (accounts.length) result.accounts = accounts;
    if (categories.length) result.categories = categories;
    if (tags.length) result.tags = tags;
    if (people.length) result.people = people;
    if (debts.length) result.debts = debts;
    if (debt_entries.length) result.debt_entries = debt_entries;
    if (debt_installments.length) result.debt_installments = debt_installments;
    if (transactions.length) result.transactions = transactions;
    if (favorites.length) result.favorites = favorites;
    if (attachments.length) result.attachments = attachments;
    if (documents.length) result.documents = documents;
    if (recurring_rules.length) result.recurring_rules = recurring_rules;
    if (budgets.length) result.budgets = budgets;
    if (goals.length) result.goals = goals;
    if (assets.length) result.assets = assets;
    if (asset_valuations.length) result.asset_valuations = asset_valuations;
    if (exchange_rates.length) result.exchange_rates = exchange_rates;

    return result;
  }

  public async push(): Promise<SyncPushResult | null> {
    const changes = await this.collectPendingChanges();
    const hasChanges = Object.keys(changes).length > 0;
    if (!hasChanges) {
      return null;
    }

    const result = await pushChanges(changes);

    // Mark accepted records as synced
    await transaction(async (db) => {
      for (const [table, items] of Object.entries(result.accepted)) {
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          await db.run(
            `UPDATE ${table} SET sync_state='synced', server_rev=? WHERE id=?`,
            [item.server_rev, item.id],
            false,
          );
        }
      }
      // For conflicts (server was newer), also mark synced locally so pull overwrites
      for (const [table, conflictItems] of Object.entries(result.conflicts)) {
        if (!Array.isArray(conflictItems)) continue;
        for (const c of conflictItems) {
          await db.run(
            `UPDATE ${table} SET sync_state='synced' WHERE id=?`,
            [c.id],
            false,
          );
        }
      }
    });

    await this.refreshPendingCount();
    return result;
  }

  public async pull(): Promise<SyncPullResult | null> {
    let cursor = await this.getCursor();
    let latestPullResult: SyncPullResult | null = null;
    let hasMore = true;
    let hasAppliedChanges = false;

    while (hasMore) {
      const pullResult = await pullChanges(cursor, 500);
      latestPullResult = pullResult;
      const changes = pullResult.changes;
      let batchCount = 0;

      await transaction(async (db) => {
        // 1. Books
        if (changes.books?.length) {
          for (const b of changes.books) {
            batchCount++;
            const existing = (await db.query('SELECT id, updated_at, sync_state FROM books WHERE id=?', [b.id])).values?.[0] as Book | undefined;
            if (resolveConflict(existing, b) === 'apply_incoming') {
              hasAppliedChanges = true;
              if (existing) {
                await db.run(
                  'UPDATE books SET user_id=?, name=?, icon=?, color=?, currency=?, is_default=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [b.user_id, b.name, b.icon, b.color, b.currency, b.is_default, b.created_at, b.updated_at, b.deleted_at, b.server_rev, b.id],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO books(id, user_id, name, icon, color, currency, is_default, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?,?,?, "synced", ?)',
                  [b.id, b.user_id, b.name, b.icon, b.color, b.currency, b.is_default, b.created_at, b.updated_at, b.deleted_at, b.server_rev],
                  false,
                );
              }
            }
          }
        }

        // 2. Accounts
        if (changes.accounts?.length) {
          for (const a of changes.accounts) {
            batchCount++;
            const existing = (await db.query('SELECT id, updated_at, sync_state FROM accounts WHERE id=?', [a.id])).values?.[0] as Account | undefined;
            if (resolveConflict(existing, a) === 'apply_incoming') {
              hasAppliedChanges = true;
              if (existing) {
                await db.run(
                  'UPDATE accounts SET user_id=?, book_id=?, name=?, type=?, provider=?, currency=?, opening_balance=?, color=?, icon=?, include_in_total=?, is_archived=?, sort_order=?, credit_limit=?, statement_day=?, due_day=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [a.user_id, a.book_id, a.name, a.type, a.provider ?? null, a.currency, a.opening_balance ?? 0, a.color, a.icon, a.include_in_total ?? 1, a.is_archived ?? 0, a.sort_order ?? 0, a.credit_limit ?? null, a.statement_day ?? null, a.due_day ?? null, a.created_at, a.updated_at, a.deleted_at, a.server_rev, a.id],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO accounts(id, user_id, book_id, name, type, provider, currency, opening_balance, color, icon, include_in_total, is_archived, sort_order, credit_limit, statement_day, due_day, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,"synced",?)',
                  [a.id, a.user_id, a.book_id, a.name, a.type, a.provider ?? null, a.currency, a.opening_balance ?? 0, a.color, a.icon, a.include_in_total ?? 1, a.is_archived ?? 0, a.sort_order ?? 0, a.credit_limit ?? null, a.statement_day ?? null, a.due_day ?? null, a.created_at, a.updated_at, a.deleted_at, a.server_rev],
                  false,
                );
              }
            }
          }
        }

        // 3. Categories
        if (changes.categories?.length) {
          for (const c of changes.categories) {
            batchCount++;
            const existing = (await db.query('SELECT id, updated_at, sync_state FROM categories WHERE id=?', [c.id])).values?.[0] as Category | undefined;
            if (resolveConflict(existing, c) === 'apply_incoming') {
              hasAppliedChanges = true;
              if (existing) {
                await db.run(
                  'UPDATE categories SET user_id=?, book_id=?, name=?, i18n_key=?, kind=?, parent_id=?, icon=?, color=?, sort_order=?, is_default=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [c.user_id, c.book_id, c.name ?? null, c.i18n_key ?? null, c.kind, c.parent_id ?? null, c.icon, c.color, c.sort_order ?? 0, c.is_default ?? 0, c.created_at, c.updated_at, c.deleted_at, c.server_rev, c.id],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO categories(id, user_id, book_id, name, i18n_key, kind, parent_id, icon, color, sort_order, is_default, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,"synced",?)',
                  [c.id, c.user_id, c.book_id, c.name ?? null, c.i18n_key ?? null, c.kind, c.parent_id ?? null, c.icon, c.color, c.sort_order ?? 0, c.is_default ?? 0, c.created_at, c.updated_at, c.deleted_at, c.server_rev],
                  false,
                );
              }
            }
          }
        }

        // 4. Tags
        if (changes.tags?.length) {
          for (const t of changes.tags) {
            batchCount++;
            const existing = (await db.query('SELECT id, updated_at, sync_state FROM tags WHERE id=?', [t.id])).values?.[0] as Tag | undefined;
            if (resolveConflict(existing, t) === 'apply_incoming') {
              hasAppliedChanges = true;
              if (existing) {
                await db.run(
                  'UPDATE tags SET user_id=?, book_id=?, name=?, color=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [t.user_id, t.book_id, t.name, t.color, t.created_at, t.updated_at, t.deleted_at, t.server_rev, t.id],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO tags(id, user_id, book_id, name, color, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?, "synced", ?)',
                  [t.id, t.user_id, t.book_id, t.name, t.color, t.created_at, t.updated_at, t.deleted_at, t.server_rev],
                  false,
                );
              }
            }
          }
        }

        // 5. People
        if (changes.people?.length) {
          for (const p of changes.people) {
            batchCount++;
            const existing = (await db.query('SELECT id, updated_at, sync_state FROM people WHERE id=?', [p.id])).values?.[0] as Person | undefined;
            if (resolveConflict(existing, p) === 'apply_incoming') {
              hasAppliedChanges = true;
              if (existing) {
                await db.run(
                  'UPDATE people SET user_id=?, book_id=?, name=?, phone=?, note=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [p.user_id, p.book_id, p.name, p.phone ?? null, p.note ?? '', p.created_at, p.updated_at, p.deleted_at, p.server_rev, p.id],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO people(id, user_id, book_id, name, phone, note, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?,?,"synced",?)',
                  [p.id, p.user_id, p.book_id, p.name, p.phone ?? null, p.note ?? '', p.created_at, p.updated_at, p.deleted_at, p.server_rev],
                  false,
                );
              }
            }
          }
        }

        // 6. Debts
        if (changes.debts?.length) {
          for (const d of changes.debts) {
            batchCount++;
            const existing = (await db.query('SELECT id, updated_at, sync_state FROM debts WHERE id=?', [d.id])).values?.[0] as Debt | undefined;
            if (resolveConflict(existing, d) === 'apply_incoming') {
              hasAppliedChanges = true;
              if (existing) {
                await db.run(
                  'UPDATE debts SET user_id=?, book_id=?, person_id=?, direction=?, amount=?, currency=?, date=?, due_date=?, interest_rate_bps=?, note=?, settled_at=?, write_off_amount=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [d.user_id, d.book_id, d.person_id, d.direction, d.amount, d.currency, d.date, d.due_date ?? null, d.interest_rate_bps ?? 0, d.note ?? '', d.settled_at ?? null, d.write_off_amount ?? 0, d.created_at, d.updated_at, d.deleted_at, d.server_rev, d.id],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO debts(id, user_id, book_id, person_id, direction, amount, currency, date, due_date, interest_rate_bps, note, settled_at, write_off_amount, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,"synced",?)',
                  [d.id, d.user_id, d.book_id, d.person_id, d.direction, d.amount, d.currency, d.date, d.due_date ?? null, d.interest_rate_bps ?? 0, d.note ?? '', d.settled_at ?? null, d.write_off_amount ?? 0, d.created_at, d.updated_at, d.deleted_at, d.server_rev],
                  false,
                );
              }
            }
          }
        }

        // 7. Debt entries
        if (changes.debt_entries?.length) {
          for (const de of changes.debt_entries) {
            batchCount++;
            const existing = (await db.query('SELECT id, updated_at, sync_state FROM debt_entries WHERE id=?', [de.id])).values?.[0] as DebtEntry | undefined;
            if (resolveConflict(existing, de) === 'apply_incoming') {
              hasAppliedChanges = true;
              if (existing) {
                await db.run(
                  'UPDATE debt_entries SET user_id=?, book_id=?, debt_id=?, kind=?, amount=?, currency=?, account_id=?, occurred_at=?, note=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [de.user_id, de.book_id, de.debt_id, de.kind, de.amount, de.currency, de.account_id ?? null, de.occurred_at, de.note ?? '', de.created_at, de.updated_at, de.deleted_at, de.server_rev, de.id],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO debt_entries(id, user_id, book_id, debt_id, kind, amount, currency, account_id, occurred_at, note, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,"synced",?)',
                  [de.id, de.user_id, de.book_id, de.debt_id, de.kind, de.amount, de.currency, de.account_id ?? null, de.occurred_at, de.note ?? '', de.created_at, de.updated_at, de.deleted_at, de.server_rev],
                  false,
                );
              }
            }
          }
        }

        // 8. Debt installments
        if (changes.debt_installments?.length) {
          for (const di of changes.debt_installments) {
            batchCount++;
            const existing = (await db.query('SELECT id, updated_at, sync_state FROM debt_installments WHERE id=?', [di.id])).values?.[0] as DebtInstallment | undefined;
            if (resolveConflict(existing, di) === 'apply_incoming') {
              hasAppliedChanges = true;
              if (existing) {
                await db.run(
                  'UPDATE debt_installments SET user_id=?, book_id=?, debt_id=?, due_date=?, amount=?, paid_amount=?, paid_event_id=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [di.user_id, di.book_id, di.debt_id, di.due_date, di.amount, di.paid_amount ?? 0, di.paid_event_id ?? null, di.created_at, di.updated_at, di.deleted_at, di.server_rev, di.id],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO debt_installments(id, user_id, book_id, debt_id, due_date, amount, paid_amount, paid_event_id, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,"synced",?)',
                  [di.id, di.user_id, di.book_id, di.debt_id, di.due_date, di.amount, di.paid_amount ?? 0, di.paid_event_id ?? null, di.created_at, di.updated_at, di.deleted_at, di.server_rev],
                  false,
                );
              }
            }
          }
        }

        // 9. Transactions
        if (changes.transactions?.length) {
          for (const tx of changes.transactions) {
            batchCount++;
            const existing = (await db.query('SELECT id, updated_at, sync_state FROM transactions WHERE id=?', [tx.id])).values?.[0] as Transaction | undefined;
            if (resolveConflict(existing, tx) === 'apply_incoming') {
              hasAppliedChanges = true;
              if (existing) {
                await db.run(
                  'UPDATE transactions SET user_id=?, book_id=?, type=?, amount=?, currency=?, account_id=?, to_account_id=?, fee=?, exchange_rate=?, category_id=?, occurred_at=?, note=?, parent_id=?, recurring_rule_id=?, goal_id=?, asset_id=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [tx.user_id, tx.book_id, tx.type, tx.amount, tx.currency, tx.account_id, tx.to_account_id ?? null, tx.fee ?? 0, tx.exchange_rate ?? null, tx.category_id ?? null, tx.occurred_at, tx.note ?? '', tx.parent_id ?? null, tx.recurring_rule_id ?? null, tx.goal_id ?? null, tx.asset_id ?? null, tx.created_at, tx.updated_at, tx.deleted_at, tx.server_rev, tx.id],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO transactions(id, user_id, book_id, type, amount, currency, account_id, to_account_id, fee, exchange_rate, category_id, occurred_at, note, parent_id, recurring_rule_id, goal_id, asset_id, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,"synced",?)',
                  [tx.id, tx.user_id, tx.book_id, tx.type, tx.amount, tx.currency, tx.account_id, tx.to_account_id ?? null, tx.fee ?? 0, tx.exchange_rate ?? null, tx.category_id ?? null, tx.occurred_at, tx.note ?? '', tx.parent_id ?? null, tx.recurring_rule_id ?? null, tx.goal_id ?? null, tx.asset_id ?? null, tx.created_at, tx.updated_at, tx.deleted_at, tx.server_rev],
                  false,
                );
              }
            }
          }
        }

        // 10. Favorites
        if (changes.favorites?.length) {
          for (const f of changes.favorites) {
            batchCount++;
            const existing = (await db.query('SELECT id, updated_at, sync_state FROM favorites WHERE id=?', [f.id])).values?.[0] as Favorite | undefined;
            if (resolveConflict(existing, f) === 'apply_incoming') {
              hasAppliedChanges = true;
              if (existing) {
                await db.run(
                  'UPDATE favorites SET user_id=?, book_id=?, name=?, type=?, amount=?, account_id=?, category_id=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [f.user_id, f.book_id, f.name, f.type, f.amount, f.account_id, f.category_id ?? null, f.created_at, f.updated_at, f.deleted_at, f.server_rev, f.id],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO favorites(id, user_id, book_id, name, type, amount, account_id, category_id, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,"synced",?)',
                  [f.id, f.user_id, f.book_id, f.name, f.type, f.amount, f.account_id, f.category_id ?? null, f.created_at, f.updated_at, f.deleted_at, f.server_rev],
                  false,
                );
              }
            }
          }
        }

        // 11. Attachments
        if (changes.attachments?.length) {
          for (const att of changes.attachments) {
            batchCount++;
            const existing = (
              await db.query(
                'SELECT id, updated_at, sync_state, local_path, thumb_local_path, upload_state FROM attachments WHERE id=?',
                [att.id],
              )
            ).values?.[0] as Attachment | undefined;
            if (resolveConflict(existing, att) === 'apply_incoming') {
              hasAppliedChanges = true;
              const localPath = existing?.local_path ?? null;
              const thumbLocalPath = existing?.thumb_local_path ?? null;
              const uploadState = existing?.upload_state ?? 'uploaded';
              if (existing) {
                await db.run(
                  'UPDATE attachments SET user_id=?, book_id=?, entity_type=?, entity_id=?, kind=?, mime=?, size=?, original_name=?, sha256=?, width=?, height=?, local_path=?, thumb_local_path=?, remote_id=?, upload_state=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [
                    att.user_id,
                    att.book_id,
                    att.entity_type,
                    att.entity_id,
                    att.kind,
                    att.mime,
                    att.size,
                    att.original_name,
                    att.sha256,
                    att.width ?? null,
                    att.height ?? null,
                    localPath,
                    thumbLocalPath,
                    att.remote_id ?? null,
                    uploadState,
                    att.created_at,
                    att.updated_at,
                    att.deleted_at,
                    att.server_rev,
                    att.id,
                  ],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO attachments(id, user_id, book_id, entity_type, entity_id, kind, mime, size, original_name, sha256, width, height, local_path, thumb_local_path, remote_id, upload_state, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,"uploaded",?,?,?,"synced",?)',
                  [
                    att.id,
                    att.user_id,
                    att.book_id,
                    att.entity_type,
                    att.entity_id,
                    att.kind,
                    att.mime,
                    att.size,
                    att.original_name,
                    att.sha256,
                    att.width ?? null,
                    att.height ?? null,
                    null,
                    null,
                    att.remote_id ?? null,
                    att.created_at,
                    att.updated_at,
                    att.deleted_at,
                    att.server_rev,
                  ],
                  false,
                );
              }
            }
          }
        }

        // 12. Documents
        if (changes.documents?.length) {
          for (const doc of changes.documents) {
            batchCount++;
            const existing = (
              await db.query(
                'SELECT id, updated_at, sync_state FROM documents WHERE id=?',
                [doc.id],
              )
            ).values?.[0] as Document | undefined;
            if (resolveConflict(existing, doc) === 'apply_incoming') {
              hasAppliedChanges = true;
              if (existing) {
                await db.run(
                  'UPDATE documents SET user_id=?, book_id=?, title=?, folder=?, date=?, expiry_date=?, tags=?, note=?, entity_type=?, entity_id=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [
                    doc.user_id,
                    doc.book_id,
                    doc.title,
                    doc.folder,
                    doc.date,
                    doc.expiry_date ?? null,
                    doc.tags ?? null,
                    doc.note ?? '',
                    doc.entity_type ?? null,
                    doc.entity_id ?? null,
                    doc.created_at,
                    doc.updated_at,
                    doc.deleted_at,
                    doc.server_rev,
                    doc.id,
                  ],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO documents(id, user_id, book_id, title, folder, date, expiry_date, tags, note, entity_type, entity_id, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,"synced",?)',
                  [
                    doc.id,
                    doc.user_id,
                    doc.book_id,
                    doc.title,
                    doc.folder,
                    doc.date,
                    doc.expiry_date ?? null,
                    doc.tags ?? null,
                    doc.note ?? '',
                    doc.entity_type ?? null,
                    doc.entity_id ?? null,
                    doc.created_at,
                    doc.updated_at,
                    doc.deleted_at,
                    doc.server_rev,
                  ],
                  false,
                );
              }
            }
          }
        }

        // 13. Recurring Rules
        if (changes.recurring_rules?.length) {
          for (const rule of changes.recurring_rules) {
            batchCount++;
            const existing = (
              await db.query(
                'SELECT id, updated_at, sync_state FROM recurring_rules WHERE id=?',
                [rule.id],
              )
            ).values?.[0] as RecurringRule | undefined;
            if (resolveConflict(existing, rule) === 'apply_incoming') {
              hasAppliedChanges = true;
              if (existing) {
                await db.run(
                  'UPDATE recurring_rules SET user_id=?, book_id=?, name=?, type=?, amount=?, currency=?, account_id=?, to_account_id=?, category_id=?, person_id=?, note=?, frequency=?, interval_step=?, by_day=?, start_date=?, end_date=?, max_count=?, current_count=?, mode=?, next_run_at=?, is_subscription=?, icon=?, color=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [
                    rule.user_id,
                    rule.book_id,
                    rule.name,
                    rule.type,
                    rule.amount,
                    rule.currency,
                    rule.account_id,
                    rule.to_account_id ?? null,
                    rule.category_id ?? null,
                    rule.person_id ?? null,
                    rule.note ?? '',
                    rule.frequency,
                    rule.interval_step ?? 1,
                    rule.by_day ?? null,
                    rule.start_date,
                    rule.end_date ?? null,
                    rule.max_count ?? null,
                    rule.current_count ?? 0,
                    rule.mode ?? 'remind',
                    rule.next_run_at,
                    rule.is_subscription ?? 0,
                    rule.icon ?? null,
                    rule.color ?? null,
                    rule.created_at,
                    rule.updated_at,
                    rule.deleted_at,
                    rule.server_rev,
                    rule.id,
                  ],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO recurring_rules(id, user_id, book_id, name, type, amount, currency, account_id, to_account_id, category_id, person_id, note, frequency, interval_step, by_day, start_date, end_date, max_count, current_count, mode, next_run_at, is_subscription, icon, color, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,"synced",?)',
                  [
                    rule.id,
                    rule.user_id,
                    rule.book_id,
                    rule.name,
                    rule.type,
                    rule.amount,
                    rule.currency,
                    rule.account_id,
                    rule.to_account_id ?? null,
                    rule.category_id ?? null,
                    rule.person_id ?? null,
                    rule.note ?? '',
                    rule.frequency,
                    rule.interval_step ?? 1,
                    rule.by_day ?? null,
                    rule.start_date,
                    rule.end_date ?? null,
                    rule.max_count ?? null,
                    rule.current_count ?? 0,
                    rule.mode ?? 'remind',
                    rule.next_run_at,
                    rule.is_subscription ?? 0,
                    rule.icon ?? null,
                    rule.color ?? null,
                    rule.created_at,
                    rule.updated_at,
                    rule.deleted_at,
                    rule.server_rev,
                  ],
                  false,
                );
              }
            }
          }
        }

        // 14. Budgets
        if (changes.budgets?.length) {
          for (const b of changes.budgets) {
            batchCount++;
            const existing = (
              await db.query(
                'SELECT id, updated_at, sync_state FROM budgets WHERE id=?',
                [b.id],
              )
            ).values?.[0] as Budget | undefined;
            if (resolveConflict(existing, b) === 'apply_incoming') {
              hasAppliedChanges = true;
              if (existing) {
                await db.run(
                  'UPDATE budgets SET user_id=?, book_id=?, category_id=?, amount=?, currency=?, period=?, rollover=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [
                    b.user_id,
                    b.book_id,
                    b.category_id ?? null,
                    b.amount,
                    b.currency,
                    b.period ?? 'monthly',
                    b.rollover ?? 0,
                    b.created_at,
                    b.updated_at,
                    b.deleted_at,
                    b.server_rev,
                    b.id,
                  ],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO budgets(id, user_id, book_id, category_id, amount, currency, period, rollover, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,"synced",?)',
                  [
                    b.id,
                    b.user_id,
                    b.book_id,
                    b.category_id ?? null,
                    b.amount,
                    b.currency,
                    b.period ?? 'monthly',
                    b.rollover ?? 0,
                    b.created_at,
                    b.updated_at,
                    b.deleted_at,
                    b.server_rev,
                  ],
                  false,
                );
              }
            }
          }
        }

        // 15. Goals
        if (changes.goals?.length) {
          for (const g of changes.goals) {
            batchCount++;
            const existing = (
              await db.query(
                'SELECT id, updated_at, sync_state FROM goals WHERE id=?',
                [g.id],
              )
            ).values?.[0] as Goal | undefined;
            if (resolveConflict(existing, g) === 'apply_incoming') {
              hasAppliedChanges = true;
              if (existing) {
                await db.run(
                  'UPDATE goals SET user_id=?, book_id=?, name=?, icon=?, color=?, target_amount=?, currency=?, target_date=?, linked_account_id=?, current_amount=?, achieved_at=?, note=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [
                    g.user_id,
                    g.book_id,
                    g.name,
                    g.icon,
                    g.color,
                    g.target_amount,
                    g.currency,
                    g.target_date,
                    g.linked_account_id ?? null,
                    g.current_amount ?? 0,
                    g.achieved_at ?? null,
                    g.note ?? '',
                    g.created_at,
                    g.updated_at,
                    g.deleted_at,
                    g.server_rev,
                    g.id,
                  ],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO goals(id, user_id, book_id, name, icon, color, target_amount, currency, target_date, linked_account_id, current_amount, achieved_at, note, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,"synced",?)',
                  [
                    g.id,
                    g.user_id,
                    g.book_id,
                    g.name,
                    g.icon,
                    g.color,
                    g.target_amount,
                    g.currency,
                    g.target_date,
                    g.linked_account_id ?? null,
                    g.current_amount ?? 0,
                    g.achieved_at ?? null,
                    g.note ?? '',
                    g.created_at,
                    g.updated_at,
                    g.deleted_at,
                    g.server_rev,
                  ],
                  false,
                );
              }
            }
          }
        }

        // 16. Assets
        if (changes.assets?.length) {
          for (const a of changes.assets) {
            batchCount++;
            const existing = (
              await db.query(
                'SELECT id, updated_at, sync_state FROM assets WHERE id=?',
                [a.id],
              )
            ).values?.[0] as Asset | undefined;
            if (resolveConflict(existing, a) === 'apply_incoming') {
              hasAppliedChanges = true;
              if (existing) {
                await db.run(
                  'UPDATE assets SET user_id=?, book_id=?, type=?, name=?, institution=?, principal=?, current_value=?, profit_rate=?, start_date=?, maturity_date=?, unit=?, currency=?, note=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [
                    a.user_id,
                    a.book_id,
                    a.type,
                    a.name,
                    a.institution ?? null,
                    a.principal ?? 0,
                    a.current_value ?? 0,
                    a.profit_rate ?? null,
                    a.start_date,
                    a.maturity_date ?? null,
                    a.unit ?? null,
                    a.currency,
                    a.note ?? '',
                    a.created_at,
                    a.updated_at,
                    a.deleted_at,
                    a.server_rev,
                    a.id,
                  ],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO assets(id, user_id, book_id, type, name, institution, principal, current_value, profit_rate, start_date, maturity_date, unit, currency, note, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,"synced",?)',
                  [
                    a.id,
                    a.user_id,
                    a.book_id,
                    a.type,
                    a.name,
                    a.institution ?? null,
                    a.principal ?? 0,
                    a.current_value ?? 0,
                    a.profit_rate ?? null,
                    a.start_date,
                    a.maturity_date ?? null,
                    a.unit ?? null,
                    a.currency,
                    a.note ?? '',
                    a.created_at,
                    a.updated_at,
                    a.deleted_at,
                    a.server_rev,
                  ],
                  false,
                );
              }
            }
          }
        }

        // 17. Asset Valuations
        if (changes.asset_valuations?.length) {
          for (const av of changes.asset_valuations) {
            batchCount++;
            const existing = (
              await db.query(
                'SELECT id, updated_at, sync_state FROM asset_valuations WHERE id=?',
                [av.id],
              )
            ).values?.[0] as AssetValuation | undefined;
            if (resolveConflict(existing, av) === 'apply_incoming') {
              hasAppliedChanges = true;
              if (existing) {
                await db.run(
                  'UPDATE asset_valuations SET user_id=?, book_id=?, asset_id=?, date=?, value=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [
                    av.user_id,
                    av.book_id,
                    av.asset_id,
                    av.date,
                    av.value,
                    av.created_at,
                    av.updated_at,
                    av.deleted_at,
                    av.server_rev,
                    av.id,
                  ],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO asset_valuations(id, user_id, book_id, asset_id, date, value, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?,?,"synced",?)',
                  [
                    av.id,
                    av.user_id,
                    av.book_id,
                    av.asset_id,
                    av.date,
                    av.value,
                    av.created_at,
                    av.updated_at,
                    av.deleted_at,
                    av.server_rev,
                  ],
                  false,
                );
              }
            }
          }
        }

        // 18. Exchange Rates
        if (changes.exchange_rates?.length) {
          for (const er of changes.exchange_rates) {
            batchCount++;
            const existing = (
              await db.query(
                'SELECT id, updated_at, sync_state FROM exchange_rates WHERE id=?',
                [er.id],
              )
            ).values?.[0] as ExchangeRate | undefined;
            if (resolveConflict(existing, er) === 'apply_incoming') {
              hasAppliedChanges = true;
              if (existing) {
                await db.run(
                  'UPDATE exchange_rates SET user_id=?, book_id=?, base=?, quote=?, rate=?, date=?, source=?, created_at=?, updated_at=?, deleted_at=?, sync_state="synced", server_rev=? WHERE id=?',
                  [
                    er.user_id,
                    er.book_id,
                    er.base,
                    er.quote,
                    er.rate,
                    er.date,
                    er.source ?? 'server',
                    er.created_at,
                    er.updated_at,
                    er.deleted_at,
                    er.server_rev,
                    er.id,
                  ],
                  false,
                );
              } else {
                await db.run(
                  'INSERT INTO exchange_rates(id, user_id, book_id, base, quote, rate, date, source, created_at, updated_at, deleted_at, sync_state, server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,"synced",?)',
                  [
                    er.id,
                    er.user_id,
                    er.book_id,
                    er.base,
                    er.quote,
                    er.rate,
                    er.date,
                    er.source ?? 'server',
                    er.created_at,
                    er.updated_at,
                    er.deleted_at,
                    er.server_rev,
                  ],
                  false,
                );
              }
            }
          }
        }
      });

      cursor = pullResult.latest_rev;
      await this.setCursor(cursor);
      hasMore = pullResult.has_more && batchCount > 0;
    }

    if (hasAppliedChanges) {
      // Reload money store in background so balances and lists update smoothly
      try {
        const { useMoney } = await import('../features/money/store');
        void useMoney.getState().refresh();
      } catch {
        // ignore store reload error
      }
    }

    await this.refreshPendingCount();
    return latestPullResult;
  }

  public async sync(): Promise<boolean> {
    if (this.syncing) {
      return false;
    }

    const currentToken = await token();
    if (!currentToken) {
      this.status = 'idle';
      this.notify();
      return false;
    }

    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!this.isOnline) {
      this.status = 'idle';
      this.notify();
      return false;
    }

    this.syncing = true;
    this.status = 'syncing';
    this.notify();

    try {
      await this.push();
      await this.pull();

      this.status = 'idle';
      this.lastSyncTime = Date.now();
      this.lastError = null;
      this.retryAttempt = 0;
      await SecureStorage.setItem(LAST_SYNC_KEY, String(this.lastSyncTime));
      this.notify();
      return true;
    } catch (err) {
      this.status = 'error';
      this.lastError = err instanceof Error ? err.message : String(err);
      this.notify();

      // Schedule retry with exponential backoff
      if (this.retryTimer) {
        window.clearTimeout(this.retryTimer);
      }
      const delay = getBackoffDelay(this.retryAttempt++);
      this.retryTimer = window.setTimeout(() => {
        void this.sync();
      }, delay);

      return false;
    } finally {
      this.syncing = false;
      this.notify();
    }
  }

  public notifyWrite(): void {
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      void this.refreshPendingCount().then(() => {
        void this.sync();
      });
    }, 300);
  }

  public async restoreOnLogin(): Promise<boolean> {
    try {
      await this.setCursor(0);
      await this.pull();
      this.lastSyncTime = Date.now();
      await SecureStorage.setItem(LAST_SYNC_KEY, String(this.lastSyncTime));
      await this.refreshPendingCount();
      return true;
    } catch {
      return false;
    }
  }

  public start(): void {
    if (this.started) return;
    this.started = true;

    void this.init().then(() => {
      void this.sync();
    });

    const handleOnline = () => {
      this.isOnline = true;
      void this.sync();
    };

    const handleOffline = () => {
      this.isOnline = false;
      this.notify();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('resume', handleOnline);

    // Foreground interval: check every 5 minutes
    this.intervalTimer = window.setInterval(() => {
      void this.sync();
    }, 5 * 60 * 1000);
  }

  public stop(): void {
    this.started = false;
    if (this.retryTimer) window.clearTimeout(this.retryTimer);
    if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
    if (this.intervalTimer) window.clearInterval(this.intervalTimer);
  }
}

export const syncEngine = new SyncEngine();
