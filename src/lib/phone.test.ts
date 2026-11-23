import { describe, expect, it } from 'vitest';
import { formatPhoneDisplay, isValidPhone, normalizePhone } from './phone';

describe('phone', () => {
  it('normalizes local BD numbers to E.164', () => {
    const res = normalizePhone('01712345678', 'BD');
    expect(res).not.toBeNull();
    expect(res?.e164).toBe('+8801712345678');
    expect(res?.country).toBe('BD');
    expect(res?.isValid).toBe(true);
  });

  it('normalizes Bengali digits in BD phone number', () => {
    const res = normalizePhone('০১৭১২-৩৪৫৬৭৮', 'BD');
    expect(res).not.toBeNull();
    expect(res?.e164).toBe('+8801712345678');
    expect(res?.isValid).toBe(true);
  });

  it('normalizes international numbers', () => {
    const res = normalizePhone('+14155552671', 'US');
    expect(res).not.toBeNull();
    expect(res?.e164).toBe('+14155552671');
    expect(res?.country).toBe('US');
    expect(res?.isValid).toBe(true);
  });

  it('validates correct and incorrect phone numbers', () => {
    expect(isValidPhone('01712345678', 'BD')).toBe(true);
    expect(isValidPhone('০১৭১২৩৪৫৬৭৮', 'BD')).toBe(true);
    expect(isValidPhone('123', 'BD')).toBe(false);
    expect(isValidPhone('', 'BD')).toBe(false);
  });

  it('formats phone numbers for display', () => {
    expect(formatPhoneDisplay('01712345678', 'BD')).toBe('+880 1712 345678');
  });
});
