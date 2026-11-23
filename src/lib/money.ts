const minorDigits: Record<string, number> = {
  BDT: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  INR: 2,
  JPY: 0,
  KWD: 3,
  BHD: 3,
};
export function normalizeDigits(input: string): string {
  return input.replace(/[০-৯]/g, (digit) =>
    String('০১২৩৪৫৬৭৮৯'.indexOf(digit)),
  );
}
export function currencyDigits(currency: string): number {
  return (
    minorDigits[currency] ??
    new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits
  );
}
export function parseMinor(input: string, currency: string): number {
  const digits = currencyDigits(currency);
  const normalized = normalizeDigits(input).replace(/[ ,৳$€£]/g, '');
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) throw new Error('INVALID_AMOUNT');
  const negative = normalized.startsWith('-');
  const [whole, fraction = ''] = (
    negative ? normalized.slice(1) : normalized
  ).split('.');
  if (fraction.length > digits) throw new Error('TOO_MANY_DECIMALS');
  const minor =
    BigInt(whole) * 10n ** BigInt(digits) +
    BigInt(fraction.padEnd(digits, '0') || '0');
  const signed = negative ? -minor : minor;
  if (
    signed > BigInt(Number.MAX_SAFE_INTEGER) ||
    signed < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new Error('AMOUNT_TOO_LARGE');
  return Number(signed);
}
export function formatMinor(
  amount: number,
  currency: string,
  language: string,
): string {
  if (!Number.isSafeInteger(amount)) throw new Error('INVALID_MINOR_UNITS');
  const digits = currencyDigits(currency);
  const divisor = 10n ** BigInt(digits);
  const locale =
    language === 'bn' ? 'bn-BD' : currency === 'BDT' ? 'en-IN' : 'en';
  const abs = BigInt(amount < 0 ? -amount : amount);
  const whole = abs / divisor;
  const frac = abs % divisor;
  const wholeText = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(whole);
  const fractional = digits
    ? `.${
        language === 'bn'
          ? frac
              .toString()
              .padStart(digits, '0')
              .replace(/[0-9]/g, (digit) => '০১২৩৪৫৬৭৮৯'[Number(digit)])
          : frac.toString().padStart(digits, '0')
      }`
    : '';
  const symbol =
    currency === 'BDT'
      ? '৳'
      : (new Intl.NumberFormat(locale, { style: 'currency', currency })
          .formatToParts(0)
          .find((x) => x.type === 'currency')?.value ?? currency);
  return `${amount < 0 ? '−' : ''}${symbol}${wholeText}${fractional}`;
}
export function addMinor(...values: number[]): number {
  const total = values.reduce((sum, v) => {
    if (!Number.isSafeInteger(v)) throw new Error('INVALID_MINOR_UNITS');
    return sum + BigInt(v);
  }, 0n);
  if (
    total > BigInt(Number.MAX_SAFE_INTEGER) ||
    total < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new Error('AMOUNT_TOO_LARGE');
  return Number(total);
}

export function minorToInput(amount: number, currency: string): string {
  if (!Number.isSafeInteger(amount)) throw new Error('INVALID_MINOR_UNITS');
  const divisor = 10n ** BigInt(currencyDigits(currency));
  const value = BigInt(amount);
  const abs = value < 0n ? -value : value;
  const whole = abs / divisor;
  const fraction = (abs % divisor)
    .toString()
    .padStart(currencyDigits(currency), '0')
    .replace(/0+$/, '');
  return `${value < 0n ? '-' : ''}${whole}${fraction ? '.' + fraction : ''}`;
}
