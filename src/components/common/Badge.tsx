/**
 * Badge Component
 *
 * A versatile badge component for displaying status, counts, or labels.
 *
 * Usage:
 * <Badge>New</Badge>
 * <Badge variant="destructive">3</Badge>
 * <Badge variant="outline" size="sm">Status</Badge>
 * <Badge.Dot color="green" /> // Status dot
 * <Badge.Count count={99} max={99} />
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../hooks';
import { spacing, borderRadius, typography } from '../../constants/theme';

// Badge variants
export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning';

// Badge sizes
export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

interface BadgeDotProps {
  color?: string;
  size?: number;
  pulse?: boolean;
  style?: ViewStyle;
}

interface BadgeCountProps {
  count: number;
  max?: number;
  variant?: BadgeVariant;
  size?: BadgeSize;
  showZero?: boolean;
  style?: ViewStyle;
}

// Main Badge Component
const BadgeBase: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  style,
  textStyle,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const containerStyle = [styles.badge, styles[`badge_${size}`], styles[`badge_${variant}`], style];

  const labelStyle = [styles.text, styles[`text_${size}`], styles[`text_${variant}`], textStyle];

  return (
    <View style={containerStyle}>
      <Text style={labelStyle}>{children}</Text>
    </View>
  );
};

// Badge Dot Component (for status indicators)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const BadgeDot: React.FC<BadgeDotProps> = ({ color, size = 8, pulse: _pulse = false, style }) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color || colors.primary,
        },
        style,
      ]}
    />
  );
};

// Badge Count Component (for notification counts)
const BadgeCount: React.FC<BadgeCountProps> = ({
  count,
  max = 99,
  variant = 'destructive',
  size = 'sm',
  showZero = false,
  style,
}) => {
  if (count === 0 && !showZero) {
    return null;
  }

  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <BadgeBase variant={variant} size={size} style={style}>
      {displayCount}
    </BadgeBase>
  );
};

// Compound component pattern
export const Badge = Object.assign(BadgeBase, {
  Dot: BadgeDot,
  Count: BadgeCount,
});

// Styles
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    // Base badge style
    badge: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: borderRadius.full,
      justifyContent: 'center',
    },

    // Size variants
    badge_sm: {
      minHeight: 18,
      minWidth: 18,
      paddingHorizontal: spacing[1.5],
      paddingVertical: spacing[0.5],
    },
    badge_md: {
      minHeight: 22,
      minWidth: 22,
      paddingHorizontal: spacing[2.5],
      paddingVertical: spacing[0.5],
    },
    badge_lg: {
      minHeight: 28,
      minWidth: 28,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1],
    },

    // Variant backgrounds
    badge_default: {
      backgroundColor: colors.primary,
    },
    badge_secondary: {
      backgroundColor: colors.gray[200],
    },
    badge_destructive: {
      backgroundColor: colors.error,
    },
    badge_outline: {
      backgroundColor: 'transparent',
      borderColor: colors.border,
      borderWidth: 1,
    },
    badge_success: {
      backgroundColor: colors.success,
    },
    badge_warning: {
      backgroundColor: colors.warning,
    },

    // Base text style
    text: {
      fontWeight: typography.fontWeight.semibold,
      textAlign: 'center',
    },

    // Text sizes
    text_sm: {
      fontSize: typography.fontSize.tiny,
    },
    text_md: {
      fontSize: typography.fontSize.caption,
    },
    text_lg: {
      fontSize: typography.fontSize.bodySm,
    },

    // Text colors per variant
    text_default: {
      color: colors.white,
    },
    text_secondary: {
      color: colors.text,
    },
    text_destructive: {
      color: colors.white,
    },
    text_outline: {
      color: colors.text,
    },
    text_success: {
      color: colors.white,
    },
    text_warning: {
      color: colors.white,
    },
  });

export default Badge;
