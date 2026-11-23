import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
export const DB_VERSION = 5;
const schema = `
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS books(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,name TEXT NOT NULL,icon TEXT NOT NULL,color TEXT NOT NULL,currency TEXT NOT NULL CHECK(length(currency)=3),is_default INTEGER NOT NULL CHECK(is_default IN(0,1)),created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER,sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),server_rev INTEGER NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX IF NOT EXISTS idx_default_book ON books(user_id) WHERE is_default=1 AND deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,name TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN('cash','mobile_wallet','bank','card','other')),provider TEXT,currency TEXT NOT NULL CHECK(length(currency)=3),opening_balance INTEGER NOT NULL DEFAULT 0,color TEXT NOT NULL,icon TEXT NOT NULL,include_in_total INTEGER NOT NULL CHECK(include_in_total IN(0,1)),is_archived INTEGER NOT NULL CHECK(is_archived IN(0,1)),sort_order INTEGER NOT NULL,credit_limit INTEGER,statement_day INTEGER,due_day INTEGER,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER,sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),server_rev INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_accounts_book ON accounts(book_id,is_archived,sort_order);
CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,name TEXT,i18n_key TEXT,kind TEXT NOT NULL CHECK(kind IN('income','expense')),parent_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,icon TEXT NOT NULL,color TEXT NOT NULL,sort_order INTEGER NOT NULL,is_default INTEGER NOT NULL CHECK(is_default IN(0,1)),created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER,sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),server_rev INTEGER NOT NULL DEFAULT 0,CHECK((name IS NOT NULL)!=(i18n_key IS NOT NULL)));
CREATE INDEX IF NOT EXISTS idx_categories_book ON categories(book_id,kind,parent_id,sort_order);
CREATE TABLE IF NOT EXISTS tags(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,name TEXT NOT NULL,color TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER,sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),server_rev INTEGER NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags(book_id,name) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS transactions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,type TEXT NOT NULL CHECK(type IN('income','expense','transfer')),amount INTEGER NOT NULL CHECK(amount>0),currency TEXT NOT NULL CHECK(length(currency)=3),account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,fee INTEGER NOT NULL DEFAULT 0 CHECK(fee>=0),category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,occurred_at INTEGER NOT NULL,note TEXT NOT NULL DEFAULT '',parent_id TEXT REFERENCES transactions(id) ON DELETE CASCADE,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER,sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),server_rev INTEGER NOT NULL DEFAULT 0,CHECK(type!='transfer' OR (to_account_id IS NOT NULL AND to_account_id!=account_id)));
CREATE INDEX IF NOT EXISTS idx_transactions_book_date ON transactions(book_id,occurred_at DESC,id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_parent ON transactions(parent_id);
CREATE TABLE IF NOT EXISTS transaction_tags(transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,PRIMARY KEY(transaction_id,tag_id));
CREATE TABLE IF NOT EXISTS favorites(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,name TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN('income','expense')),amount INTEGER NOT NULL CHECK(amount>0),account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER,sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),server_rev INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_favorites_book ON favorites(book_id,updated_at DESC);
`;
const debtSchema = `
CREATE TABLE IF NOT EXISTS people(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,name TEXT NOT NULL,phone TEXT,note TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER,sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),server_rev INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_people_book ON people(book_id,name);
CREATE TABLE IF NOT EXISTS debts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,direction TEXT NOT NULL CHECK(direction IN('receivable','payable')),amount INTEGER NOT NULL CHECK(amount>0),currency TEXT NOT NULL CHECK(length(currency)=3),date INTEGER NOT NULL,due_date INTEGER,interest_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK(interest_rate_bps>=0),note TEXT NOT NULL DEFAULT '',settled_at INTEGER,write_off_amount INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER,sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),server_rev INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_debts_book_due ON debts(book_id,due_date,person_id);
CREATE TABLE IF NOT EXISTS debt_entries(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE RESTRICT,kind TEXT NOT NULL CHECK(kind IN('lend','borrow','collect','repay','write_off')),amount INTEGER NOT NULL CHECK(amount>0),currency TEXT NOT NULL CHECK(length(currency)=3),account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,occurred_at INTEGER NOT NULL,note TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER,sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),server_rev INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_debt_entries_debt_date ON debt_entries(debt_id,occurred_at,id);
CREATE INDEX IF NOT EXISTS idx_debt_entries_account ON debt_entries(account_id,occurred_at);
CREATE TABLE IF NOT EXISTS debt_installments(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE RESTRICT,due_date INTEGER NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),paid_amount INTEGER NOT NULL DEFAULT 0 CHECK(paid_amount>=0),paid_event_id TEXT REFERENCES debt_entries(id) ON DELETE SET NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER,sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),server_rev INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_debt_installments_due ON debt_installments(book_id,due_date,debt_id);
`;
const attachmentSchema = `
CREATE TABLE IF NOT EXISTS attachments(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN('image','pdf','file')),
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  local_path TEXT,
  thumb_local_path TEXT,
  remote_id TEXT,
  upload_state TEXT NOT NULL CHECK(upload_state IN('local','uploading','uploaded','failed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),
  server_rev INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type,entity_id,deleted_at);
CREATE INDEX IF NOT EXISTS idx_attachments_book ON attachments(book_id,upload_state);

CREATE TABLE IF NOT EXISTS documents(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  folder TEXT NOT NULL CHECK(folder IN('receipts','invoices','loan_agreements','warranty','bank_statements','ids_certificates','property','other')),
  date INTEGER NOT NULL,
  expiry_date INTEGER,
  tags TEXT,
  note TEXT NOT NULL DEFAULT '',
  entity_type TEXT,
  entity_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),
  server_rev INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_documents_book_folder ON documents(book_id,folder,date DESC);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(book_id,expiry_date);
`;
const planningSchema = `
CREATE TABLE IF NOT EXISTS recurring_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN('expense','income','transfer')),
  amount INTEGER NOT NULL CHECK(amount>0),
  currency TEXT NOT NULL CHECK(length(currency)=3),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
  category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  person_id TEXT REFERENCES people(id) ON DELETE RESTRICT,
  note TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL CHECK(frequency IN('daily','weekly','monthly','yearly')),
  interval_step INTEGER NOT NULL DEFAULT 1 CHECK(interval_step>=1),
  by_day TEXT,
  start_date INTEGER NOT NULL,
  end_date INTEGER,
  max_count INTEGER,
  current_count INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL CHECK(mode IN('auto_create','remind')),
  next_run_at INTEGER NOT NULL,
  is_subscription INTEGER NOT NULL DEFAULT 0 CHECK(is_subscription IN(0,1)),
  icon TEXT,
  color TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),
  server_rev INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_recurring_book_next ON recurring_rules(book_id,next_run_at);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK(amount>0),
  currency TEXT NOT NULL CHECK(length(currency)=3),
  period TEXT NOT NULL DEFAULT 'monthly',
  rollover INTEGER NOT NULL DEFAULT 0 CHECK(rollover IN(0,1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),
  server_rev INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_budgets_book ON budgets(book_id,period,category_id);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  target_amount INTEGER NOT NULL CHECK(target_amount>0),
  currency TEXT NOT NULL CHECK(length(currency)=3),
  target_date INTEGER NOT NULL,
  linked_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  current_amount INTEGER NOT NULL DEFAULT 0 CHECK(current_amount>=0),
  achieved_at INTEGER,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),
  server_rev INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_goals_book ON goals(book_id,achieved_at,target_date);
`;
const wealthSchema = `
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK(type IN('fdr','dps','sanchayapatra','gold','land','shares','crypto','other')),
  name TEXT NOT NULL,
  institution TEXT,
  principal INTEGER NOT NULL DEFAULT 0 CHECK(principal>=0),
  current_value INTEGER NOT NULL DEFAULT 0 CHECK(current_value>=0),
  profit_rate REAL,
  start_date INTEGER NOT NULL,
  maturity_date INTEGER,
  unit TEXT,
  currency TEXT NOT NULL CHECK(length(currency)=3),
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),
  server_rev INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_assets_book ON assets(book_id,type,deleted_at);

CREATE TABLE IF NOT EXISTS asset_valuations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  date INTEGER NOT NULL,
  value INTEGER NOT NULL CHECK(value>=0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),
  server_rev INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_valuations_asset ON asset_valuations(asset_id,date DESC);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  base TEXT NOT NULL CHECK(length(base)=3),
  quote TEXT NOT NULL CHECK(length(quote)=3),
  rate REAL NOT NULL CHECK(rate>0),
  date INTEGER NOT NULL,
  source TEXT NOT NULL CHECK(source IN('server','manual')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  sync_state TEXT NOT NULL CHECK(sync_state IN('pending','synced')),
  server_rev INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rates_pair ON exchange_rates(book_id,base,quote) WHERE deleted_at IS NULL;
`;
export async function migrate(db: SQLiteDBConnection): Promise<void> {
  const rows = await db.query('PRAGMA user_version');
  const version = Number(
    (rows.values?.[0] as Record<string, number> | undefined)?.user_version ?? 0,
  );
  if (version < 1) {
    await db.execute(schema);
    await db.run(
      'INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(?,?)',
      [1, Date.now()],
    );
    await db.execute('PRAGMA user_version=1');
  }
  if (version < 2) {
    await db.execute(debtSchema);
    await db.run(
      'INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(?,?)',
      [2, Date.now()],
    );
    await db.execute('PRAGMA user_version=2');
  }
  if (version < 3) {
    await db.execute(attachmentSchema);
    await db.run(
      'INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(?,?)',
      [3, Date.now()],
    );
    await db.execute('PRAGMA user_version=3');
  }
  if (version < 4) {
    await db.execute(planningSchema);
    const tableInfo = await db.query('PRAGMA table_info(transactions)');
    const cols = ((tableInfo.values ?? []) as Array<{ name: string }>).map((c) => c.name);
    if (!cols.includes('recurring_rule_id')) {
      await db.execute('ALTER TABLE transactions ADD COLUMN recurring_rule_id TEXT REFERENCES recurring_rules(id) ON DELETE SET NULL');
    }
    if (!cols.includes('goal_id')) {
      await db.execute('ALTER TABLE transactions ADD COLUMN goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL');
    }
    await db.run(
      'INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(?,?)',
      [4, Date.now()],
    );
    await db.execute('PRAGMA user_version=4');
  }
  if (version < 5) {
    await db.execute(wealthSchema);
    const tableInfo = await db.query('PRAGMA table_info(transactions)');
    const cols = ((tableInfo.values ?? []) as Array<{ name: string }>).map((c) => c.name);
    if (!cols.includes('asset_id')) {
      await db.execute('ALTER TABLE transactions ADD COLUMN asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL');
    }
    if (!cols.includes('exchange_rate')) {
      await db.execute('ALTER TABLE transactions ADD COLUMN exchange_rate REAL');
    }
    await db.run(
      'INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(?,?)',
      [5, Date.now()],
    );
    await db.execute('PRAGMA user_version=5');
  }
}
