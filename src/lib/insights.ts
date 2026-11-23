/**
 * Rule-based on-device financial insights engine.
 * Generates actionable insights comparing trends, highlighting anomalies, budget risks, and upcoming dues.
 */

export type InsightType =
  | 'category_increase'
  | 'unusual_expense'
  | 'budget_risk'
  | 'bill_due'
  | 'debt_overdue'
  | 'savings_rate_change';

export type Insight = {
  id: string;
  type: InsightType;
  severity: 'info' | 'warning' | 'alert' | 'positive';
  titleKey: string;
  messageKey: string;
  params?: Record<string, string | number>;
  icon: string;
  color: string;
};

export type CategorySpending = {
  categoryId: string;
  categoryName: string;
  currentAmount: number; // minor units
  previousAmount: number; // minor units
};

export type BudgetStatusItem = {
  budgetId: string;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  percentage: number;
};

export type BillDueItem = {
  id: string;
  name: string;
  amount: number;
  daysRemaining: number;
};

export type OverdueDebtItem = {
  personName: string;
  amount: number;
  daysOverdue: number;
};

export type InsightsInput = {
  currentSavingsRate: number; // e.g. 25 for 25%
  previousSavingsRate: number; // e.g. 15 for 15%
  categorySpendings: CategorySpending[];
  highestSingleExpense?: {
    name: string;
    amount: number;
    categoryAverage: number;
  };
  budgetsAtRisk: BudgetStatusItem[];
  billsDueSoon: BillDueItem[];
  overdueDebts: OverdueDebtItem[];
};

export function generateInsights(input: InsightsInput): Insight[] {
  const insights: Insight[] = [];

  // 1. Savings rate shift
  const savingsRateDelta = input.currentSavingsRate - input.previousSavingsRate;
  if (savingsRateDelta >= 8 && input.currentSavingsRate > 0) {
    insights.push({
      id: 'savings-up',
      type: 'savings_rate_change',
      severity: 'positive',
      titleKey: 'insights.savingsUpTitle',
      messageKey: 'insights.savingsUpMsg',
      params: { current: Math.round(input.currentSavingsRate), delta: Math.round(savingsRateDelta) },
      icon: 'trending_up',
      color: '#22c55e',
    });
  } else if (savingsRateDelta <= -10 && input.previousSavingsRate > 0) {
    insights.push({
      id: 'savings-down',
      type: 'savings_rate_change',
      severity: 'warning',
      titleKey: 'insights.savingsDownTitle',
      messageKey: 'insights.savingsDownMsg',
      params: { current: Math.max(0, Math.round(input.currentSavingsRate)), delta: Math.abs(Math.round(savingsRateDelta)) },
      icon: 'trending_down',
      color: '#f59e0b',
    });
  }

  // 2. Budget risks
  for (const b of input.budgetsAtRisk) {
    if (b.percentage >= 100) {
      insights.push({
        id: `budget-exceeded-${b.budgetId}`,
        type: 'budget_risk',
        severity: 'alert',
        titleKey: 'insights.budgetExceededTitle',
        messageKey: 'insights.budgetExceededMsg',
        params: { category: b.categoryName, percentage: b.percentage },
        icon: 'error',
        color: '#f43f5e',
      });
    } else if (b.percentage >= 80) {
      insights.push({
        id: `budget-risk-${b.budgetId}`,
        type: 'budget_risk',
        severity: 'warning',
        titleKey: 'insights.budgetWarningTitle',
        messageKey: 'insights.budgetWarningMsg',
        params: { category: b.categoryName, percentage: b.percentage },
        icon: 'warning',
        color: '#f59e0b',
      });
    }
  }

  // 3. Category spending spike (>25% increase and > 1,000 BDT difference)
  for (const cat of input.categorySpendings) {
    if (cat.previousAmount > 0 && cat.currentAmount > cat.previousAmount) {
      const delta = cat.currentAmount - cat.previousAmount;
      const pctIncrease = Math.round((delta / cat.previousAmount) * 100);
      if (pctIncrease >= 25 && delta >= 100000) { // 1000 BDT in minor units
        insights.push({
          id: `cat-spike-${cat.categoryId}`,
          type: 'category_increase',
          severity: 'warning',
          titleKey: 'insights.categorySpikeTitle',
          messageKey: 'insights.categorySpikeMsg',
          params: { category: cat.categoryName, percentage: pctIncrease },
          icon: 'show_chart',
          color: '#ec4899',
        });
      }
    }
  }

  // 4. Unusual large expense (>2.5x category average)
  if (
    input.highestSingleExpense &&
    input.highestSingleExpense.categoryAverage > 0 &&
    input.highestSingleExpense.amount >= input.highestSingleExpense.categoryAverage * 2.5
  ) {
    insights.push({
      id: 'unusual-expense',
      type: 'unusual_expense',
      severity: 'info',
      titleKey: 'insights.unusualExpenseTitle',
      messageKey: 'insights.unusualExpenseMsg',
      params: { name: input.highestSingleExpense.name },
      icon: 'priority_high',
      color: '#6366f1',
    });
  }

  // 5. Overdue receivables (Paona)
  for (const debt of input.overdueDebts) {
    insights.push({
      id: `overdue-debt-${debt.personName}`,
      type: 'debt_overdue',
      severity: 'alert',
      titleKey: 'insights.overdueDebtTitle',
      messageKey: 'insights.overdueDebtMsg',
      params: { person: debt.personName, days: debt.daysOverdue },
      icon: 'hourglass_bottom',
      color: '#f43f5e',
    });
  }

  // 6. Upcoming bills due within 3 days
  for (const bill of input.billsDueSoon) {
    if (bill.daysRemaining >= 0 && bill.daysRemaining <= 3) {
      insights.push({
        id: `bill-due-${bill.id}`,
        type: 'bill_due',
        severity: 'info',
        titleKey: 'insights.billDueSoonTitle',
        messageKey: 'insights.billDueSoonMsg',
        params: { bill: bill.name, days: bill.daysRemaining },
        icon: 'event_upcoming',
        color: '#0ea5e9',
      });
    }
  }

  return insights;
}
