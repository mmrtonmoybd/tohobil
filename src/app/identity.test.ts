import { describe, expect, it } from 'vitest';
import { ApiError, getApiBaseUrl, isAccessCode } from './identity';

describe('identity', () => {
  it('recognizes every full-screen access state', () => {
    const codes = [
      'ACCOUNT_DISABLED',
      'ACCOUNT_BLOCKED',
      'DEVICE_BLOCKED',
      'ACCESS_BLOCKED',
      'MAINTENANCE',
      'UPDATE_REQUIRED',
    ];
    for (const code of codes) {
      expect(isAccessCode(code)).toBe(true);
    }
    expect(isAccessCode('INVALID_CREDENTIALS')).toBe(false);
    expect(isAccessCode('UNAUTHENTICATED')).toBe(false);
  });

  it('constructs ApiError correctly with code, message and status', () => {
    const err = new ApiError('PHONE_IN_USE', 'Phone is taken', 409);
    expect(err.code).toBe('PHONE_IN_USE');
    expect(err.message).toBe('Phone is taken');
    expect(err.status).toBe(409);
    expect(err.name).toBe('ApiError');
  });

  it('returns valid api base url', () => {
    const url = getApiBaseUrl();
    expect(typeof url).toBe('string');
  });
});
