import en from '../i18n/en.json';
import bn from '../i18n/bn.json';

const language = navigator.language.toLowerCase().startsWith('bn') ? 'bn' : 'en';
const dict = language === 'bn' ? bn : en;

export function t(key: keyof typeof en): string {
  return dict[key] ?? en[key];
}
