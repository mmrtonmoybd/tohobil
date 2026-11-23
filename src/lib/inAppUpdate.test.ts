import { describe, it, expect } from 'vitest';
import { parseSemver, isVersionOlder, evaluateUpdate } from './inAppUpdate';

describe('inAppUpdate', () => {
  it('parses semantic version strings correctly', () => {
    expect(parseSemver('1.2.3')).toEqual([1, 2, 3]);
    expect(parseSemver('v2.0.1')).toEqual([2, 0, 1]);
    expect(parseSemver('0.1.0')).toEqual([0, 1, 0]);
  });

  it('compares versions accurately', () => {
    expect(isVersionOlder('0.1.0', '0.2.0')).toBe(true);
    expect(isVersionOlder('0.1.0', '1.0.0')).toBe(true);
    expect(isVersionOlder('1.0.0', '1.0.1')).toBe(true);
    expect(isVersionOlder('1.0.1', '1.0.0')).toBe(false);
    expect(isVersionOlder('1.0.0', '1.0.0')).toBe(false);
  });

  it('evaluates whether update is required or optional', () => {
    const resRequired = evaluateUpdate('0.9.0', {
      min_version: '1.0.0',
      latest_version: '1.1.0',
    });
    expect(resRequired.updateRequired).toBe(true);
    expect(resRequired.updateAvailable).toBe(false);

    const resOptional = evaluateUpdate('1.0.0', {
      min_version: '1.0.0',
      latest_version: '1.1.0',
    });
    expect(resOptional.updateRequired).toBe(false);
    expect(resOptional.updateAvailable).toBe(true);

    const resUpToDate = evaluateUpdate('1.1.0', {
      min_version: '1.0.0',
      latest_version: '1.1.0',
    });
    expect(resUpToDate.updateRequired).toBe(false);
    expect(resUpToDate.updateAvailable).toBe(false);
  });
});
