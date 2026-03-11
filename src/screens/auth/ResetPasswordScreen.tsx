import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { AuthStackParamList } from '../../navigation/types';
// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
const getAuth = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.auth;
};
const auth = { resetPassword: (data: { token: string; newPassword: string }) => getAuth().resetPassword(data) };
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { useTheme } from '../../hooks';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
}

export const ResetPasswordScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = route.params?.token;

  // Password validation
  const validation: PasswordValidation = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };

  const isPasswordValid = Object.values(validation).every(Boolean);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  // Check for token on mount
  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset link. Please request a new password reset.');
    }
  }, [token]);

  const handleResetPassword = async () => {
    if (!token) {
      Alert.alert('Error', 'Invalid reset link');
      return;
    }

    if (!isPasswordValid) {
      Alert.alert('Error', 'Please ensure your password meets all requirements');
      return;
    }

    if (!passwordsMatch) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await auth.resetPassword({ token, newPassword: password });
      setIsSuccess(true);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err.message ||
        'Failed to reset password. The link may have expired.';
      setError(message);
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Resetting password..." />;
  }

  // Success state
  if (isSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.centerContainer}>
            <View style={styles.successIconContainer}>
              <Icon name="checkmark-circle" size={80} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>Password Reset!</Text>
            <Text style={styles.successText}>
              Your password has been successfully reset. You can now sign in with your new password.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.primaryButtonText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Invalid token state
  if (error && !token) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.centerContainer}>
            <View style={styles.errorIconContainer}>
              <Icon name="alert-circle" size={80} color={colors.error} />
            </View>
            <Text style={styles.errorTitle}>Invalid Link</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.primaryButtonText}>Request New Link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.secondaryButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Reset password form
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.backNav} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={colors.primary} />
            <Text style={styles.backNavText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon name="lock-closed" size={48} color={colors.primary} />
            </View>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>Enter your new password below.</Text>
          </View>

          <View style={styles.form}>
            {/* New Password Input */}
            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter new password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Icon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Confirm Password Input */}
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Icon
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Password match indicator */}
            {confirmPassword.length > 0 && (
              <View style={styles.matchIndicator}>
                <Icon
                  name={passwordsMatch ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={passwordsMatch ? colors.success : colors.error}
                />
                <Text style={[styles.matchText, { color: passwordsMatch ? colors.success : colors.error }]}>
                  {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                </Text>
              </View>
            )}

            {/* Password Requirements */}
            <View style={styles.requirementsContainer}>
              <Text style={styles.requirementsTitle}>Password requirements:</Text>
              <View style={styles.requirementRow}>
                <Icon
                  name={validation.minLength ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={validation.minLength ? colors.success : colors.textSecondary}
                />
                <Text
                  style={[styles.requirementText, validation.minLength && styles.requirementMet]}
                >
                  At least 8 characters
                </Text>
              </View>
              <View style={styles.requirementRow}>
                <Icon
                  name={validation.hasUppercase ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={validation.hasUppercase ? colors.success : colors.textSecondary}
                />
                <Text
                  style={[styles.requirementText, validation.hasUppercase && styles.requirementMet]}
                >
                  One uppercase letter
                </Text>
              </View>
              <View style={styles.requirementRow}>
                <Icon
                  name={validation.hasLowercase ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={validation.hasLowercase ? colors.success : colors.textSecondary}
                />
                <Text
                  style={[styles.requirementText, validation.hasLowercase && styles.requirementMet]}
                >
                  One lowercase letter
                </Text>
              </View>
              <View style={styles.requirementRow}>
                <Icon
                  name={validation.hasNumber ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={validation.hasNumber ? colors.success : colors.textSecondary}
                />
                <Text
                  style={[styles.requirementText, validation.hasNumber && styles.requirementMet]}
                >
                  One number
                </Text>
              </View>
            </View>

            {/* Error message */}
            {error && (
              <View style={styles.errorContainer}>
                <Icon name="alert-circle" size={16} color={colors.error} />
                <Text style={styles.errorMessage}>{error}</Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!isPasswordValid || !passwordsMatch) && styles.submitButtonDisabled,
              ]}
              onPress={handleResetPassword}
              disabled={!isPasswordValid || !passwordsMatch}
            >
              <Text style={styles.submitButtonText}>Reset Password</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) =>
  StyleSheet.create({
    backNav: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 24,
    },
    backNavText: {
      color: colors.primary,
      fontSize: 16,
      marginLeft: 4,
    },
    centerContainer: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    container: {
      backgroundColor: colors.background,
      flex: 1,
    },
    content: {
      flex: 1,
    },
    errorContainer: {
      alignItems: 'center',
      backgroundColor: colors.error + '15',
      borderRadius: 8,
      flexDirection: 'row',
      marginBottom: 16,
      padding: 12,
    },
    errorIconContainer: {
      marginBottom: 24,
    },
    errorMessage: {
      color: colors.error,
      flex: 1,
      fontSize: 14,
      marginLeft: 8,
    },
    errorText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 32,
      textAlign: 'center',
    },
    errorTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 12,
    },
    eyeButton: {
      padding: 16,
    },
    form: {
      flex: 1,
    },
    header: {
      alignItems: 'center',
      marginBottom: 32,
    },
    iconContainer: {
      alignItems: 'center',
      backgroundColor: colors.primary + '15',
      borderRadius: 40,
      height: 80,
      justifyContent: 'center',
      marginBottom: 16,
      width: 80,
    },
    input: {
      color: colors.text,
      flex: 1,
      fontSize: 16,
      padding: 16,
    },
    inputContainer: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: 16,
    },
    label: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
    },
    matchIndicator: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 16,
    },
    matchText: {
      fontSize: 12,
      marginLeft: 6,
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      marginBottom: 16,
      paddingHorizontal: 48,
      paddingVertical: 16,
      width: '100%',
    },
    primaryButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    requirementMet: {
      color: colors.success,
    },
    requirementRow: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 8,
    },
    requirementText: {
      color: colors.textSecondary,
      fontSize: 13,
      marginLeft: 8,
    },
    requirementsContainer: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginBottom: 24,
      padding: 16,
    },
    requirementsTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 12,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 24,
    },
    secondaryButton: {
      alignItems: 'center',
      borderRadius: 12,
      paddingHorizontal: 48,
      paddingVertical: 16,
      width: '100%',
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    submitButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: 'center',
    },
    successIconContainer: {
      marginBottom: 24,
    },
    successText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 32,
      textAlign: 'center',
    },
    successTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 12,
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 8,
    },
  });

export default ResetPasswordScreen;
