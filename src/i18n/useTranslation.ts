/**
 * Custom useTranslation hook wrapper for PeopleConnect Mobile.
 *
 * Provides a convenient wrapper around react-i18next's useTranslation
 * with the correct namespace and typing for the project.
 *
 * Usage:
 *   import { useAppTranslation } from '../../i18n/useTranslation';
 *   const { t, i18n, isRtl } = useAppTranslation();
 *   <Text>{t('auth.signIn')}</Text>
 */

import { useTranslation } from 'react-i18next';
import { isRtl as checkRtl } from './index';

export function useAppTranslation() {
  const { t, i18n } = useTranslation('common');

  return {
    t,
    i18n,
    currentLanguage: i18n.language,
    isRtl: checkRtl(i18n.language),
    changeLanguage: async (lang: string) => {
      await i18n.changeLanguage(lang);
    },
  };
}

// Re-export for convenience
export { useTranslation } from 'react-i18next';
