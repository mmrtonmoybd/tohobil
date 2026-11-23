import type { DebtEntry } from '../db/types';

const YEAR_MS = 365n * 24n * 60n * 60n * 1000n;
const RATE_DENOMINATOR = 10_000n * YEAR_MS;

export function debtBalance(
  entries: Pick<DebtEntry, 'kind' | 'amount' | 'occurred_at'>[],
  rateBps: number,
  asOf: number,
): { principal: number; interest: number; outstanding: number } {
  if (!Number.isSafeInteger(rateBps) || rateBps < 0)
    throw new Error('INVALID_RATE');
  const sorted = [...entries].sort((a, b) => a.occurred_at - b.occurred_at);
  let principal = 0n;
  let interest = 0n;
  let remainder = 0n;
  let previous = sorted[0]?.occurred_at ?? asOf;
  for (const entry of sorted) {
    if (!Number.isSafeInteger(entry.amount) || entry.amount <= 0)
      throw new Error('INVALID_AMOUNT');
    if (entry.occurred_at > asOf) break;
    if (entry.occurred_at < previous) throw new Error('INVALID_DATE');
    const accrued =
      principal * BigInt(rateBps) * BigInt(entry.occurred_at - previous) +
      remainder;
    interest += accrued / RATE_DENOMINATOR;
    remainder = accrued % RATE_DENOMINATOR;
    const amount = BigInt(entry.amount);
    if (entry.kind === 'lend' || entry.kind === 'borrow') {
      principal += amount;
    } else {
      if (amount > principal + interest) throw new Error('OVERPAYMENT');
      const paidInterest = amount < interest ? amount : interest;
      interest -= paidInterest;
      principal -= amount - paidInterest;
      if (principal === 0n) remainder = 0n;
    }
    previous = entry.occurred_at;
  }
  const accrued =
    principal * BigInt(rateBps) * BigInt(Math.max(0, asOf - previous)) +
    remainder;
  interest += accrued / RATE_DENOMINATOR;
  const outstanding = principal + interest;
  for (const value of [principal, interest, outstanding])
    if (value > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error('AMOUNT_TOO_LARGE');
  return {
    principal: Number(principal),
    interest: Number(interest),
    outstanding: Number(outstanding),
  };
}

export function installmentAmounts(total: number, count: number): number[] {
  if (
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 120 ||
    count > total
  )
    throw new Error('INVALID_INSTALLMENTS');
  const base = BigInt(total) / BigInt(count);
  const rest = BigInt(total) % BigInt(count);
  return Array.from({ length: count }, (_, index) =>
    Number(base + (BigInt(index) < rest ? 1n : 0n)),
  );
}

export function monthFrom(start: number, offset: number): number {
  const date = new Date(start);
  const day = date.getDate();
  const result = new Date(
    date.getFullYear(),
    date.getMonth() + offset,
    1,
    date.getHours(),
    date.getMinutes(),
  );
  const last = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(day, last));
  return result.getTime();
}
