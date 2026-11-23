import { normalizeDigits, parseMinor } from './money';

function scaledDecimal(input: string, digits: number): bigint {
  const normalized = normalizeDigits(input).replace(/[, ]/g, '');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return 0n;
  const [whole, fraction = ''] = normalized.split('.');
  const frac = fraction.slice(0, digits).padEnd(digits, '0');
  return BigInt(whole || '0') * 10n ** BigInt(digits) + BigInt(frac || '0');
}

function minorOrZero(input: string, currency: string): bigint {
  try {
    return BigInt(parseMinor(input.trim() === '' ? '0' : input, currency));
  } catch {
    return 0n;
  }
}

function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) return 0n;
  const negative = numerator < 0n;
  const abs = negative ? -numerator : numerator;
  return ((abs + denominator / 2n) / denominator) * (negative ? -1n : 1n);
}

function toSafe(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error('AMOUNT_TOO_LARGE');
  }
  return Number(value);
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

function pow(base: bigint, exponent: number): bigint {
  let result = 1n;
  let value = base;
  let exp = exponent;
  while (exp > 0) {
    if (exp % 2 === 1) result *= value;
    value *= value;
    exp = Math.floor(exp / 2);
  }
  return result;
}

/** Monthly interest as a reduced fraction of 1. Null means a zero rate. */
function monthlyRate(annualPercent: string): { num: bigint; den: bigint } | null {
  const scaled = scaledDecimal(annualPercent, 6);
  if (scaled <= 0n) return null;
  let num = scaled;
  let den = 1_000_000n * 1_200n;
  const divisor = gcd(num, den);
  num /= divisor;
  den /= divisor;
  return { num, den };
}

export type ZakatEstimate = {
  thresholdMinor: number;
  netMinor: number;
  dueMinor: number;
  obligatory: boolean;
};

export function estimateZakat(input: {
  currency: string;
  standard: 'gold' | 'silver';
  goldGrams: string;
  silverGrams: string;
  pricePerGram: string;
  cash: string;
  bank: string;
  receivables: string;
  goldAssets: string;
  otherAssets: string;
  liabilities: string;
}): ZakatEstimate {
  const grams = scaledDecimal(
    input.standard === 'gold' ? input.goldGrams : input.silverGrams,
    4,
  );
  const price = minorOrZero(input.pricePerGram, input.currency);
  const threshold = roundDiv(grams * price, 10_000n);
  const assets =
    minorOrZero(input.cash, input.currency) +
    minorOrZero(input.bank, input.currency) +
    minorOrZero(input.receivables, input.currency) +
    minorOrZero(input.goldAssets, input.currency) +
    minorOrZero(input.otherAssets, input.currency);
  const liabilities = minorOrZero(input.liabilities, input.currency);
  const net = assets > liabilities ? assets - liabilities : 0n;
  const obligatory = threshold > 0n && net >= threshold;
  const due = obligatory ? roundDiv(net, 40n) : 0n;
  return {
    thresholdMinor: toSafe(threshold),
    netMinor: toSafe(net),
    dueMinor: toSafe(due),
    obligatory,
  };
}

export type LoanQuote = {
  emiMinor: number;
  interestMinor: number;
  totalMinor: number;
};

export function quoteLoan(
  principalInput: string,
  annualPercent: string,
  months: number,
  currency: string,
): LoanQuote {
  const principal = minorOrZero(principalInput, currency);
  const count = Math.max(0, Math.trunc(months));
  if (principal <= 0n || count <= 0) {
    return { emiMinor: 0, interestMinor: 0, totalMinor: 0 };
  }
  const rate = monthlyRate(annualPercent);
  let emi: bigint;
  if (!rate) {
    emi = roundDiv(principal, BigInt(count));
  } else {
    const a = rate.den + rate.num;
    const grown = pow(a, count);
    const base = pow(rate.den, count);
    const numerator = principal * rate.num * grown;
    const denominator = rate.den * (grown - base);
    emi = roundDiv(numerator, denominator);
  }
  const total = emi * BigInt(count);
  const interest = total > principal ? total - principal : 0n;
  return {
    emiMinor: toSafe(emi),
    interestMinor: toSafe(interest),
    totalMinor: toSafe(total),
  };
}

export type DepositQuote = {
  grossProfitMinor: number;
  taxMinor: number;
  netPayoutMinor: number;
  totalDepositMinor: number;
};

export function quoteFdr(
  principalInput: string,
  annualPercent: string,
  months: number,
  taxPercent: string,
  currency: string,
): DepositQuote {
  const principal = minorOrZero(principalInput, currency);
  const count = Math.max(0, Math.trunc(months));
  const rate = scaledDecimal(annualPercent, 6);
  const profit =
    principal > 0n && count > 0 && rate > 0n
      ? roundDiv(principal * rate * BigInt(count), 1_000_000n * 100n * 12n)
      : 0n;
  const tax = roundDiv(profit * scaledDecimal(taxPercent, 4), 1_000_000n);
  const net = principal + profit - tax;
  return {
    grossProfitMinor: toSafe(profit),
    taxMinor: toSafe(tax),
    netPayoutMinor: toSafe(net),
    totalDepositMinor: toSafe(principal),
  };
}

export function quoteDps(
  monthlyInput: string,
  annualPercent: string,
  years: number,
  taxPercent: string,
  currency: string,
): DepositQuote {
  const monthly = minorOrZero(monthlyInput, currency);
  const count = Math.max(0, Math.trunc(years)) * 12;
  const deposited = monthly * BigInt(count);
  const rate = monthlyRate(annualPercent);
  let future = deposited;
  if (monthly > 0n && count > 0 && rate) {
    const a = rate.den + rate.num;
    const grown = pow(a, count);
    const base = pow(rate.den, count);
    future = roundDiv(monthly * (grown - base) * a, base * rate.num);
  }
  const interest = future > deposited ? future - deposited : 0n;
  const tax = roundDiv(interest * scaledDecimal(taxPercent, 4), 1_000_000n);
  return {
    grossProfitMinor: toSafe(interest),
    taxMinor: toSafe(tax),
    netPayoutMinor: toSafe(deposited + interest - tax),
    totalDepositMinor: toSafe(deposited),
  };
}
