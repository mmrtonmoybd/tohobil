import { describe, expect, it } from 'vitest';
import { convertMinor, calculateCrossCurrencyTarget, destinationMinor } from './currency';

describe('currency conversion', () => {
  it('converts between currencies with same minor digits', () => {
    // 100 USD (10000 cents) @ 121.50 BDT/USD = 12,150.00 BDT (1215000 poisha)
    const bdt = convertMinor(10000, 'USD', 'BDT', 121.5);
    expect(bdt).toBe(1215000);

    // Inverse: 12,150.00 BDT @ (1/121.5) USD/BDT = ~100.00 USD (10000 cents)
    const usd = convertMinor(1215000, 'BDT', 'USD', 1 / 121.5);
    expect(usd).toBe(10000);
  });

  it('converts to zero-decimal currencies (JPY)', () => {
    // 10 USD (1000 cents) @ 150 JPY/USD = 1500 JPY
    const jpy = convertMinor(1000, 'USD', 'JPY', 150);
    expect(jpy).toBe(1500);

    // 1500 JPY @ (1/150) USD/JPY = 10 USD (1000 cents)
    const usd = convertMinor(1500, 'JPY', 'USD', 1 / 150);
    expect(usd).toBe(1000);
  });

  it('converts to three-decimal currencies (KWD)', () => {
    // 100 USD (10000 cents) @ 0.308 KWD/USD = 30.800 KWD (30800 fils)
    const kwd = convertMinor(10000, 'USD', 'KWD', 0.308);
    expect(kwd).toBe(30800);
  });

  it('returns identical amount if from and to currencies match', () => {
    expect(convertMinor(50000, 'BDT', 'BDT', 1)).toBe(50000);
  });

  it('calculates cross currency transfer targets properly', () => {
    const target = calculateCrossCurrencyTarget(5000, 'USD', 'EUR', 0.92);
    expect(target).toBe(4600);
  });

  it('throws on invalid rates or non-safe integers', () => {
    expect(() => convertMinor(100, 'USD', 'BDT', 0)).toThrow('INVALID_EXCHANGE_RATE');
    expect(() => convertMinor(100, 'USD', 'BDT', -1)).toThrow('INVALID_EXCHANGE_RATE');
    expect(() => convertMinor(1.5, 'USD', 'BDT', 120)).toThrow('INVALID_MINOR_UNITS');
  });

  it('credits a transfer in the destination currency minor units', () => {
    expect(destinationMinor(10000, 'USD', 'BDT', 121.5)).toBe(1215000);
    expect(destinationMinor(5000, 'BDT', 'BDT', 121.5)).toBe(5000);
    expect(destinationMinor(1000, 'USD', 'JPY', 150)).toBe(1500);
  });

  it('converts large safe amounts without float precision loss and handles exact inverse rates', () => {
    expect(convertMinor(1000000000001, 'USD', 'BDT', 1.234567)).toBe(1234567000001);
    expect(convertMinor(1215000, 'BDT', 'USD', 121.5, true)).toBe(10000);
    expect(convertMinor(-1500, 'JPY', 'USD', 150, true)).toBe(-1000);
  });
});
