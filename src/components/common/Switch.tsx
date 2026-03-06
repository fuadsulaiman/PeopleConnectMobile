/**
 * Switch Component
 *
 * A customizable toggle switch component with smooth animations.
 *
 * Usage:
 * <Switch value={isEnabled} onValueChange={setIsEnabled} />
 * <Switch value={isEnabled} onValueChange={setIsEnabled} disabled />
 * <Switch value={isEnabled} onValueChange={setIsEnabled} size="lg" />
 */

import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  ViewStyle,
  AccessibilityProps,
} from 'react-native';
import { useTheme } from '../../hooks';
import { animation, borderRadius } from '../../constants/theme';

export type SwitchSize = 'sm' | 'md' | 'lg';

interface SwitchProps extends AccessibilityProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  size?: SwitchSize;
  activeColor?: string;
  inactiveColor?: string;
  thumbColor?: string;
  style?: ViewStyle;
}

// Size configurations
const sizeConfig = {
  sm: {
    width: 36,
    height: 20,
    thumbSize: 16,
    thumbPadding: 2,
  },
  md: {
    width: 44,
    height: 24,
    thumbSize: 20,
    thumbPadding: 2,
  },
  lg: {
    width: 52,
    height: 28,
    thumbSize: 24,
    thumbPadding: 2,
  },
};

export const Switch: React.FC<SwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  size = 'md',
  activeColor,
  inactiveColor,
  thumbColor,
  style,
  accessibilityLabel,
  ...accessibilityProps
}) => {
  const { colors } = useTheme();
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;

  const config = sizeConfig[size];
  const trackWidth = config.width;
  const trackHeight = config.height;
  const thumbSize = config.thumbSize;
  const thumbPadding = config.thumbPadding;
  const thumbTravel = trackWidth - thumbSize - thumbPadding * 2;

  // Default colors
  const trackActiveColor = activeColor || colors.primary;
  const trackInactiveColor = inactiveColor || colors.gray[300];
  const thumbBaseColor = thumbColor || colors.white;

  const styles = useMemo(() => createStyles(colors, config), [colors, config]);

  // Animate on value change
  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value ? 1 : 0,
      duration: animation.micro.switchToggle,
      useNativeDriver: false,
    }).start();
  }, [value, animatedValue]);

  const handlePress = () => {
    if (disabled) {
      return;
    }

    // Scale animation on press
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 0.95,
        duration: animation.duration.fast,
        useNativeDriver: true,
      }),
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: animation.duration.fast,
        useNativeDriver: true,
      }),
    ]).start();

    onValueChange(!value);
  };

  // Interpolated values
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [thumbPadding, thumbTravel + thumbPadding],
  });

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [trackInactiveColor, trackActiveColor],
  });

  return (
    <TouchableWithoutFeedback
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel || (value ? 'On' : 'Off')}
      {...accessibilityProps}
    >
      <Animated.View
        style={[
          styles.track,
          { width: trackWidth, height: trackHeight },
          { backgroundColor },
          disabled && styles.trackDisabled,
          { transform: [{ scale: scaleValue }] },
          style,
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              backgroundColor: thumbBaseColor,
              transform: [{ translateX }],
            },
            disabled && styles.thumbDisabled,
          ]}
        />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

// Labelled Switch Component for settings screens
interface LabelledSwitchProps extends SwitchProps {
  label: string;
  description?: string;
}

export const LabelledSwitch: React.FC<LabelledSwitchProps> = ({
  label,
  description,
  value,
  onValueChange,
  disabled,
  ...props
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createLabelledStyles(colors), [colors]);

  return (
    <TouchableWithoutFeedback
      onPress={() => !disabled && onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
    >
      <View style={[styles.container, disabled && styles.containerDisabled]}>
        <View style={styles.textContainer}>
          <View style={styles.labelRow}>
            <View style={styles.labelContainer}>
              <Animated.Text style={[styles.label, disabled && styles.labelDisabled]}>
                {label}
              </Animated.Text>
            </View>
            <Switch value={value} onValueChange={onValueChange} disabled={disabled} {...props} />
          </View>
          {description && (
            <Animated.Text style={[styles.description, disabled && styles.descriptionDisabled]}>
              {description}
            </Animated.Text>
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const createStyles = (
  colors: ReturnType<typeof useTheme>['colors'],
  _config: typeof sizeConfig.md
) =>
  StyleSheet.create({
    thumb: {
      borderRadius: borderRadius.full,
      elevation: 2,
      position: 'absolute',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
    },
    thumbDisabled: {
      backgroundColor: colors.gray[100],
    },
    track: {
      borderRadius: borderRadius.full,
      justifyContent: 'center',
    },
    trackDisabled: {
      opacity: 0.5,
    },
  });

const createLabelledStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    containerDisabled: {
      opacity: 0.6,
    },
    description: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 4,
      paddingRight: 60, // Space for switch
    },
    descriptionDisabled: {
      color: colors.textTertiary,
    },
    label: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '500',
    },
    labelContainer: {
      flex: 1,
      marginRight: 16,
    },
    labelDisabled: {
      color: colors.textTertiary,
    },
    labelRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    textContainer: {
      flex: 1,
    },
  });

export default Switch;
