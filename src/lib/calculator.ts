import { currencyDigits } from './money';

const SCALE = 1_000_000n;
function roundedDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error('DIVIDE_BY_ZERO');
  const sign = numerator < 0n !== denominator < 0n ? -1n : 1n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  return sign * ((n + d / 2n) / d);
}
function decimal(value: string): bigint {
  if (!/^\d+(?:\.\d{0,6})?$/.test(value)) throw new Error('INVALID_EXPRESSION');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, '0') || '0');
}
export function calculate(expression: string): string {
  const normalized = expression
    .replace(/[০-৯]/g, (digit) => String('০১২৩৪৫৬৭৮৯'.indexOf(digit)))
    .replace(/\s/g, '')
    .replace(/−/g, '-');
  const tokens = normalized.match(/\d+(?:\.\d{0,6})?|[+\-×÷]/g);
  if (!tokens || tokens.join('') !== normalized || tokens.length % 2 !== 1)
    throw new Error('INVALID_EXPRESSION');
  const values: bigint[] = [decimal(tokens[0])],
    operators: string[] = [];
  for (let i = 1; i < tokens.length; i += 2) {
    const operator = tokens[i],
      right = decimal(tokens[i + 1]);
    if (operator === '×' || operator === '÷') {
      const left = values.pop()!;
      values.push(
        operator === '×'
          ? roundedDivide(left * right, SCALE)
          : roundedDivide(left * SCALE, right),
      );
    } else {
      operators.push(operator);
      values.push(right);
    }
  }
  let answer = values[0];
  for (let i = 0; i < operators.length; i++)
    answer =
      operators[i] === '+' ? answer + values[i + 1] : answer - values[i + 1];
  const negative = answer < 0n;
  const absolute = negative ? -answer : answer;
  const whole = absolute / SCALE;
  const fraction = (absolute % SCALE)
    .toString()
    .padStart(6, '0')
    .replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? '.' + fraction : ''}`;
}

/** Evaluate a keypad expression and round once to the currency's minor unit. */
export function calculateMinor(expression: string, currency: string): number {
  const result = calculate(expression);
  const negative = result.startsWith('-');
  const [whole, fraction = ''] = (negative ? result.slice(1) : result).split('.');
  const digits = currencyDigits(currency);
  if (digits > 6) throw new Error('UNSUPPORTED_CURRENCY_PRECISION');
  const micro = BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, '0'));
  const divisor = 10n ** BigInt(6 - digits);
  const minor = (micro + divisor / 2n) / divisor * (negative ? -1n : 1n);
  if (minor > BigInt(Number.MAX_SAFE_INTEGER) || minor < BigInt(Number.MIN_SAFE_INTEGER))
    throw new Error('AMOUNT_TOO_LARGE');
  return Number(minor);
}
