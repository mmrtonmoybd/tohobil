import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import { toAsciiDigits } from './digits';

export interface Country {
  code: CountryCode;
  dialCode: string;
  name: string;
  nativeName: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: 'BD', dialCode: '+880', name: 'Bangladesh', nativeName: 'বাংলাদেশ', flag: '🇧🇩' },
  { code: 'IN', dialCode: '+91', name: 'India', nativeName: 'ভারত', flag: '🇮🇳' },
  { code: 'US', dialCode: '+1', name: 'United States', nativeName: 'যুক্তরাষ্ট্র', flag: '🇺🇸' },
  { code: 'GB', dialCode: '+44', name: 'United Kingdom', nativeName: 'যুক্তরাজ্য', flag: '🇬🇧' },
  { code: 'AE', dialCode: '+971', name: 'United Arab Emirates', nativeName: 'সংযুক্ত আরব আমিরাত', flag: '🇦🇪' },
  { code: 'SA', dialCode: '+966', name: 'Saudi Arabia', nativeName: 'সৌদি আরব', flag: '🇸🇦' },
  { code: 'MY', dialCode: '+60', name: 'Malaysia', nativeName: 'মালয়েশিয়া', flag: '🇲🇾' },
  { code: 'SG', dialCode: '+65', name: 'Singapore', nativeName: 'সিঙ্গাপুর', flag: '🇸🇬' },
  { code: 'CA', dialCode: '+1', name: 'Canada', nativeName: 'কানাডা', flag: '🇨🇦' },
  { code: 'AU', dialCode: '+61', name: 'Australia', nativeName: 'অস্ট্রেলিয়া', flag: '🇦🇺' },
  { code: 'QA', dialCode: '+974', name: 'Qatar', nativeName: 'কাতার', flag: '🇶🇦' },
  { code: 'KW', dialCode: '+965', name: 'Kuwait', nativeName: 'কুয়েত', flag: '🇰🇼' },
  { code: 'OM', dialCode: '+968', name: 'Oman', nativeName: 'ওমান', flag: '🇴🇲' },
  { code: 'IT', dialCode: '+39', name: 'Italy', nativeName: 'ইতালি', flag: '🇮🇹' },
];

const englishRegions = new Intl.DisplayNames(['en'], { type: 'region' });
export const ALL_COUNTRIES: Country[] = getCountries().map((code) => ({
  code,
  dialCode: `+${getCountryCallingCode(code)}`,
  name: englishRegions.of(code) || code,
  nativeName: code,
  flag: [...code].map((letter) => String.fromCodePoint(letter.charCodeAt(0) + 127397)).join(''),
})).sort((a, b) => a.name.localeCompare(b.name));

const COUNTRY_CURRENCY: Record<string, string> = {
  BD: 'BDT',
  IN: 'INR',
  US: 'USD',
  GB: 'GBP',
  AE: 'AED',
  SA: 'SAR',
  MY: 'MYR',
  SG: 'SGD',
  CA: 'CAD',
  AU: 'AUD',
  QA: 'QAR',
  KW: 'KWD',
  OM: 'OMR',
  BH: 'BHD',
  PK: 'PKR',
  NP: 'NPR',
  LK: 'LKR',
  JP: 'JPY',
  CN: 'CNY',
  IT: 'EUR',
  DE: 'EUR',
  FR: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
};

export function currencyForCountry(code: string): string {
  return COUNTRY_CURRENCY[code.trim().toUpperCase()] ?? 'USD';
}

export function countryFromLocale(locale: string): Country {
  const region = locale.match(/[-_]([A-Za-z]{2})(?:$|[-_])/)?.[1]?.toUpperCase();
  return ALL_COUNTRIES.find((country) => country.code === region) || ALL_COUNTRIES.find((country) => country.code === 'BD')!;
}

export function normalizePhone(
  raw: string,
  defaultCountry: CountryCode = 'BD',
): { e164: string; nationalNumber: string; country: CountryCode; isValid: boolean } | null {
  if (!raw) return null;
  let cleaned = toAsciiDigits(raw).trim().replace(/[\s()-]/g, '');

  if (defaultCountry === 'BD' && /^01[3-9]\d{8}$/.test(cleaned)) {
    cleaned = '+88' + cleaned;
  }

  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (!parsed) {
    if (/^\+[1-9]\d{7,14}$/.test(cleaned)) {
      return {
        e164: cleaned,
        nationalNumber: cleaned.replace(/^\+\d{1,3}/, ''),
        country: defaultCountry,
        isValid: true,
      };
    }
    return null;
  }

  return {
    e164: parsed.number,
    nationalNumber: parsed.nationalNumber,
    country: (parsed.country as CountryCode) || defaultCountry,
    isValid: parsed.isValid(),
  };
}

export function isValidPhone(raw: string, defaultCountry: CountryCode = 'BD'): boolean {
  const normalized = normalizePhone(raw, defaultCountry);
  return Boolean(normalized && normalized.isValid);
}

export function formatPhoneDisplay(raw: string, defaultCountry: CountryCode = 'BD'): string {
  const norm = normalizePhone(raw, defaultCountry);
  if (!norm) return raw;
  const parsed = parsePhoneNumberFromString(norm.e164);
  return parsed ? parsed.formatInternational() : norm.e164;
}
