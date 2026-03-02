/**
 * useTheme hook for accessing dynamic theme colors
 * Colors are loaded from admin settings on app startup
 */

import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useThemeStore } from '../stores/themeStore';

/**
 * Hook to get the current theme colors from the theme store
 * These colors are dynamically loaded from admin settings
 */
export function useTheme() {
  const { colors, isDarkMode, colorProfile, colorProfileId, isLoading } = useThemeStore();

  return {
    colors,
    isDarkMode,
    colorProfile,
    colorProfileId,
    isLoading,
  };
}

/**
 * Hook to create dynamic styles based on theme colors
 * @param styleCreator Function that receives colors and returns styles
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  styleCreator: (colors: ReturnType<typeof useThemeStore.getState>['colors']) => T
): T {
  const { colors } = useThemeStore();

  return useMemo(() => styleCreator(colors), [colors, styleCreator]);
}

/**
 * Get theme colors outside of React components (for use in callbacks, etc.)
 * Note: These colors won't auto-update when theme changes
 */
export function getThemeColors() {
  return useThemeStore.getState().colors;
}

export default useTheme;
