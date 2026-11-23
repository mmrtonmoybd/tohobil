import { toAsciiDigits } from './digits';

export interface ParsedReceipt {
  merchant: string | null;
  date: string | null; // YYYY-MM-DD
  amount: number | null; // Minor units (poisha)
  tax: number | null; // Minor units (poisha)
  currency: string;
  confidence: number;
  raw: string;
}

const NOISE_WORDS = new Set([
  'tax invoice',
  'invoice',
  'cash memo',
  'cash receipt',
  'bill',
  'receipt',
  'sales receipt',
  'customer copy',
  'merchant copy',
  'welcome',
  'thank you',
  'bin',
  'tin',
  'vat reg',
  'hotline',
  'phone',
  'tel',
  'mobile',
  'date',
  'time',
  'chalan',
]);

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

function normalizeText(text: string): string {
  return toAsciiDigits(text || '');
}

/**
 * Extracts merchant name from receipt header lines
 */
function extractMerchant(lines: string[]): string | null {
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const raw = lines[i].trim();
    if (!raw || raw.length < 2) continue;

    const lower = raw.toLowerCase();
    // Skip noise/generic header keywords
    let isNoise = false;
    for (const noise of NOISE_WORDS) {
      if (lower === noise || lower.startsWith(noise + ':') || lower.startsWith(noise + ' -')) {
        isNoise = true;
        break;
      }
    }
    if (isNoise) continue;

    // Skip if line looks mostly like numbers, symbols, or phone
    if (/^[\d\s+\-():.]+$/.test(raw)) continue;
    if (lower.startsWith('order #') || lower.startsWith('table #') || lower.startsWith('inv:')) continue;

    // Clean formatting characters like *** or ===
    const clean = raw.replace(/^[*=\-_#\s]+|[*=\-_#\s]+$/g, '').trim();
    if (clean.length >= 2) {
      return clean;
    }
  }
  return null;
}

/**
 * Extracts date formatted as YYYY-MM-DD
 */
function extractDate(text: string): string | null {
  const norm = normalizeText(text);

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = norm.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // 2. Day-Month-Year: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = norm.match(/\b(0[1-9]|[12]\d|3[01])[-/.](0[1-9]|1[0-2])[-/.](20\d{2})\b/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  }

  // 3. DD Mon YYYY: e.g. 23 Nov 2026 or 23-Nov-2026
  const monMatch = norm.match(/\b(0?[1-9]|[12]\d|3[01])[-/\s]+([a-zA-Z]{3,9})[-/\s]+(20\d{2})\b/);
  if (monMatch) {
    const day = monMatch[1].padStart(2, '0');
    const monthKey = monMatch[2].toLowerCase();
    const month = MONTH_MAP[monthKey];
    const year = monMatch[3];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // 4. Mon DD, YYYY: e.g. Nov 23, 2026
  const monDayMatch = norm.match(/\b([a-zA-Z]{3,9})[-/\s]+(0?[1-9]|[12]\d|3[01]),?[-/\s]+(20\d{2})\b/);
  if (monDayMatch) {
    const monthKey = monDayMatch[1].toLowerCase();
    const day = monDayMatch[2].padStart(2, '0');
    const month = MONTH_MAP[monthKey];
    const year = monDayMatch[3];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

/**
 * Parses numeric monetary string safely into integer minor units (poisha).
 * Strictly avoids floating point math.
 */
function parsePoisha(str: string): number | null {
  const clean = str.replace(/[, \t]/g, '');
  if (!clean || !/^(\d+)(\.\d{1,2})?$/.test(clean)) {
    return null;
  }
  const parts = clean.split('.');
  const whole = parseInt(parts[0], 10);
  if (Number.isNaN(whole)) return null;

  let frac = 0;
  if (parts.length > 1) {
    const fracStr = parts[1].padEnd(2, '0').slice(0, 2);
    frac = parseInt(fracStr, 10);
    if (Number.isNaN(frac)) frac = 0;
  }

  return whole * 100 + frac;
}

/**
 * Extracts total amount in minor units (poisha)
 */
function extractTotalAmount(lines: string[]): number | null {
  const primaryTotalKeywords = [
    'grand total',
    'total payable',
    'total bill',
    'bill total',
    'net total',
    'total amount',
    'net amount',
    'সর্বমোট',
    'মোট',
    'total',
  ];

  const secondaryKeywords = [
    'paid amount',
    'paid',
    'bdt',
    'tk',
    '৳',
  ];

  const numRegex = /(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/g;

  // 1. First search for primary total keywords from bottom upwards
  for (let i = lines.length - 1; i >= 0; i--) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;
    const lower = rawLine.toLowerCase();

    // Skip change / refund lines
    if (lower.includes('change') || lower.includes('ফেরত')) continue;

    for (const kw of primaryTotalKeywords) {
      if (lower.includes(kw)) {
        const line = normalizeText(rawLine);
        const candidates = line.match(numRegex);
        if (candidates && candidates.length > 0) {
          const lastNum = candidates[candidates.length - 1];
          const val = parsePoisha(lastNum);
          if (val !== null && val > 0) {
            return val;
          }
        }
      }
    }
  }

  // 2. Search for secondary keywords (paid, currency tokens)
  for (let i = lines.length - 1; i >= 0; i--) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;
    const lower = rawLine.toLowerCase();
    if (lower.includes('change') || lower.includes('ফেরত')) continue;

    for (const kw of secondaryKeywords) {
      if (lower.includes(kw)) {
        const line = normalizeText(rawLine);
        const candidates = line.match(numRegex);
        if (candidates && candidates.length > 0) {
          const lastNum = candidates[candidates.length - 1];
          const val = parsePoisha(lastNum);
          if (val !== null && val > 0) {
            return val;
          }
        }
      }
    }
  }

  // 3. Fallback: look for the highest standalone currency amount in the lower half of receipt
  let maxFound = 0;
  for (let i = Math.floor(lines.length / 2); i < lines.length; i++) {
    const line = normalizeText(lines[i]);
    const matches = line.match(numRegex);
    if (matches) {
      for (const m of matches) {
        const val = parsePoisha(m);
        if (val !== null && val > maxFound) {
          maxFound = val;
        }
      }
    }
  }

  return maxFound > 0 ? maxFound : null;
}

/**
 * Extracts tax/VAT in minor units (poisha)
 */
function extractTax(lines: string[]): number | null {
  const taxKeywords = ['vat', 'tax', 'ভ্যাট', 'ট্যাক্স', 'sd', 's.d.', 'service charge'];
  const numRegex = /(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/g;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    const lower = rawLine.toLowerCase();

    for (const kw of taxKeywords) {
      if (lower.includes(kw) && !lower.includes('vat reg') && !lower.includes('bin') && !lower.includes('tax invoice')) {
        const line = normalizeText(rawLine);
        const candidates = line.match(numRegex);
        if (candidates && candidates.length > 0) {
          const val = parsePoisha(candidates[candidates.length - 1]);
          if (val !== null && val > 0) {
            return val;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Main receipt OCR parser entry point.
 */
export function parseReceiptText(text: string, defaultCurrency = 'BDT'): ParsedReceipt {
  const raw = text || '';
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const merchant = extractMerchant(lines);
  const date = extractDate(raw);
  const amount = extractTotalAmount(lines);
  const tax = extractTax(lines);

  let confidenceScore = 0;
  if (amount !== null) confidenceScore += 0.5;
  if (date !== null) confidenceScore += 0.25;
  if (merchant !== null) confidenceScore += 0.25;

  return {
    merchant,
    date,
    amount,
    tax,
    currency: defaultCurrency,
    confidence: Math.round(confidenceScore * 100) / 100,
    raw,
  };
}
