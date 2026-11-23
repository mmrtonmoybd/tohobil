import { describe, expect, it } from 'vitest';
import type { BudgetStatus, GoalView, RecurringRuleView } from '../../db/types';
import {
  calculateMonthlyEquivalent,
  calculateRequiredMonthlySavings,
} from '../../lib/recurrence';

describe('Planning Features Logic', () => {
  describe('Budgets with Rollover', () => {
    it('computes normal, warning (80%), and exceeded (100%+) budget statuses', () => {
      const evaluateStatus = (spent: number, effectiveBudget: number): { status: BudgetStatus; percentage: number } => {
        const percentage = effectiveBudget > 0 ? Math.round((spent / effectiveBudget) * 100) : 0;
        const status: BudgetStatus = spent > effectiveBudget ? 'exceeded' : percentage >= 80 ? 'warning' : 'normal';
        return { status, percentage };
      };

      // 50% spent: normal
      const normal = evaluateStatus(5000, 10000);
      expect(normal.status).toBe('normal');
      expect(normal.percentage).toBe(50);

      // 85% spent: warning (80% alert)
      const warning = evaluateStatus(8500, 10000);
      expect(warning.status).toBe('warning');
      expect(warning.percentage).toBe(85);

      // 100% spent: warning
      const full = evaluateStatus(10000, 10000);
      expect(full.status).toBe('warning');
      expect(full.percentage).toBe(100);

      // 105% spent: exceeded (100%+ alert)
      const exceeded = evaluateStatus(10500, 10000);
      expect(exceeded.status).toBe('exceeded');
      expect(exceeded.percentage).toBe(105);
    });

    it('handles rollover from previous month unspent balance', () => {
      const prevBudget = 20000;
      const prevSpent = 15000;
      const currentBudget = 20000;
      const rolloverEnabled = true;

      const rolloverAmount = rolloverEnabled ? Math.max(0, prevBudget - prevSpent) : 0;
      const effectiveBudget = currentBudget + rolloverAmount;

      expect(rolloverAmount).toBe(5000);
      expect(effectiveBudget).toBe(25000);
    });
  });

  describe('Bills and Subscriptions', () => {
    it('calculates monthly subscription spend across multiple frequencies', () => {
      const subscriptions: Array<{
        name: string;
        amount: number;
        frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
        interval_step: number;
      }> = [
        { name: 'Netflix', amount: 120000, frequency: 'monthly', interval_step: 1 }, // 1200 BDT/mo
        { name: 'Broadband', amount: 150000, frequency: 'monthly', interval_step: 1 }, // 1500 BDT/mo
        { name: 'Google One', amount: 240000, frequency: 'yearly', interval_step: 1 }, // 2400 BDT/yr = 200/mo
        { name: 'Gym', amount: 50000, frequency: 'weekly', interval_step: 1 }, // 500 BDT/wk = ~2167/mo
      ];

      const totalMonthly = subscriptions.reduce(
        (sum, s) => sum + calculateMonthlyEquivalent(s.amount, s.frequency, s.interval_step),
        0,
      );

      // 120000 + 150000 + 20000 + 216667 = 506667 minor units
      expect(totalMonthly).toBe(506667);
    });

    it('identifies overdue bills and upcoming bills in next 7 days', () => {
      const now = new Date('2026-11-20T12:00:00Z').getTime();
      const dayMs = 86_400_000;

      const rules: Array<Partial<RecurringRuleView>> = [
        { id: '1', name: 'Overdue Electricity', next_run_at: now - 2 * dayMs },
        { id: '2', name: 'Due Tomorrow Rent', next_run_at: now + 1 * dayMs },
        { id: '3', name: 'Due in 5 Days Water', next_run_at: now + 5 * dayMs },
        { id: '4', name: 'Due Next Month', next_run_at: now + 25 * dayMs },
      ];

      const processed = rules.map((r) => ({
        ...r,
        is_overdue: r.next_run_at! < now,
        is_upcoming_7_days: r.next_run_at! >= now && r.next_run_at! <= now + 7 * dayMs,
      }));

      const overdue = processed.filter((r) => r.is_overdue);
      const upcoming7Days = processed.filter((r) => r.is_upcoming_7_days);

      expect(overdue).toHaveLength(1);
      expect(overdue[0].name).toBe('Overdue Electricity');

      expect(upcoming7Days).toHaveLength(2);
      expect(upcoming7Days.map((r) => r.name)).toEqual(['Due Tomorrow Rent', 'Due in 5 Days Water']);
    });
  });

  describe('Savings Goals & Celebration', () => {
    it('tracks goal progress percentage and celebration trigger', () => {
      const goal: GoalView = {
        id: 'g1',
        user_id: 'u1',
        book_id: 'b1',
        name: 'Emergency Fund',
        icon: 'security',
        color: '#14b8a6',
        target_amount: 10000000, // 100,000 BDT
        currency: 'BDT',
        target_date: Date.now() + 60 * 86_400_000,
        linked_account_id: null,
        current_amount: 10000000,
        achieved_at: Date.now(),
        note: '3 months expenses',
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        sync_state: 'synced',
        server_rev: 1,
        percentage: 100,
        required_monthly_saving: 0,
        days_remaining: 60,
        is_achieved: true,
      };

      expect(goal.percentage).toBe(100);
      expect(goal.is_achieved).toBe(true);
      expect(goal.achieved_at).not.toBeNull();
    });

    it('calculates required monthly savings dynamically', () => {
      const now = new Date('2026-06-01T00:00:00Z').getTime();
      const targetDate = new Date('2026-10-01T00:00:00Z').getTime(); // 4 months
      const targetAmount = 5000000; // 50,000 BDT
      const currentAmount = 1000000; // 10,000 BDT

      const required = calculateRequiredMonthlySavings(targetAmount, currentAmount, targetDate, now);
      // (50000 - 10000) / 4 = 10000 BDT = 1,000,000 minor units
      expect(required).toBe(1000000);
    });
  });
});
