import { describe, expect, it } from 'vitest';
import { debtBalance, installmentAmounts, monthFrom } from './debt';

const day = 86_400_000;
describe('debt ledger', () => {
  it('accrues simple interest on outstanding principal and applies partial payments', () => {
    const start = 1_700_000_000_000;
    const initial = {
      kind: 'lend' as const,
      amount: 100_000,
      occurred_at: start,
    };
    const payment = {
      kind: 'collect' as const,
      amount: 11_000,
      occurred_at: start + 365 * day,
    };
    expect(debtBalance([initial], 1000, start + 365 * day)).toEqual({
      principal: 100_000,
      interest: 10_000,
      outstanding: 110_000,
    });
    expect(debtBalance([initial, payment], 1000, start + 365 * day)).toEqual({
      principal: 99_000,
      interest: 0,
      outstanding: 99_000,
    });
  });
  it('handles write offs and rejects overpayment', () => {
    const events = [
      { kind: 'borrow' as const, amount: 5000, occurred_at: 100 },
    ];
    expect(
      debtBalance(
        [...events, { kind: 'repay', amount: 2000, occurred_at: 100 }],
        0,
        100,
      ).outstanding,
    ).toBe(3000);
    expect(
      debtBalance(
        [...events, { kind: 'write_off', amount: 5000, occurred_at: 100 }],
        0,
        100,
      ).outstanding,
    ).toBe(0);
    expect(() =>
      debtBalance(
        [...events, { kind: 'repay', amount: 5001, occurred_at: 100 }],
        0,
        100,
      ),
    ).toThrow('OVERPAYMENT');
  });
});
describe('installments', () => {
  it('preserves every minor unit', () => {
    expect(installmentAmounts(100, 3)).toEqual([34, 33, 33]);
  });
  it('clamps end of month dates', () => {
    expect(
      new Date(monthFrom(new Date(2026, 0, 31, 12).getTime(), 1)).getDate(),
    ).toBe(28);
  });
});
