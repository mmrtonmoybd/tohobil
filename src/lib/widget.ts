import { Preferences } from '@capacitor/preferences';
import { formatMinor } from './money';

export const WIDGET_BALANCE_KEY = 'tohobil_widget_balance';
export const WIDGET_CURRENCY_KEY = 'tohobil_widget_currency';
export const WIDGET_MASKED_KEY = 'tohobil_widget_masked';

export interface WidgetData {
  balanceMinor: number;
  currency: string;
  isMasked: boolean;
  formatted: string;
}

/**
 * Updates the balance cached for the home-screen widget.
 * Written to Preferences so the native Android widget provider reads it.
 */
export async function updateWidgetBalance(
  balanceMinor: number,
  currency = 'BDT',
  isMasked = false,
  locale = 'en',
): Promise<WidgetData> {
  const formatted = isMasked
    ? `${currency === 'BDT' ? '৳' : currency} ••••••`
    : formatMinor(balanceMinor, currency, locale);

  try {
    await Preferences.set({ key: WIDGET_BALANCE_KEY, value: String(balanceMinor) });
    await Preferences.set({ key: WIDGET_CURRENCY_KEY, value: currency });
    await Preferences.set({ key: WIDGET_MASKED_KEY, value: isMasked ? '1' : '0' });
  } catch {
    // ignore preference storage error in tests or unsupported environments
  }

  return {
    balanceMinor,
    currency,
    isMasked,
    formatted,
  };
}

/**
 * Retrieves cached widget balance data
 */
export async function getWidgetData(locale = 'en'): Promise<WidgetData> {
  try {
    const balRes = await Preferences.get({ key: WIDGET_BALANCE_KEY });
    const curRes = await Preferences.get({ key: WIDGET_CURRENCY_KEY });
    const maskRes = await Preferences.get({ key: WIDGET_MASKED_KEY });

    const balanceMinor = balRes.value ? parseInt(balRes.value, 10) || 0 : 0;
    const currency = curRes.value || 'BDT';
    const isMasked = maskRes.value === '1';
    const formatted = isMasked
      ? `${currency === 'BDT' ? '৳' : currency} ••••••`
      : formatMinor(balanceMinor, currency, locale);

    return {
      balanceMinor,
      currency,
      isMasked,
      formatted,
    };
  } catch {
    return {
      balanceMinor: 0,
      currency: 'BDT',
      isMasked: false,
      formatted: formatMinor(0, 'BDT', locale),
    };
  }
}
