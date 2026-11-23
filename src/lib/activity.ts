import type { TransactionRow } from '../db/types';

export function isDebtActivity(row: TransactionRow): boolean {
  return row.debt_id !== null;
}
export function activityCashDelta(row: TransactionRow): number {
  if (row.type === 'income') return row.amount;
  if (row.type === 'expense') return -row.amount;
  if (!row.account_id) return 0;
  if (row.type === 'borrow' || row.type === 'collect') return row.amount;
  if (row.type === 'lend' || row.type === 'repay') return -row.amount;
  return 0;
}
