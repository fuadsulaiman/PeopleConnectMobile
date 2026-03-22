/**
 * i18n Configuration for PeopleConnect Mobile (React Native)
 *
 * Mirrors the web portal i18n setup using i18next + react-i18next.
 * Supports English (LTR) and Arabic (RTL).
 *
 * REQUIRED DEPENDENCIES (not yet installed):
 *   npm install i18next react-i18next
 *   (@react-native-async-storage/async-storage is already installed)
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import arCommon from './locales/ar/common.json';

export const defaultNS = 'common';

export const resources = {
  en: {
    common: enCommon,
  },
  ar: {
    common: arCommon,
  },
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS,
  interpolation: {
    escapeValue: false, // React Native already escapes
  },
  react: {
    useSuspense: false, // Avoids issues with RN Suspense
  },
});

export default i18n;

export const languages = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' as const },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl' as const },
] as const;

export type LanguageCode = (typeof languages)[number]['code'];

export function isRtl(langCode: string): boolean {
  return langCode === 'ar';
}

export function getDirection(langCode: string): 'ltr' | 'rtl' {
  return isRtl(langCode) ? 'rtl' : 'ltr';
}
