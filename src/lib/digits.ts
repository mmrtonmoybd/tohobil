const BN_TO_ASCII: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

const ASCII_TO_BN: Record<string, string> = {
  '0': '০',
  '1': '১',
  '2': '২',
  '3': '৩',
  '4': '৪',
  '5': '৫',
  '6': '৬',
  '7': '৭',
  '8': '৮',
  '9': '৯',
};

export function toAsciiDigits(value: string): string {
  if (!value) return '';
  return value.replace(/[০-৯]/g, (ch) => BN_TO_ASCII[ch] ?? ch);
}

export function toBengaliDigits(value: string | number): string {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[0-9]/g, (ch) => ASCII_TO_BN[ch] ?? ch);
}

export function hasBengaliDigits(value: string): boolean {
  return /[০-৯]/.test(value);
}
