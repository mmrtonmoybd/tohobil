import { describe, expect, it } from 'vitest';
import { calculateMinor } from './calculator';

describe('calculator minor units', () => {
  it('rounds a division once to the selected currency precision', () => {
    expect(calculateMinor('100÷3', 'BDT')).toBe(3333);
    expect(calculateMinor('2÷3', 'BDT')).toBe(67);
    expect(calculateMinor('2÷3', 'JPY')).toBe(1);
    expect(calculateMinor('2÷3', 'KWD')).toBe(667);
  });

  it('accepts Bengali digits and rejects unsafe results', () => {
    expect(calculateMinor('১০০+০.৫', 'BDT')).toBe(10050);
    expect(() => calculateMinor('999999999999999999', 'BDT')).toThrow('AMOUNT_TOO_LARGE');
  });
});
