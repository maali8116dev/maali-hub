import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enCommon from '../locales/en/common.json';
import enNavigation from '../locales/en/navigation.json';
import enLanding from '../locales/en/landing.json';
import enFooter from '../locales/en/footer.json';

import frCommon from '../locales/fr/common.json';
import frNavigation from '../locales/fr/navigation.json';
import frLanding from '../locales/fr/landing.json';
import frFooter from '../locales/fr/footer.json';

import ptCommon from '../locales/pt/common.json';
import ptNavigation from '../locales/pt/navigation.json';
import ptLanding from '../locales/pt/landing.json';
import ptFooter from '../locales/pt/footer.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        navigation: enNavigation,
        landing: enLanding,
        footer: enFooter,
      },
      fr: {
        common: frCommon,
        navigation: frNavigation,
        landing: frLanding,
        footer: frFooter,
      },
      pt: {
        common: ptCommon,
        navigation: ptNavigation,
        landing: ptLanding,
        footer: ptFooter,
      },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;

