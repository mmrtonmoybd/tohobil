import { expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { DebtView, DebtInstallment } from '../db/types';
import { buildDebtNotifications } from './debtReminders';

it('schedules future dues and installments without scheduling settled or past items', () => {
  const now = new Date(2026, 10, 18, 12).getTime();
  const future = new Date(2026, 10, 20, 12).getTime();
  const past = new Date(2026, 10, 17, 12).getTime();
  const debt = {
    id: 'a',
    person_name: 'Rahim',
    currency: 'BDT',
    outstanding: 5000,
    due_date: future,
  } as DebtView;
  const settled = {
    id: 'b',
    person_name: 'Asha',
    currency: 'BDT',
    outstanding: 0,
    due_date: future,
  } as DebtView;
  const installment = {
    id: 'i',
    debt_id: 'a',
    person_name: 'Rahim',
    currency: 'BDT',
    amount: 2000,
    paid_amount: 500,
    due_date: future,
  } as DebtInstallment & { person_name: string; currency: string };
  const t = ((key: string, options?: { amount?: string }) =>
    `${key} ${options?.amount ?? ''}`) as unknown as TFunction;
  const result = buildDebtNotifications(
    [debt, settled, { ...debt, id: 'old', due_date: past }],
    [installment],
    'en',
    t,
    now,
  );
  expect(result).toHaveLength(2);
  expect(result.every((x) => x.isExactNotification === false)).toBe(true);
  expect(result.some((x) => x.body.includes('৳15.00'))).toBe(true);
  expect(result[1].extra.debtId).toBe('a');
});
