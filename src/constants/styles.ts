/**
 * PeopleConnect Mobile - Shared Style Utilities
 *
 * This file provides reusable style patterns and utilities
 * for consistent styling throughout the application.
 */

import { StyleSheet, ViewStyle, TextStyle, Platform } from 'react-native';
import { theme, spacing, borderRadius, shadows, typography, textStyles } from './theme';

// ============================================================================
// LAYOUT UTILITIES
// ============================================================================

export const layoutStyles = StyleSheet.create({
  // Flex layouts
  flex1: {
    flex: 1,
  },
  flexGrow: {
    flexGrow: 1,
  },
  flexShrink: {
    flexShrink: 1,
  },

  // Centering
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerHorizontal: {
    alignItems: 'center',
  },
  centerVertical: {
    justifyContent: 'center',
  },

  // Flex direction
  row: {
    flexDirection: 'row',
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  column: {
    flexDirection: 'column',
  },

  // Flex alignment
  alignStart: {
    alignItems: 'flex-start',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  alignStretch: {
    alignItems: 'stretch',
  },
  alignBaseline: {
    alignItems: 'baseline',
  },

  // Justify content
  justifyStart: {
    justifyContent: 'flex-start',
  },
  justifyEnd: {
    justifyContent: 'flex-end',
  },
  justifyBetween: {
    justifyContent: 'space-between',
  },
  justifyAround: {
    justifyContent: 'space-around',
  },
  justifyEvenly: {
    justifyContent: 'space-evenly',
  },

  // Common row layouts
  rowCenter: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  // Full size
  fullWidth: {
    width: '100%',
  },
  fullHeight: {
    height: '100%',
  },
  fullSize: {
    height: '100%',
    width: '100%',
  },

  // Absolute positioning
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  absoluteTopLeft: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  absoluteTopRight: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  absoluteBottomLeft: {
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  absoluteBottomRight: {
    bottom: 0,
    position: 'absolute',
    right: 0,
  },

  // Overflow
  overflowHidden: {
    overflow: 'hidden',
  },
  overflowVisible: {
    overflow: 'visible',
  },
});

// ============================================================================
// SPACING UTILITIES
// ============================================================================

export const spacingStyles = StyleSheet.create({
  // Padding all
  p0: { padding: spacing[0] },
  p1: { padding: spacing[1] },
  p2: { padding: spacing[2] },
  p3: { padding: spacing[3] },
  p4: { padding: spacing[4] },
  p5: { padding: spacing[5] },
  p6: { padding: spacing[6] },
  p8: { padding: spacing[8] },

  // Padding horizontal
  px0: { paddingHorizontal: spacing[0] },
  px1: { paddingHorizontal: spacing[1] },
  px2: { paddingHorizontal: spacing[2] },
  px3: { paddingHorizontal: spacing[3] },
  px4: { paddingHorizontal: spacing[4] },
  px5: { paddingHorizontal: spacing[5] },
  px6: { paddingHorizontal: spacing[6] },

  // Padding vertical
  py0: { paddingVertical: spacing[0] },
  py1: { paddingVertical: spacing[1] },
  py2: { paddingVertical: spacing[2] },
  py3: { paddingVertical: spacing[3] },
  py4: { paddingVertical: spacing[4] },
  py5: { paddingVertical: spacing[5] },
  py6: { paddingVertical: spacing[6] },

  // Margin all
  m0: { margin: spacing[0] },
  m1: { margin: spacing[1] },
  m2: { margin: spacing[2] },
  m3: { margin: spacing[3] },
  m4: { margin: spacing[4] },
  m5: { margin: spacing[5] },
  m6: { margin: spacing[6] },

  // Margin horizontal
  mx0: { marginHorizontal: spacing[0] },
  mx1: { marginHorizontal: spacing[1] },
  mx2: { marginHorizontal: spacing[2] },
  mx3: { marginHorizontal: spacing[3] },
  mx4: { marginHorizontal: spacing[4] },

  // Margin vertical
  my0: { marginVertical: spacing[0] },
  my1: { marginVertical: spacing[1] },
  my2: { marginVertical: spacing[2] },
  my3: { marginVertical: spacing[3] },
  my4: { marginVertical: spacing[4] },

  // Margin bottom
  mb0: { marginBottom: spacing[0] },
  mb1: { marginBottom: spacing[1] },
  mb2: { marginBottom: spacing[2] },
  mb3: { marginBottom: spacing[3] },
  mb4: { marginBottom: spacing[4] },
  mb6: { marginBottom: spacing[6] },
  mb8: { marginBottom: spacing[8] },

  // Margin top
  mt0: { marginTop: spacing[0] },
  mt1: { marginTop: spacing[1] },
  mt2: { marginTop: spacing[2] },
  mt3: { marginTop: spacing[3] },
  mt4: { marginTop: spacing[4] },
  mt6: { marginTop: spacing[6] },

  // Margin left
  ml0: { marginLeft: spacing[0] },
  ml1: { marginLeft: spacing[1] },
  ml2: { marginLeft: spacing[2] },
  ml3: { marginLeft: spacing[3] },
  ml4: { marginLeft: spacing[4] },

  // Margin right
  mr0: { marginRight: spacing[0] },
  mr1: { marginRight: spacing[1] },
  mr2: { marginRight: spacing[2] },
  mr3: { marginRight: spacing[3] },
  mr4: { marginRight: spacing[4] },

  // Gap (for use with flexbox)
  gap1: { gap: spacing[1] },
  gap2: { gap: spacing[2] },
  gap3: { gap: spacing[3] },
  gap4: { gap: spacing[4] },
  gap6: { gap: spacing[6] },
});

// ============================================================================
// BORDER RADIUS UTILITIES
// ============================================================================

export const radiusStyles = StyleSheet.create({
  rounded2xl: { borderRadius: borderRadius['2xl'] },
  roundedFull: { borderRadius: borderRadius.full },
  roundedLg: { borderRadius: borderRadius.lg },
  roundedMd: { borderRadius: borderRadius.md },
  roundedNone: { borderRadius: borderRadius.none },
  roundedSm: { borderRadius: borderRadius.sm },
  roundedXl: { borderRadius: borderRadius.xl },
});

// ============================================================================
// SHADOW UTILITIES
// ============================================================================

export const shadowStyles = StyleSheet.create({
  shadow2xl: shadows['2xl'],
  shadowDefault: shadows.default,
  shadowLg: shadows.lg,
  shadowMd: shadows.md,
  shadowNone: shadows.none,
  shadowSm: shadows.sm,
  shadowXl: shadows.xl,
});

// ============================================================================
// TYPOGRAPHY PRESETS
// ============================================================================

export const typographyStyles = StyleSheet.create({
  textDisplay: textStyles.display as TextStyle,
  textH1: textStyles.h1 as TextStyle,
  textH2: textStyles.h2 as TextStyle,
  textH3: textStyles.h3 as TextStyle,
  textBodyLg: textStyles.bodyLg as TextStyle,
  textBody: textStyles.body as TextStyle,
  textBodySm: textStyles.bodySm as TextStyle,
  textCaption: textStyles.caption as TextStyle,
  textTiny: textStyles.tiny as TextStyle,

  // Weight modifiers
  fontRegular: { fontWeight: typography.fontWeight.regular },
  fontMedium: { fontWeight: typography.fontWeight.medium },
  fontSemibold: { fontWeight: typography.fontWeight.semibold },
  fontBold: { fontWeight: typography.fontWeight.bold },

  // Text alignment
  textLeft: { textAlign: 'left' },
  textCenter: { textAlign: 'center' },
  textRight: { textAlign: 'right' },

  // Text transforms
  uppercase: { textTransform: 'uppercase' },
  lowercase: { textTransform: 'lowercase' },
  capitalize: { textTransform: 'capitalize' },
});

// ============================================================================
// COMPONENT STYLE FACTORIES
// ============================================================================

/**
 * Creates card style with theme colors
 */
export function createCardStyle(backgroundColor: string, borderColor?: string): ViewStyle {
  return {
    backgroundColor,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    ...(borderColor && { borderWidth: 1, borderColor }),
    ...shadows.default,
  };
}

/**
 * Creates input container style with theme colors
 */
export function createInputContainerStyle(
  backgroundColor: string,
  borderColor: string,
  focusedBorderColor: string,
  isFocused: boolean
): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor,
    borderWidth: 1,
    borderColor: isFocused ? focusedBorderColor : borderColor,
    borderRadius: borderRadius.lg,
    minHeight: theme.dimensions.input.md,
  };
}

/**
 * Creates button style based on variant and theme colors
 */
export function createButtonStyle(
  variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive',
  size: 'sm' | 'md' | 'lg',
  colors: {
    primary: string;
    secondary: string;
    destructive: string;
    background: string;
    text: string;
    border: string;
  },
  disabled: boolean = false
): { container: ViewStyle; text: TextStyle } {
  const heights = {
    sm: theme.dimensions.button.sm,
    md: theme.dimensions.button.md,
    lg: theme.dimensions.button.lg,
  };

  const paddingHorizontal = {
    sm: spacing[3],
    md: spacing[4],
    lg: spacing[8],
  };

  const fontSize = {
    sm: typography.fontSize.bodySm,
    md: typography.fontSize.body,
    lg: typography.fontSize.body,
  };

  const baseContainer: ViewStyle = {
    height: heights[size],
    paddingHorizontal: paddingHorizontal[size],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.5 : 1,
  };

  const baseText: TextStyle = {
    fontSize: fontSize[size],
    fontWeight: typography.fontWeight.semibold,
  };

  switch (variant) {
    case 'primary':
      return {
        container: { ...baseContainer, backgroundColor: colors.primary },
        text: { ...baseText, color: '#FFFFFF' },
      };
    case 'secondary':
      return {
        container: { ...baseContainer, backgroundColor: colors.secondary },
        text: { ...baseText, color: colors.text },
      };
    case 'outline':
      return {
        container: {
          ...baseContainer,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.primary,
        },
        text: { ...baseText, color: colors.primary },
      };
    case 'ghost':
      return {
        container: { ...baseContainer, backgroundColor: 'transparent' },
        text: { ...baseText, color: colors.primary },
      };
    case 'destructive':
      return {
        container: { ...baseContainer, backgroundColor: colors.destructive },
        text: { ...baseText, color: '#FFFFFF' },
      };
    default:
      return {
        container: { ...baseContainer, backgroundColor: colors.primary },
        text: { ...baseText, color: '#FFFFFF' },
      };
  }
}

/**
 * Creates avatar style based on size
 */
export function createAvatarStyle(size: number): ViewStyle {
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden',
  };
}

