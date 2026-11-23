import { describe, it, expect } from 'vitest';
import { parseReceiptText } from './ocr';

describe('OCR receipt parser', () => {
  it('parses typical supermarket receipt in English', () => {
    const raw = `
      *** SHWAPNO SUPERSTORE ***
      Dhanmondi Branch, Dhaka
      BIN: 123456789
      Date: 23/11/2026 Time: 14:30
      ------------------------------
      Milk 1L              100.00
      Bread 400g            60.00
      Eggs 12pcs           150.00
      ------------------------------
      Subtotal:            310.00
      VAT (5%):             15.50
      TOTAL PAYABLE:       325.50
      Paid (Cash):         500.00
      Change:              174.50
      Thank you for shopping with us!
    `;

    const parsed = parseReceiptText(raw);
    expect(parsed.merchant).toBe('SHWAPNO SUPERSTORE');
    expect(parsed.date).toBe('2026-11-23');
    expect(parsed.amount).toBe(32550); // 325.50 * 100 in integer minor units
    expect(parsed.tax).toBe(1550); // 15.50 * 100
    expect(parsed.confidence).toBe(1);
  });

  it('parses Bengali numerals receipt', () => {
    const raw = `
      আড়ং (Aarong)
      গুলশান আউটলেট, ঢাকা
      তারিখ: ২৩/১১/২০২৬
      আইটেম:
      পাঞ্জাবি            ২,৫০০.০০
      ভ্যাট:                 ১২৫.০০
      সর্বমোট (TOTAL):   ২,৬২৫.০০
      ধন্যবাদ
    `;

    const parsed = parseReceiptText(raw);
    expect(parsed.merchant).toContain('Aarong');
    expect(parsed.date).toBe('2026-11-23');
    expect(parsed.amount).toBe(262500); // 2625.00 poisha
    expect(parsed.tax).toBe(12500);
  });

  it('handles restaurant receipt with ISO date format and service charge', () => {
    const raw = `
      MADCHEF DHANMONDI
      Order #42
      Date: 2026-11-20
      Cheeseburger Double    450.00
      Fries Large            180.00
      Coke                   60.00
      Service Charge (10%):  69.00
      VAT (5%):              34.50
      Net Total:             763.50
    `;

    const parsed = parseReceiptText(raw);
    expect(parsed.merchant).toBe('MADCHEF DHANMONDI');
    expect(parsed.date).toBe('2026-11-20');
    expect(parsed.amount).toBe(76350);
  });

  it('handles noisy text with missing date gracefully', () => {
    const raw = `
      BATA SHOE STORE
      Invoice #9912
      Shoes pair
      Total: 1899.00
    `;

    const parsed = parseReceiptText(raw);
    expect(parsed.merchant).toBe('BATA SHOE STORE');
    expect(parsed.date).toBeNull();
    expect(parsed.amount).toBe(189900);
    expect(parsed.confidence).toBeGreaterThan(0.5);
  });

  it('returns nulls for empty text', () => {
    const parsed = parseReceiptText('');
    expect(parsed.merchant).toBeNull();
    expect(parsed.date).toBeNull();
    expect(parsed.amount).toBeNull();
    expect(parsed.confidence).toBe(0);
  });
});
