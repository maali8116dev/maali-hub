import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enCommon from '../locales/en/common.json';
import enNavigation from '../locales/en/navigation.json';
import enLanding from '../locales/en/landing.json';
import enFooter from '../locales/en/footer.json';
import enDashboard from '../locales/en/dashboard.json';

import frCommon from '../locales/fr/common.json';
import frNavigation from '../locales/fr/navigation.json';
import frLanding from '../locales/fr/landing.json';
import frFooter from '../locales/fr/footer.json';
import frDashboard from '../locales/fr/dashboard.json';

import ptCommon from '../locales/pt/common.json';
import ptNavigation from '../locales/pt/navigation.json';
import ptLanding from '../locales/pt/landing.json';
import ptFooter from '../locales/pt/footer.json';
import ptDashboard from '../locales/pt/dashboard.json';

import deCommon from '../locales/de/common.json';
import deNavigation from '../locales/de/navigation.json';
import deLanding from '../locales/de/landing.json';
import deFooter from '../locales/de/footer.json';
import deDashboard from '../locales/de/dashboard.json';

const enBundle = {
  common: enCommon,
  navigation: enNavigation,
  landing: enLanding,
  footer: enFooter,
  dashboard: enDashboard,
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: enBundle,
      de: {
        common: deCommon,
        navigation: deNavigation,
        landing: deLanding,
        footer: deFooter,
        dashboard: deDashboard,
      },
      fr: {
        common: frCommon,
        navigation: frNavigation,
        landing: frLanding,
        footer: frFooter,
        dashboard: frDashboard,
      },
      pt: {
        common: ptCommon,
        navigation: ptNavigation,
        landing: ptLanding,
        footer: ptFooter,
        dashboard: ptDashboard,
      },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr', 'pt', 'de'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      // Detection order: localStorage (saved preference) -> querystring -> pathname -> navigator (browser) -> htmlTag
      order: ['localStorage', 'querystring', 'pathname', 'navigator', 'htmlTag'],
      // Cache the detected language
      caches: ['localStorage'],
      // Look for language in URL query string (e.g., ?lang=fr)
      lookupQuerystring: 'lang',
      // Look for language in URL pathname (e.g., /fr/page)
      lookupFromPathIndex: 0,
      // Check HTML lang attribute
      lookupFromSubdomainIndex: 0,
      // Convert detected language codes (e.g., 'fr-FR' -> 'fr', 'pt-BR' -> 'pt')
      convertDetectedLanguage: (lng: string) => {
        // Map language codes to supported languages
        const languageMap: Record<string, string> = {
          'fr': 'fr',      // French (any variant)
          'fr-FR': 'fr',   // French (France)
          'fr-CA': 'fr',   // French (Canada)
          'fr-BE': 'fr',   // French (Belgium)
          'pt': 'pt',      // Portuguese (any variant)
          'pt-BR': 'pt',   // Portuguese (Brazil)
          'pt-PT': 'pt',   // Portuguese (Portugal)
          'de': 'de',
          'de-DE': 'de',
          'de-AT': 'de',
          'de-CH': 'de',
          'en': 'en',      // English (any variant)
          'en-US': 'en',   // English (US)
          'en-GB': 'en',   // English (UK)
        };
        
        // Check if exact match exists
        if (languageMap[lng]) {
          return languageMap[lng];
        }
        
        // Extract base language code (e.g., 'fr-FR' -> 'fr')
        const baseLang = lng.split('-')[0];
        
        // Return base language if supported, otherwise fallback to 'en'
        return ['en', 'fr', 'pt', 'de'].includes(baseLang) ? baseLang : 'en';
      },
    },
  });

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language?.split('-')[0] || 'en';
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng.split('-')[0];
  });
}

export default i18n;









