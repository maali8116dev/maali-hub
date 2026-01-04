import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enCommon from '../locales/en/common.json';
import enNavigation from '../locales/en/navigation.json';
import enHero from '../locales/en/hero.json';
import enFooter from '../locales/en/footer.json';
import enHowItWorks from '../locales/en/howItWorks.json';

import frCommon from '../locales/fr/common.json';
import frNavigation from '../locales/fr/navigation.json';
import frHero from '../locales/fr/hero.json';
import frFooter from '../locales/fr/footer.json';
import frHowItWorks from '../locales/fr/howItWorks.json';

import ptCommon from '../locales/pt/common.json';
import ptNavigation from '../locales/pt/navigation.json';
import ptHero from '../locales/pt/hero.json';
import ptFooter from '../locales/pt/footer.json';
import ptHowItWorks from '../locales/pt/howItWorks.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        navigation: enNavigation,
        hero: enHero,
        footer: enFooter,
        howItWorks: enHowItWorks,
      },
      fr: {
        common: frCommon,
        navigation: frNavigation,
        hero: frHero,
        footer: frFooter,
        howItWorks: frHowItWorks,
      },
      pt: {
        common: ptCommon,
        navigation: ptNavigation,
        hero: ptHero,
        footer: ptFooter,
        howItWorks: ptHowItWorks,
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

