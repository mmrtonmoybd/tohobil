import { describe, expect, it } from 'vitest';
import { hasBengaliDigits, toAsciiDigits, toBengaliDigits } from './digits';

describe('digits', () => {
  it('converts Bengali digits to ASCII', () => {
    expect(toAsciiDigits('০১২৩৪৫৬৭৮৯')).toBe('0123456789');
    expect(toAsciiDigits('০১৭১২-৩৪৫৬৭৮')).toBe('01712-345678');
    expect(toAsciiDigits('৳ ১,৫০০')).toBe('৳ 1,500');
    expect(toAsciiDigits('abc')).toBe('abc');
    expect(toAsciiDigits('')).toBe('');
  });

  it('converts ASCII digits to Bengali', () => {
    expect(toBengaliDigits('0123456789')).toBe('০১২৩৪৫৬৭৮৯');
    expect(toBengaliDigits(12345)).toBe('১২৩৪৫');
    expect(toBengaliDigits('01712-345678')).toBe('০১৭১২-৩৪৫৬৭৮');
  });

  it('detects Bengali digits', () => {
    expect(hasBengaliDigits('০১৭১২')).toBe(true);
    expect(hasBengaliDigits('01712')).toBe(false);
    expect(hasBengaliDigits('Taka')).toBe(false);
  });
});
