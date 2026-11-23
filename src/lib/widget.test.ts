import { describe, it, expect } from 'vitest';
import { updateWidgetBalance, getWidgetData } from './widget';

describe('widget balance persistence', () => {
  it('saves and reads normal balance', async () => {
    const data = await updateWidgetBalance(1250050, 'BDT', false, 'en');
    expect(data.balanceMinor).toBe(1250050);
    expect(data.isMasked).toBe(false);
    expect(data.formatted).toContain('12,500.50');

    const read = await getWidgetData('en');
    expect(read.balanceMinor).toBe(1250050);
    expect(read.currency).toBe('BDT');
    expect(read.isMasked).toBe(false);
  });

  it('handles masked balance', async () => {
    const data = await updateWidgetBalance(500000, 'BDT', true, 'en');
    expect(data.isMasked).toBe(true);
    expect(data.formatted).toBe('৳ ••••••');

    const read = await getWidgetData('en');
    expect(read.isMasked).toBe(true);
    expect(read.formatted).toBe('৳ ••••••');
  });
});
