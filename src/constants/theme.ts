/**
 * PeopleConnect Mobile - Design System Theme Tokens
 * Based on UI_UX_SPECIFICATION.md
 *
 * This file defines all design tokens used throughout the application:
 * - Typography scale
 * - Spacing system
 * - Border radius
 * - Shadows
 * - Icon sizes
 * - Component dimensions
 * - Animation timings
 */

import { Platform, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// TYPOGRAPHY SCALE
// ============================================================================

export const typography = {
  // Font families
  fontFamily: {
    primary: Platform.select({
      ios: 'System',
      android: 'Roboto',
      default: 'System',
    }),
    monospace: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },

  // Font sizes following the specification
  fontSize: {
    display: 36,
    h1: 30,
    h2: 24,
    h3: 20,
    bodyLg: 18,
    body: 16,
    bodySm: 14,
    caption: 12,
    tiny: 10,
  },

  // Font weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Line heights
  lineHeight: {
    display: 1.1,
    h1: 1.2,
    h2: 1.25,
    h3: 1.3,
    bodyLg: 1.5,
    body: 1.5,
    bodySm: 1.4,
    caption: 1.3,
    tiny: 1.2,
  },
};

// Pre-computed typography styles
export const textStyles = {
  display: {
    fontSize: typography.fontSize.display,
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.fontSize.display * typography.lineHeight.display,
  },
  h1: {
    fontSize: typography.fontSize.h1,
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.fontSize.h1 * typography.lineHeight.h1,
  },
  h2: {
    fontSize: typography.fontSize.h2,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.fontSize.h2 * typography.lineHeight.h2,
  },
  h3: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.fontSize.h3 * typography.lineHeight.h3,
  },
  bodyLg: {
    fontSize: typography.fontSize.bodyLg,
    fontWeight: typography.fontWeight.regular,
    lineHeight: typography.fontSize.bodyLg * typography.lineHeight.bodyLg,
  },
  body: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.regular,
    lineHeight: typography.fontSize.body * typography.lineHeight.body,
  },
  bodySm: {
    fontSize: typography.fontSize.bodySm,
    fontWeight: typography.fontWeight.regular,
    lineHeight: typography.fontSize.bodySm * typography.lineHeight.bodySm,
  },
  caption: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.regular,
    lineHeight: typography.fontSize.caption * typography.lineHeight.caption,
  },
  tiny: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.medium,
    lineHeight: typography.fontSize.tiny * typography.lineHeight.tiny,
  },
};

// ============================================================================
// SPACING SYSTEM
// ============================================================================

export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// Named spacing aliases for common use cases
export const layout = {
  screenPaddingHorizontal: spacing[4],
  screenPaddingVertical: spacing[4],
  cardPadding: spacing[4],
  sectionSpacing: spacing[6],
  itemSpacing: spacing[3],
  tightSpacing: spacing[2],
  microSpacing: spacing[1],
};

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
} as const;

// Component-specific border radius
export const componentRadius = {
  button: borderRadius.lg,
  input: borderRadius.lg,
  card: borderRadius.xl,
  modal: borderRadius['2xl'],
  avatar: borderRadius.full,
  badge: borderRadius.full,
  chip: borderRadius.full,
  messageBubble: borderRadius.xl,
};

// ============================================================================
// SHADOWS
// ============================================================================

export const shadows = {
  none: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 12,
  },
  '2xl': {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.25,
    shadowRadius: 50,
    elevation: 16,
  },
};

// ============================================================================
// ICON SIZES
// ============================================================================

export const iconSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

// ============================================================================
// COMPONENT DIMENSIONS
// ============================================================================

export const dimensions = {
  // Button heights
  button: {
    sm: 32,
    md: 36,
    lg: 40,
    xl: 48,
  },

  // Input heights
  input: {
    sm: 36,
    md: 44,
    lg: 52,
  },

  // Avatar sizes
  avatar: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
    '2xl': 128,
  },

  // Touch target (minimum accessible size)
  touchTarget: {
    minimum: 44,
    recommended: 48,
  },

  // List item heights
  listItem: {
    compact: 48,
    default: 56,
    large: 72,
  },

  // Tab bar
  tabBar: {
    height: 56,
    iconSize: 24,
  },

  // Header
  header: {
    height: 56,
    largeHeight: 96,
  },

  // Bottom sheet
  bottomSheet: {
    handleHeight: 24,
    handleWidth: 40,
    handleThickness: 4,
  },

  // Message bubble
  messageBubble: {
    maxWidth: SCREEN_WIDTH * 0.75,
    minHeight: 36,
    avatarSize: 32,
  },

  // Status indicator
  statusIndicator: {
    sm: 8,
    md: 12,
    lg: 16,
  },
};

// ============================================================================
// ANIMATION TIMINGS
// ============================================================================

export const animation = {
  // Duration in milliseconds
  duration: {
    instant: 0,
    fast: 100,
    normal: 200,
    slow: 300,
    verySlow: 500,
  },

  // Screen transitions
  screenTransition: {
    push: 300,
    pop: 250,
    modal: 300,
    fade: 150,
  },

  // List animations
  list: {
    itemDuration: 200,
    stagger: 50,
    maxAnimatedItems: 10,
  },

  // Micro-interactions
  micro: {
    buttonPress: 100,
    switchToggle: 200,
    checkbox: 150,
    inputFocus: 150,
  },

  // Message animations
  message: {
    send: 150,
    receive: 200,
    reactionPop: 300,
  },

  // Loading animations
  loading: {
    spinner: 1000,
    skeleton: 1500,
    typingDots: 1400,
  },
};

// Easing presets (using react-native-reanimated compatible format)
export const easing = {
  linear: 'linear',
  easeIn: 'easeIn',
  easeOut: 'easeOut',
  easeInOut: 'easeInOut',
};

// ============================================================================
// STATUS COLORS
// ============================================================================

export const statusColors = {
  online: '#22C55E',
  away: '#F59E0B',
  busy: '#EF4444',
  offline: '#9CA3AF',
};

// ============================================================================
// Z-INDEX LEVELS
// ============================================================================

export const zIndex = {
  base: 0,
  card: 10,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  popover: 500,
  toast: 600,
  tooltip: 700,
};

// ============================================================================
// BREAKPOINTS
// ============================================================================

export const breakpoints = {
  phone: 0,
  tablet: 768,
  desktop: 1024,
} as const;

export const isTablet = SCREEN_WIDTH >= breakpoints.tablet;

// ============================================================================
// ACCESSIBILITY
// ============================================================================

export const accessibility = {
  // Minimum touch target sizes (WCAG)
  minTouchTarget: 44,
  recommendedTouchTarget: 48,

  // Minimum contrast ratios
  contrastRatio: {
    bodyText: 4.5,
    largeText: 3,
    icons: 3,
  },

  // Focus indicator
  focusRing: {
    width: 2,
    offset: 2,
  },
};

// ============================================================================
// EXPORT COMPLETE THEME OBJECT
// ============================================================================

export const theme = {
  typography,
  textStyles,
  spacing,
  layout,
  borderRadius,
  componentRadius,
  shadows,
  iconSizes,
  dimensions,
  animation,
  easing,
  statusColors,
  zIndex,
  breakpoints,
  isTablet,
  accessibility,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
};

export default theme;
