import { describe, expect, it } from 'vitest';
import { addMinor, formatMinor, minorToInput, parseMinor } from './money';
import { calculate } from './calculator';

describe('integer money amounts', () => {
  it('round trips amounts across currency precisions', () => {
    for (const [currency, value] of [
      ['BDT', '123456789.99'],
      ['JPY', '123456789'],
      ['KWD', '123456789.999'],
    ]) {
      const minor = parseMinor(value, currency);
      expect(minorToInput(minor, currency)).toBe(value);
    }
  });
  it('supports Bengali digits and rejects fractional minor units', () => {
    expect(parseMinor('১২৩.৪৫', 'BDT')).toBe(12345);
    expect(() => parseMinor('1.001', 'BDT')).toThrow('TOO_MANY_DECIMALS');
  });
  it('rejects overflow when balances are combined', () => {
    expect(() => addMinor(Number.MAX_SAFE_INTEGER, 1)).toThrow(
      'AMOUNT_TOO_LARGE',
    );
    expect(formatMinor(-12345, 'BDT', 'en')).toContain('123.45');
  });
});

describe('calculator', () => {
  it('keeps precedence and exact decimal results', () => {
    expect(calculate('0.1+0.2×3')).toBe('0.7');
    expect(parseMinor(calculate('2÷4'), 'BDT')).toBe(50);
  });
  it('rejects zero division and malformed expressions', () => {
    expect(() => calculate('1÷0')).toThrow('DIVIDE_BY_ZERO');
    expect(() => calculate('1++2')).toThrow('INVALID_EXPRESSION');
  });
});
