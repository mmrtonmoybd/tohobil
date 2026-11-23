import { describe, expect, it } from 'vitest';
import { estimateZakat, quoteDps, quoteFdr, quoteLoan } from './financeTools';

describe('finance tools use integer minor units', () => {
  it('charges zakat at 2.5 percent only after nisab', () => {
    const below = estimateZakat({
      currency: 'BDT',
      standard: 'gold',
      goldGrams: '87.48',
      silverGrams: '612.36',
      pricePerGram: '10000',
      cash: '1000',
      bank: '0',
      receivables: '0',
      goldAssets: '0',
      otherAssets: '0',
      liabilities: '0',
    });
    expect(below.obligatory).toBe(false);
    expect(below.dueMinor).toBe(0);

    const due = estimateZakat({
      currency: 'BDT',
      standard: 'gold',
      goldGrams: '1',
      silverGrams: '1',
      pricePerGram: '1',
      cash: '10000',
      bank: '0',
      receivables: '0',
      goldAssets: '0',
      otherAssets: '0',
      liabilities: '0',
    });
    expect(due.obligatory).toBe(true);
    expect(due.dueMinor).toBe(25000);
    expect(due.netMinor).toBe(1_000_000);
  });

  it('splits a zero-interest loan evenly and prices simple FDR profit', () => {
    const loan = quoteLoan('1200', '0', 12, 'BDT');
    expect(loan.emiMinor).toBe(10000);
    expect(loan.interestMinor).toBe(0);
    expect(loan.totalMinor).toBe(120000);

    const fdr = quoteFdr('100000', '10', 12, '0', 'BDT');
    expect(fdr.grossProfitMinor).toBe(1_000_000);
    expect(fdr.taxMinor).toBe(0);
    expect(fdr.netPayoutMinor).toBe(11_000_000);
  });

  it('compounds a DPS deposit without binary floating point', () => {
    const dps = quoteDps('1000', '0', 1, '10', 'BDT');
    expect(dps.totalDepositMinor).toBe(1_200_000);
    expect(dps.grossProfitMinor).toBe(0);
    expect(dps.netPayoutMinor).toBe(1_200_000);

    const taxed = quoteFdr('100000', '10', 12, '10', 'BDT');
    expect(taxed.taxMinor).toBe(100_000);
    expect(taxed.netPayoutMinor).toBe(10_900_000);
  });
});
