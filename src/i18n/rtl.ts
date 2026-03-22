/**
 * RTL (Right-to-Left) support utilities for PeopleConnect Mobile.
 *
 * Handles I18nManager configuration for Arabic language support.
 * React Native requires I18nManager.forceRTL() and an app restart
 * for RTL layout changes to take effect.
 *
 * Usage:
 *   import { applyRTL, isCurrentLayoutRTL } from '../../i18n/rtl';
 *   await applyRTL('ar'); // switches to RTL, may require restart
 */

import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = '@peopleconnect_language';

/**
 * Apply RTL layout based on language code.
 * Returns true if the app needs a restart for changes to take effect.
 */
export async function applyRTL(langCode: string): Promise<boolean> {
  const shouldBeRTL = langCode === 'ar';
  const currentIsRTL = I18nManager.isRTL;

  // Store the selected language
  await AsyncStorage.setItem(LANGUAGE_KEY, langCode);

  if (shouldBeRTL !== currentIsRTL) {
    I18nManager.forceRTL(shouldBeRTL);
    I18nManager.allowRTL(shouldBeRTL);
    // App restart is required for I18nManager changes to take effect
    return true;
  }

  return false;
}

/**
 * Get the stored language preference.
 */
export async function getStoredLanguage(): Promise<string | null> {
  return AsyncStorage.getItem(LANGUAGE_KEY);
}

/**
 * Check if the current layout direction is RTL.
 */
export function isCurrentLayoutRTL(): boolean {
  return I18nManager.isRTL;
}

/**
 * Get a style object that flips horizontal alignment for RTL.
 * Useful for manual RTL adjustments where automatic flipping is insufficient.
 */
export function rtlStyle(isRtl: boolean) {
  return {
    flexDirection: (isRtl ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
    textAlign: (isRtl ? 'right' : 'left') as 'left' | 'right',
  };
}

/**
 * Returns 'left' or 'right' based on RTL state.
 * For use in styles that need manual alignment adjustment.
 */
export function rtlAlign(isRtl: boolean): 'left' | 'right' {
  return isRtl ? 'right' : 'left';
}
