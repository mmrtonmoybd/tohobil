import { describe, expect, it } from 'vitest';
import { generateInsights, type InsightsInput } from './insights';

describe('Insights Engine', () => {
  it('detects savings rate improvement and drop', () => {
    const positiveInput: InsightsInput = {
      currentSavingsRate: 35,
      previousSavingsRate: 20,
      categorySpendings: [],
      budgetsAtRisk: [],
      billsDueSoon: [],
      overdueDebts: [],
    };
    const positiveInsights = generateInsights(positiveInput);
    expect(positiveInsights.some((i) => i.id === 'savings-up')).toBe(true);

    const negativeInput: InsightsInput = {
      currentSavingsRate: 10,
      previousSavingsRate: 30,
      categorySpendings: [],
      budgetsAtRisk: [],
      billsDueSoon: [],
      overdueDebts: [],
    };
    const negativeInsights = generateInsights(negativeInput);
    expect(negativeInsights.some((i) => i.id === 'savings-down')).toBe(true);
  });

  it('detects budgets at risk and exceeded budgets', () => {
    const input: InsightsInput = {
      currentSavingsRate: 20,
      previousSavingsRate: 20,
      categorySpendings: [],
      budgetsAtRisk: [
        { budgetId: 'b1', categoryName: 'Food', budgetAmount: 1000000, spentAmount: 850000, percentage: 85 },
        { budgetId: 'b2', categoryName: 'Rent', budgetAmount: 2000000, spentAmount: 2200000, percentage: 110 },
      ],
      billsDueSoon: [],
      overdueDebts: [],
    };
    const insights = generateInsights(input);
    expect(insights.some((i) => i.id === 'budget-risk-b1')).toBe(true);
    expect(insights.some((i) => i.id === 'budget-exceeded-b2')).toBe(true);
  });

  it('detects category spending spikes', () => {
    const input: InsightsInput = {
      currentSavingsRate: 20,
      previousSavingsRate: 20,
      categorySpendings: [
        { categoryId: 'c1', categoryName: 'Shopping', currentAmount: 300000, previousAmount: 150000 }, // +100% and 1500 BDT
      ],
      budgetsAtRisk: [],
      billsDueSoon: [],
      overdueDebts: [],
    };
    const insights = generateInsights(input);
    expect(insights.some((i) => i.id === 'cat-spike-c1')).toBe(true);
  });

  it('detects overdue receivables and bills due soon', () => {
    const input: InsightsInput = {
      currentSavingsRate: 20,
      previousSavingsRate: 20,
      categorySpendings: [],
      budgetsAtRisk: [],
      billsDueSoon: [{ id: 'bill1', name: 'Internet Bill', amount: 150000, daysRemaining: 2 }],
      overdueDebts: [{ personName: 'Karim', amount: 500000, daysOverdue: 5 }],
    };
    const insights = generateInsights(input);
    expect(insights.some((i) => i.id === 'bill-due-bill1')).toBe(true);
    expect(insights.some((i) => i.id === 'overdue-debt-Karim')).toBe(true);
  });
});
