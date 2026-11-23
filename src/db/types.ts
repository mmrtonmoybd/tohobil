export type Book = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  currency: string;
  is_default: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};
export type Account = {
  id: string;
  user_id: string;
  book_id: string;
  name: string;
  type: 'cash' | 'mobile_wallet' | 'bank' | 'card' | 'other';
  provider: string | null;
  currency: string;
  opening_balance: number;
  color: string;
  icon: string;
  include_in_total: number;
  is_archived: number;
  sort_order: number;
  credit_limit: number | null;
  statement_day: number | null;
  due_day: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};
export type Category = {
  id: string;
  user_id: string;
  book_id: string;
  name: string | null;
  i18n_key: string | null;
  kind: 'income' | 'expense';
  parent_id: string | null;
  icon: string;
  color: string;
  sort_order: number;
  is_default: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};
export type Tag = {
  id: string;
  user_id: string;
  book_id: string;
  name: string;
  color: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};
export type Transaction = {
  id: string;
  user_id: string;
  book_id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  currency: string;
  account_id: string;
  to_account_id: string | null;
  fee: number;
  category_id: string | null;
  occurred_at: number;
  note: string;
  parent_id: string | null;
  recurring_rule_id?: string | null;
  goal_id?: string | null;
  asset_id?: string | null;
  exchange_rate?: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};
export type TransactionRow = Omit<Transaction, 'type' | 'account_id'> & {
  type: Transaction['type'] | DebtEntry['kind'];
  account_id: string | null;
  debt_id: string | null;
  person_name: string | null;
  account_name: string;
  category_name: string | null;
  category_key: string | null;
  tags: string | null;
  split_count: number;
  split_category_ids: string | null;
  attachment_count?: number;
};
export type Favorite = {
  id: string;
  user_id: string;
  book_id: string;
  name: string;
  type: 'income' | 'expense';
  amount: number;
  account_id: string;
  category_id: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};
export type Balance = { account_id: string; balance: number };
export type Person = {
  id: string;
  user_id: string;
  book_id: string;
  name: string;
  phone: string | null;
  note: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};
export type Debt = {
  id: string;
  user_id: string;
  book_id: string;
  person_id: string;
  direction: 'receivable' | 'payable';
  amount: number;
  currency: string;
  date: number;
  due_date: number | null;
  interest_rate_bps: number;
  note: string;
  settled_at: number | null;
  write_off_amount: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};
export type DebtEntry = {
  id: string;
  user_id: string;
  book_id: string;
  debt_id: string;
  kind: 'lend' | 'borrow' | 'collect' | 'repay' | 'write_off';
  amount: number;
  currency: string;
  account_id: string | null;
  occurred_at: number;
  note: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};
export type DebtInstallment = {
  id: string;
  user_id: string;
  book_id: string;
  debt_id: string;
  due_date: number;
  amount: number;
  paid_amount: number;
  paid_event_id: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};
export type DebtView = Debt & {
  person_name: string;
  person_phone: string | null;
  outstanding: number;
  principal: number;
  interest: number;
  overdue: boolean;
  next_due_date: number | null;
};

export type AttachmentKind = 'image' | 'pdf' | 'file';
export type AttachmentUploadState = 'local' | 'uploading' | 'uploaded' | 'failed';
export type AttachmentEntityType =
  | 'transaction'
  | 'debt'
  | 'debt_entry'
  | 'person'
  | 'account'
  | 'asset'
  | 'goal'
  | 'bill'
  | 'document'
  | 'profile';

export type Attachment = {
  id: string;
  user_id: string;
  book_id: string;
  entity_type: AttachmentEntityType;
  entity_id: string;
  kind: AttachmentKind;
  mime: string;
  size: number;
  original_name: string;
  sha256: string;
  width: number | null;
  height: number | null;
  local_path: string | null;
  thumb_local_path: string | null;
  remote_id: string | null;
  upload_state: AttachmentUploadState;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};

export type DocumentFolder =
  | 'receipts'
  | 'invoices'
  | 'loan_agreements'
  | 'warranty'
  | 'bank_statements'
  | 'ids_certificates'
  | 'property'
  | 'other';

export type Document = {
  id: string;
  user_id: string;
  book_id: string;
  title: string;
  folder: DocumentFolder;
  date: number;
  expiry_date: number | null;
  tags: string | null;
  note: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};

export type DocumentView = Document & {
  attachments?: Attachment[];
  attachment_count?: number;
  is_expired?: boolean;
  is_expiring_soon?: boolean;
  days_to_expiry?: number | null;
};

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RecurringMode = 'auto_create' | 'remind';

export type RecurringRule = {
  id: string;
  user_id: string;
  book_id: string;
  name: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  currency: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  person_id: string | null;
  note: string;
  frequency: RecurringFrequency;
  interval_step: number;
  by_day: string | null;
  start_date: number;
  end_date: number | null;
  max_count: number | null;
  current_count: number;
  mode: RecurringMode;
  next_run_at: number;
  is_subscription: number;
  icon: string | null;
  color: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};

