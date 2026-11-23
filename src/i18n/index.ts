import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import bn from './bn.json';
const saved = localStorage.getItem('tohobil.language');
const language =
  saved === 'en' || saved === 'bn'
    ? saved
    : navigator.language.toLowerCase().startsWith('bn')
      ? 'bn'
      : 'en';
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, bn: { translation: bn } },
  lng: language,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});
document.documentElement.lang = language;
document.title = i18n.t('appName');
export async function setLanguage(value: 'en' | 'bn') {
  await i18n.changeLanguage(value);
  localStorage.setItem('tohobil.language', value);
  document.documentElement.lang = value;
  document.title = i18n.t('appName');
  void import('../lib/push').then(({ switchPushLanguage }) => switchPushLanguage(value)).catch(() => {});
}
export default i18n;
