/**
 * Skeleton Component - Loading placeholder with shimmer animation
 *
 * Usage:
 * <Skeleton width={100} height={20} />
 * <Skeleton width="100%" height={40} borderRadius={8} />
 * <Skeleton.Circle size={48} /> // For circular skeletons (avatars)
 * <Skeleton.Text lines={3} /> // For multi-line text placeholders
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, ViewStyle, DimensionValue } from 'react-native';
import { useTheme } from '../../hooks';
import { borderRadius as themeRadius, animation, spacing } from '../../constants/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
  animated?: boolean;
}

interface SkeletonCircleProps {
  size?: number;
  style?: ViewStyle;
  animated?: boolean;
}

interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  lastLineWidth?: DimensionValue;
  spacing?: number;
  style?: ViewStyle;
  animated?: boolean;
}

const SkeletonBase: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = themeRadius.md,
  style,
  animated = true,
}) => {
  const { colors } = useTheme();
  const shimmerValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) {
      return;
    }

    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: animation.loading.skeleton,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: animation.loading.skeleton,
          useNativeDriver: true,
        }),
      ])
    );

    shimmerAnimation.start();

    return () => shimmerAnimation.stop();
  }, [animated, shimmerValue]);

  const opacity = animated
    ? shimmerValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
      })
    : 0.5;

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

const SkeletonCircle: React.FC<SkeletonCircleProps> = ({ size = 48, style, animated = true }) => {
  return (
    <SkeletonBase
      width={size}
      height={size}
      borderRadius={size / 2}
      style={style}
      animated={animated}
    />
  );
};

const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  lineHeight = 14,
  lastLineWidth = '60%',
  spacing: lineSpacing = spacing[2],
  style,
  animated = true,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.textContainer, style]}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBase
          key={index}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          height={lineHeight}
          style={{ marginBottom: index < lines - 1 ? lineSpacing : 0 }}
          animated={animated}
        />
      ))}
    </View>
  );
};

// Compound component pattern
export const Skeleton = Object.assign(SkeletonBase, {
  Circle: SkeletonCircle,
  Text: SkeletonText,
});

// Pre-built skeleton presets for common use cases
export const SkeletonPresets = {
  // Conversation list item skeleton
  ConversationItem: () => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
      <View style={styles.conversationItem}>
        <Skeleton.Circle size={56} />
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Skeleton width="60%" height={16} />
            <Skeleton width={40} height={12} />
          </View>
          <Skeleton width="80%" height={14} style={{ marginTop: 8 }} />
        </View>
      </View>
    );
  },

  // Contact list item skeleton
  ContactItem: () => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
      <View style={styles.contactItem}>
        <Skeleton.Circle size={48} />
        <View style={styles.contactContent}>
          <Skeleton width="50%" height={16} />
          <Skeleton width="35%" height={12} style={{ marginTop: 4 }} />
        </View>
      </View>
    );
  },

  // Message skeleton
  Message: ({ isOwn = false }: { isOwn?: boolean }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
      <View style={[styles.messageContainer, isOwn ? styles.messageOwn : styles.messageOther]}>
        {!isOwn && <Skeleton.Circle size={32} style={{ marginRight: 8 }} />}
        <Skeleton width={200} height={60} borderRadius={themeRadius.xl} />
      </View>
    );
  },

  // Card skeleton
  Card: ({ height = 120 }: { height?: number }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
      <View style={styles.card}>
        <Skeleton width="100%" height={height} borderRadius={themeRadius.xl} />
      </View>
    );
  },

  // Profile header skeleton
  ProfileHeader: () => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
      <View style={styles.profileHeader}>
        <Skeleton.Circle size={80} />
        <Skeleton width="50%" height={20} style={{ marginTop: 16 }} />
        <Skeleton width="35%" height={14} style={{ marginTop: 8 }} />
      </View>
    );
  },
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    card: {
      marginBottom: 16,
      paddingHorizontal: 16,
    },
    contactContent: {
      flex: 1,
      marginLeft: 12,
    },
    contactItem: {
      alignItems: 'center',
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    conversationContent: {
      flex: 1,
      marginLeft: 12,
    },
    conversationHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    conversationItem: {
      alignItems: 'center',
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    messageContainer: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 4,
    },
    messageOther: {
      justifyContent: 'flex-start',
    },
    messageOwn: {
      justifyContent: 'flex-end',
    },
    profileHeader: {
      alignItems: 'center',
      paddingVertical: 24,
    },
    skeleton: {
      backgroundColor: colors.gray[300],
    },
    textContainer: {
      width: '100%',
    },
  });

export default Skeleton;
