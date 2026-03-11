import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { AuthStackParamList } from '../../navigation/types';
// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
const getAuth = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.auth;
};
const auth = { verifyEmail: (token: string) => getAuth().verifyEmail(token), resendVerification: (email: string) => getAuth().resendVerification(email) };
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { useTheme } from '../../hooks';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

type VerificationStatus = 'verifying' | 'success' | 'error' | 'no-token';

export const VerifyEmailScreen: React.FC<Props> = ({ navigation, route }) => {
  const [status, setStatus] = useState<VerificationStatus>('verifying');
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const token = route.params?.token;
  const email = route.params?.email;

  useEffect(() => {
    if (!token) {
      setStatus('no-token');
      return;
    }

    // Verify email with backend
    const verifyEmail = async () => {
      try {
        await auth.verifyEmail(token);
        setStatus('success');
        // Show success for 3 seconds then navigate to login
        setTimeout(() => {
          navigation.navigate('Login');
        }, 3000);
      } catch (err: any) {
        const message =
          err?.response?.data?.message ||
          err.message ||
          'Email verification failed. The link may have expired.';
        setError(message);
        setStatus('error');
      }
    };

    verifyEmail();
  }, [token, navigation]);

  const handleResendVerification = async () => {
    if (!email) {
      Alert.alert('Error', 'Email address is required to resend verification.');
      return;
    }

    setIsResending(true);
    setResendSuccess(false);

    try {
      await auth.resendVerification(email);
      setResendSuccess(true);
      Alert.alert('Success', 'Verification email sent successfully! Please check your inbox.');
    } catch (err: any) {
      const message =
        err?.response?.data?.message || err.message || 'Failed to resend verification email.';
      setError(message);
      Alert.alert('Error', message);
    } finally {
      setIsResending(false);
    }
  };

  // Verifying state
  if (status === 'verifying') {
    return <LoadingScreen message="Verifying your email..." />;
  }

  // Success state
  if (status === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.centerContainer}>
            <View style={styles.successIconContainer}>
              <Icon name="checkmark-circle" size={96} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>Email Verified!</Text>
            <Text style={styles.successText}>
              Your email has been successfully verified. You can now sign in to your account.
            </Text>
            <Text style={styles.redirectText}>Redirecting to login in 3 seconds...</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.primaryButtonText}>Continue to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // No token state (for resend verification)
  if (status === 'no-token') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.centerContainer}>
            <View style={styles.mailIconContainer}>
              <Icon name="mail" size={96} color={colors.primary} />
            </View>
            <Text style={styles.title}>Verify Your Email</Text>
            <Text style={styles.subtitle}>
              {email
                ? `We sent a verification link to ${email}. Please check your inbox.`
                : 'Please check your email for the verification link.'}
            </Text>

            {/* Tips Box */}
            <View style={styles.tipsContainer}>
              <Text style={styles.tipsTitle}>Did not receive the email?</Text>
              <View style={styles.tipRow}>
                <Icon name="ellipse" size={6} color={colors.info} style={styles.tipBullet} />
                <Text style={styles.tipText}>Check your spam or junk folder</Text>
              </View>
              <View style={styles.tipRow}>
                <Icon name="ellipse" size={6} color={colors.info} style={styles.tipBullet} />
                <Text style={styles.tipText}>Make sure you entered the correct email</Text>
              </View>
              <View style={styles.tipRow}>
                <Icon name="ellipse" size={6} color={colors.info} style={styles.tipBullet} />
                <Text style={styles.tipText}>Wait a few minutes for delivery</Text>
              </View>
            </View>

            {/* Resend Success Message */}
            {resendSuccess && (
              <View style={styles.successMessageContainer}>
                <Icon name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.successMessage}>Verification email sent successfully!</Text>
              </View>
            )}

            {/* Resend Button */}
            {email && (
              <TouchableOpacity
                style={[
                  styles.outlineButton,
                  (isResending || resendSuccess) && styles.buttonDisabled,
                ]}
                onPress={handleResendVerification}
                disabled={isResending || resendSuccess}
              >
                {isResending ? (
                  <Text style={styles.outlineButtonText}>Sending...</Text>
                ) : (
                  <Text style={styles.outlineButtonText}>
                    {resendSuccess ? 'Email Sent!' : 'Resend Verification Email'}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.ghostButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.ghostButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.centerContainer}>
          <View style={styles.errorIconContainer}>
            <Icon name="alert-circle" size={96} color={colors.error} />
          </View>
          <Text style={styles.errorTitle}>Verification Failed</Text>
          <Text style={styles.errorText}>
            {error || 'This verification link is invalid or has expired.'}
          </Text>

          {/* Resend Success Message */}
          {resendSuccess && (
            <View style={styles.successMessageContainer}>
              <Icon name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.successMessage}>
                Verification email sent successfully! Please check your inbox.
              </Text>
            </View>
          )}

          {/* Resend Button */}
          {email && !resendSuccess && (
            <TouchableOpacity
              style={[styles.outlineButton, isResending && styles.buttonDisabled]}
              onPress={handleResendVerification}
              disabled={isResending}
            >
              <Text style={styles.outlineButtonText}>
                {isResending ? 'Sending...' : 'Resend Verification Email'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.primaryButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flex: 1,
  },
  centerContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  // Mail icon container
  mailIconContainer: {
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    borderRadius: 60,
    height: 120,
    justifyContent: 'center',
    marginBottom: 24,
    width: 120,
  },
  // Success state
  successIconContainer: {
    marginBottom: 24,
  },
  successTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  successText: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  redirectText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 24,
  },
  // Error state
  errorIconContainer: {
    marginBottom: 24,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  // No token state
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  // Tips container
  tipsContainer: {
    backgroundColor: colors.info + '15',
    borderColor: colors.info + '40',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    padding: 16,
    width: '100%',
  },
  tipsTitle: {
    color: colors.info,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  tipRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8,
  },
  tipBullet: {
    marginRight: 8,
  },
  tipText: {
    color: colors.info,
    flex: 1,
    fontSize: 14,
  },
  // Success message
  successMessageContainer: {
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    borderColor: colors.success + '40',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 16,
    padding: 12,
    width: '100%',
  },
  successMessage: {
    color: colors.success,
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
  },
  // Buttons
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
  outlineButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 48,
    paddingVertical: 16,
    width: '100%',
  },
  outlineButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  ghostButton: {
    alignItems: 'center',
    paddingHorizontal: 48,
    paddingVertical: 16,
    width: '100%',
  },
  ghostButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default VerifyEmailScreen;
