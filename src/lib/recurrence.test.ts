import { describe, expect, it } from 'vitest';
import {
  calculateMonthlyEquivalent,
  calculateNextRun,
  calculateRequiredMonthlySavings,
  isOverdue,
  isUpcomingWithin,
} from './recurrence';

describe('Recurrence calculations', () => {
  it('calculates daily next run', () => {
    const base = new Date('2026-05-10T10:00:00Z').getTime();
    const next = calculateNextRun(base, 'daily', 1);
    expect(new Date(next).toISOString()).toBe('2026-05-11T10:00:00.000Z');

    const next3Days = calculateNextRun(base, 'daily', 3);
    expect(new Date(next3Days).toISOString()).toBe('2026-05-13T10:00:00.000Z');
  });

  it('calculates weekly next run without byDay', () => {
    const base = new Date('2026-05-10T10:00:00Z').getTime(); // Sunday
    const next = calculateNextRun(base, 'weekly', 2);
    expect(new Date(next).toISOString()).toBe('2026-05-24T10:00:00.000Z');
  });

  it('calculates weekly next run with byDay', () => {
    // 2026-05-10 is Sunday (0)
    const base = new Date('2026-05-10T10:00:00Z').getTime();
    // Days: Tuesday (2), Thursday (4)
    const next = calculateNextRun(base, 'weekly', 1, '2,4');
    expect(new Date(next).getDay()).toBe(2); // Tuesday 2026-05-12

    // From Tuesday 2026-05-12, next should be Thursday 2026-05-14
    const nextThu = calculateNextRun(next, 'weekly', 1, '2,4');
    expect(new Date(nextThu).getDay()).toBe(4);
  });

  it('calculates monthly next run and clamps days', () => {
    const jan31 = new Date('2026-01-31T10:00:00Z').getTime();
    const febNext = calculateNextRun(jan31, 'monthly', 1);
    const febDate = new Date(febNext);
    expect(febDate.getMonth()).toBe(1); // February
    expect(febDate.getDate()).toBe(28); // 2026 is non-leap year, clamps to 28

    const marNext = calculateNextRun(febNext, 'monthly', 1);
    const marDate = new Date(marNext);
    expect(marDate.getMonth()).toBe(2); // March
  });

  it('calculates yearly next run', () => {
    const base = new Date('2026-06-15T10:00:00Z').getTime();
    const next = calculateNextRun(base, 'yearly', 1);
    expect(new Date(next).toISOString()).toBe('2027-06-15T10:00:00.000Z');
  });

  it('checks overdue and upcoming statuses', () => {
    const now = 100000;
    expect(isOverdue(90000, now)).toBe(true);
    expect(isOverdue(110000, now)).toBe(false);

    expect(isUpcomingWithin(150000, 7, now)).toBe(true);
    expect(isUpcomingWithin(now + 8 * 86_400_000, 7, now)).toBe(false);
    expect(isUpcomingWithin(now - 1000, 7, now)).toBe(false);
  });

  it('calculates monthly equivalent for subscriptions', () => {
    // Monthly 1000 -> 1000
    expect(calculateMonthlyEquivalent(1000, 'monthly', 1)).toBe(1000);
    // Yearly 12000 -> 1000
    expect(calculateMonthlyEquivalent(12000, 'yearly', 1)).toBe(1000);
    // Weekly 250 -> ~1083
    expect(calculateMonthlyEquivalent(250, 'weekly', 1)).toBe(1083);
  });

  it('calculates required monthly savings for goals', () => {
    const now = new Date('2026-01-01T00:00:00Z').getTime();
    const deadline = new Date('2026-06-01T00:00:00Z').getTime(); // 5 months
    const target = 100000; // 1000 taka
    const current = 25000; // 250 taka
    // 75000 remaining / 5 months = 15000 per month
    expect(calculateRequiredMonthlySavings(target, current, deadline, now)).toBe(15000);

    // Goal already achieved
    expect(calculateRequiredMonthlySavings(target, target + 100, deadline, now)).toBe(0);

    // Past deadline
    expect(calculateRequiredMonthlySavings(target, current, now - 1000, now)).toBe(75000);
  });
});
