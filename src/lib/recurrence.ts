import type { RecurringFrequency } from '../db/types';

/**
 * Calculates the next occurrence timestamp after `fromMs` according to recurrence rules.
 */
export function calculateNextRun(
  fromMs: number,
  frequency: RecurringFrequency,
  intervalStep: number = 1,
  byDay?: string | null,
): number {
  const step = Math.max(1, intervalStep);
  const date = new Date(fromMs);

  switch (frequency) {
    case 'daily': {
      date.setDate(date.getDate() + step);
      return date.getTime();
    }
    case 'weekly': {
      if (byDay) {
        const days = byDay
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n) && n >= 0 && n <= 6)
          .sort((a, b) => a - b);

        if (days.length > 0) {
          const currentDay = date.getDay();
          const nextDayInWeek = days.find((d) => d > currentDay);
          if (nextDayInWeek !== undefined) {
            date.setDate(date.getDate() + (nextDayInWeek - currentDay));
            return date.getTime();
          }
          // Wrap around to the first day in the next interval
          const daysUntilFirst = 7 - currentDay + days[0];
          const additionalWeeks = step - 1;
          date.setDate(date.getDate() + daysUntilFirst + additionalWeeks * 7);
          return date.getTime();
        }
      }
      date.setDate(date.getDate() + 7 * step);
      return date.getTime();
    }
    case 'monthly': {
      const targetDay = byDay
        ? Math.min(31, Math.max(1, parseInt(byDay, 10) || date.getDate()))
        : date.getDate();

      const year = date.getFullYear();
      const month = date.getMonth() + step;
      // Get max days in target month
      const maxDays = new Date(year, month + 1, 0).getDate();
      const effectiveDay = Math.min(targetDay, maxDays);

      const nextDate = new Date(year, month, effectiveDay, date.getHours(), date.getMinutes(), date.getSeconds());
      return nextDate.getTime();
    }
    case 'yearly': {
      const targetMonth = date.getMonth();
      const targetDay = date.getDate();
      const year = date.getFullYear() + step;
      const maxDays = new Date(year, targetMonth + 1, 0).getDate();
      const effectiveDay = Math.min(targetDay, maxDays);

      const nextDate = new Date(year, targetMonth, effectiveDay, date.getHours(), date.getMinutes(), date.getSeconds());
      return nextDate.getTime();
    }
    default:
      return fromMs + 86_400_000 * step;
  }
}

/**
 * Checks if a scheduled occurrence is overdue (past current time).
 */
export function isOverdue(nextRunAt: number, nowMs: number = Date.now()): boolean {
  return nextRunAt < nowMs;
}

/**
 * Checks if an occurrence falls within the next N days.
 */
export function isUpcomingWithin(
  nextRunAt: number,
  days: number = 7,
  nowMs: number = Date.now(),
): boolean {
  return nextRunAt >= nowMs && nextRunAt <= nowMs + days * 86_400_000;
}

/**
 * Converts recurring cost into an approximate monthly amount (e.g. for subscription budgeting).
 */
function roundRatio(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n) throw new Error('INVALID_INTERVAL');
  const negative = numerator < 0n;
  const abs = negative ? -numerator : numerator;
  const rounded = (abs + denominator / 2n) / denominator;
  const signed = negative ? -rounded : rounded;
  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error('AMOUNT_TOO_LARGE');
  }
  return Number(signed);
}

export function calculateMonthlyEquivalent(
  amountMinor: number,
  frequency: RecurringFrequency,
  intervalStep: number = 1,
): number {
  if (!Number.isSafeInteger(amountMinor)) throw new Error('INVALID_MINOR_UNITS');
  const step = BigInt(Math.max(1, Math.trunc(intervalStep)));
  const amount = BigInt(amountMinor);
  switch (frequency) {
    case 'daily':
      return roundRatio(amount * 304375n, step * 10000n);
    case 'weekly':
      return roundRatio(amount * 52n, step * 12n);
    case 'monthly':
      return roundRatio(amount, step);
    case 'yearly':
      return roundRatio(amount, step * 12n);
  }
}

/**
 * Calculates the required monthly saving to reach a target goal by the deadline.
 */
export function calculateRequiredMonthlySavings(
  targetAmountMinor: number,
  currentAmountMinor: number,
  targetDateMs: number,
  nowMs: number = Date.now(),
): number {
  if (currentAmountMinor >= targetAmountMinor) {
    return 0;
  }
  const remaining = targetAmountMinor - currentAmountMinor;
  if (targetDateMs <= nowMs) {
    return remaining;
  }

  const d1 = new Date(nowMs);
  const d2 = new Date(targetDateMs);
  const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  const effectiveMonths = Math.max(1, months);

  return Math.ceil(remaining / effectiveMonths);
}
