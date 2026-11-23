import { currencyDigits } from './money';

/**
 * Converts an amount in minor units from one currency to another using the given exchange rate.
 *
 * @param amountMinor Amount in integer minor units of fromCurrency
 * @param fromCurrency Source ISO-4217 code (e.g. 'USD')
 * @param toCurrency Target ISO-4217 code (e.g. 'BDT')
 * @param rate Number of toCurrency major units per 1 fromCurrency major unit (e.g. 121.50 BDT per 1 USD)
 * @returns Converted amount in integer minor units of toCurrency
 */
export function convertMinor(
  amountMinor: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  inverse = false,
): number {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error('INVALID_MINOR_UNITS');
  }
  if (!rate || rate <= 0 || !Number.isFinite(rate)) {
    throw new Error('INVALID_EXCHANGE_RATE');
  }
  if (fromCurrency === toCurrency) {
    return amountMinor;
  }

  const fromDigits = currencyDigits(fromCurrency);
  const toDigits = currencyDigits(toCurrency);

  const match = rate.toString().match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if (!match) throw new Error('INVALID_EXCHANGE_RATE');
  const fraction = match[2] ?? '';
  const exponent = Number(match[3] ?? 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) throw new Error('INVALID_EXCHANGE_RATE');
  let numerator = BigInt(match[1] + fraction);
  let denominator = 10n ** BigInt(fraction.length);
  if (exponent > 0) numerator *= 10n ** BigInt(exponent);
  if (exponent < 0) denominator *= 10n ** BigInt(-exponent);
  if (inverse) [numerator, denominator] = [denominator, numerator];
  numerator *= 10n ** BigInt(toDigits);
  denominator *= 10n ** BigInt(fromDigits);
  const abs = BigInt(amountMinor < 0 ? -amountMinor : amountMinor);
  const rounded = (abs * numerator + denominator / 2n) / denominator;
  const signed = amountMinor < 0 ? -rounded : rounded;
  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER))
    throw new Error('AMOUNT_TOO_LARGE');
  return Number(signed);
}

/**
 * Calculates effective target amount for a cross-currency transfer.
 */
/** Credit that lands in the destination account. Same-currency transfers keep the source minor amount. */
export function destinationMinor(
  amountMinor: number,
  fromCurrency: string,
  toCurrency: string | null | undefined,
  rate: number | null | undefined,
): number {
  if (!toCurrency || fromCurrency === toCurrency || !rate || rate <= 0) return amountMinor;
  return convertMinor(amountMinor, fromCurrency, toCurrency, rate);
}

export function calculateCrossCurrencyTarget(
  sourceAmountMinor: number,
  sourceCurrency: string,
  targetCurrency: string,
  exchangeRate: number,
): number {
  return convertMinor(sourceAmountMinor, sourceCurrency, targetCurrency, exchangeRate);
}