/**
 * Creates status indicator style
 */
export function createStatusIndicatorStyle(
  size: number,
  color: string,
  borderColor: string
): ViewStyle {
  return {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    borderWidth: size * 0.15,
    borderColor,
  };
}

/**
 * Creates message bubble style
 */
export function createMessageBubbleStyle(
  isOwn: boolean,
  backgroundColor: string,
  maxWidth: number = theme.dimensions.messageBubble.maxWidth
): ViewStyle {
  return {
    maxWidth,
    padding: spacing[3],
    borderRadius: borderRadius.xl,
    backgroundColor,
    alignSelf: isOwn ? 'flex-end' : 'flex-start',
    ...(isOwn
      ? { borderBottomRightRadius: borderRadius.sm }
      : { borderBottomLeftRadius: borderRadius.sm }),
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Combines multiple styles into one
 */
export function combineStyles<T extends ViewStyle | TextStyle>(
  ...styles: (T | undefined | null | false)[]
): T {
  return StyleSheet.flatten(styles.filter(Boolean)) as T;
}

/**
 * Creates styles with theme colors (helper for createStyles pattern)
 */
export function withThemeColors<T extends StyleSheet.NamedStyles<T>>(
  styleCreator: (colors: any) => T,
  colors: any
): T {
  return StyleSheet.create(styleCreator(colors));
}

/**
 * Converts hex color to rgba
 */
export function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return hex;
  }
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================================
// PLATFORM-SPECIFIC UTILITIES
// ============================================================================

export const platformStyles = {
  // iOS-specific shadow
  iosShadow: (opacity: number = 0.1, radius: number = 4, offsetY: number = 2) =>
    Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: offsetY },
        shadowOpacity: opacity,
        shadowRadius: radius,
      },
      android: {},
    }),

  // Android-specific elevation
  androidElevation: (elevation: number) =>
    Platform.select({
      android: { elevation },
      ios: {},
    }),

  // Cross-platform shadow
  crossPlatformShadow: (
    elevation: number,
    opacity: number = 0.1,
    radius: number = 4,
    offsetY: number = 2
  ) => ({
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: offsetY },
        shadowOpacity: opacity,
        shadowRadius: radius,
      },
      android: { elevation },
    }),
  }),
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  layoutStyles,
  spacingStyles,
  radiusStyles,
  shadowStyles,
  typographyStyles,
  createCardStyle,
  createInputContainerStyle,
  createButtonStyle,
  createAvatarStyle,
  createStatusIndicatorStyle,
  createMessageBubbleStyle,
  combineStyles,
  withThemeColors,
  hexToRgba,
  platformStyles,
};
