import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors } from '../../constants';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
}: ButtonProps) {
  const buttonStyles = [
    styles.button,
    styles[variant],
    styles[size],
    disabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    disabled && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.white : colors.primary}
          size="small"
        />
      ) : (
        <Text style={textStyles}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
  },
  disabled: {
    backgroundColor: colors.gray[300],
  },
  disabledText: {
    color: colors.gray[500],
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: colors.primary,
  },
  large: {
    paddingHorizontal: 32,
    paddingVertical: 18,
  },
  largeText: {
    fontSize: 18,
  },
  medium: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: colors.primary,
    borderWidth: 1,
  },
  outlineText: {
    color: colors.primary,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryText: {
    color: colors.white,
  },
  secondary: {
    backgroundColor: colors.gray[200],
  },
  secondaryText: {
    color: colors.text,
  },
  small: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  smallText: {
    fontSize: 14,
  },
  text: {
    fontWeight: '600',
  },
});

export default Button;