export type RecurringRuleView = RecurringRule & {
  account_name?: string;
  to_account_name?: string | null;
  category_name?: string | null;
  category_key?: string | null;
  category_icon?: string | null;
  category_color?: string | null;
  person_name?: string | null;
  is_overdue?: boolean;
  days_until_run?: number;
};

export type Budget = {
  id: string;
  user_id: string;
  book_id: string;
  category_id: string | null;
  amount: number;
  currency: string;
  period: string; // 'monthly' or 'YYYY-MM'
  rollover: number; // 0 or 1
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};

export type BudgetStatus = 'normal' | 'warning' | 'exceeded';

export type BudgetSummary = {
  id?: string;
  category_id: string | null;
  category_name: string | null;
  category_key: string | null;
  category_icon: string | null;
  category_color: string | null;
  budget_amount: number;
  effective_budget: number;
  spent_amount: number;
  remaining_amount: number;
  percentage: number;
  status: BudgetStatus;
  rollover: number;
  rollover_amount: number;
};

export type Goal = {
  id: string;
  user_id: string;
  book_id: string;
  name: string;
  icon: string;
  color: string;
  target_amount: number;
  currency: string;
  target_date: number;
  linked_account_id: string | null;
  current_amount: number;
  achieved_at: number | null;
  note: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};

export type GoalView = Goal & {
  linked_account_name?: string | null;
  percentage: number;
  required_monthly_saving: number;
  days_remaining: number;
  is_achieved: boolean;
};

export type AssetType =
  | 'fdr'
  | 'dps'
  | 'sanchayapatra'
  | 'gold'
  | 'land'
  | 'shares'
  | 'crypto'
  | 'other';

export type Asset = {
  id: string;
  user_id: string;
  book_id: string;
  type: AssetType;
  name: string;
  institution: string | null;
  principal: number; // minor units
  current_value: number; // minor units
  profit_rate: number | null; // e.g. 11.5 for 11.5%
  start_date: number; // ms
  maturity_date: number | null; // ms
  unit: string | null;
  currency: string;
  note: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};

export type AssetValuation = {
  id: string;
  user_id: string;
  book_id: string;
  asset_id: string;
  date: number; // ms
  value: number; // minor units
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};

export type ExchangeRate = {
  id: string;
  user_id: string;
  book_id: string;
  base: string;
  quote: string;
  rate: number;
  date: number; // ms
  source: 'server' | 'manual';
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: 'pending' | 'synced';
  server_rev: number;
};

export type AssetView = Asset & {
  profit: number; // current_value - principal
  profitPercentage: number;
  daysToMaturity: number | null;
  isMatured: boolean;
  isMaturingSoon: boolean;
};

export type WealthSummary = {
  totalInvested: number;
  currentValue: number;
  totalProfit: number;
  profitPercentage: number;
  assetCount: number;
  byType: Record<AssetType, { count: number; totalValue: number; totalInvested: number }>;
  maturingSoon: AssetView[];
};

export type NetWorthHistoryPoint = {
  date: string; // YYYY-MM-DD
  timestamp: number;
  assets: number;
  liabilities: number;
  netWorth: number;
};

export type ReportCategoryBreakdown = {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  percentage: number;
  count: number;
};

export type ReportTagBreakdown = {
  tagId: string;
  name: string;
  amount: number;
  count: number;
};

export type ReportAccountBreakdown = {
  accountId: string;
  name: string;
  type: string;
  currency: string;
  income: number;
  expense: number;
  net: number;
};

export type ReportDailyPoint = {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  expense: number;
  income: number;
};

export type ReportData = {
  from: number;
  to: number;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRate: number; // percentage
  dailyAverageExpense: number;
  monthEndForecast: number;
  categories: ReportCategoryBreakdown[];
  tags: ReportTagBreakdown[];
  accounts: ReportAccountBreakdown[];
  dailyTrend: ReportDailyPoint[];
  topExpenses: TransactionRow[];
  comparison: {
    prevIncome: number;
    prevExpense: number;
    incomeDeltaPct: number;
    expenseDeltaPct: number;
  };
};

export type CalendarDayData = {
  date: string; // YYYY-MM-DD
  day: number;
  income: number;
  expense: number;
  net: number;
  count: number;
  transactions: TransactionRow[];
};

export type GlobalSearchResult = {
  transactions: TransactionRow[];
  people: Array<{ id: string; name: string; phone: string | null; balance: number }>;
  accounts: Array<{ id: string; name: string; type: string; currency: string; balance: number }>;
  assets: Array<{ id: string; name: string; type: AssetType; current_value: number; currency: string }>;
  documents: Array<{ id: string; title: string; folder: string }>;
};

export type CsvImportRow = {
  date: string; // YYYY-MM-DD or ms
  amount: number; // minor units
  type: 'expense' | 'income' | 'transfer';
  accountId: string;
  categoryId?: string;
  note?: string;
  tags?: string[];
  isDuplicate?: boolean;
};



