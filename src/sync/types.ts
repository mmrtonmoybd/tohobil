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

export interface TransactionTagSync {
  transaction_id: string;
  tag_id: string;
  created_at: number;
  deleted_at: number | null;
  server_rev: number;
}

export interface UserSettingsSync {
  settings_json: string;
  updated_at: number;
  server_rev?: number;
}

export interface SyncChangeSet {
  books?: Book[];
  accounts?: Account[];
  categories?: Category[];
  tags?: Tag[];
  people?: Person[];
  debts?: Debt[];
  debt_entries?: DebtEntry[];
  debt_installments?: DebtInstallment[];
  transactions?: Transaction[];
  transaction_tags?: TransactionTagSync[];
  favorites?: Favorite[];
  attachments?: Attachment[];
  documents?: Document[];
  recurring_rules?: RecurringRule[];
  budgets?: Budget[];
  goals?: Goal[];
  assets?: Asset[];
  asset_valuations?: AssetValuation[];
  exchange_rates?: ExchangeRate[];
  user_settings?: UserSettingsSync;
}

export interface SyncPushAcceptedItem {
  id: string;
  server_rev: number;
  updated_at: number;
}

export interface SyncPushResult {
  ok: boolean;
  server_rev: number;
  accepted: Record<string, SyncPushAcceptedItem[]>;
  conflicts: Record<string, Array<{ id: string; server_rev?: number; reason?: string }>>;
}

export interface SyncPullResult {
  changes: SyncChangeSet;
  latest_rev: number;
  has_more: boolean;
}

export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncTime: number | null;
  pendingCount: number;
  lastError: string | null;
  isOnline: boolean;
}
