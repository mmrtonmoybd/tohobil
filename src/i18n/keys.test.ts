import { describe, expect, it } from 'vitest';
import en from './en.json';
import bn from './bn.json';
const keys = (value: unknown, prefix = ''): string[] =>
  Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    typeof child === 'object'
      ? keys(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
describe('translations', () => {
  it('has matching English and Bengali keys', () => {
    expect(keys(bn).sort()).toEqual(keys(en).sort());
  });
});
