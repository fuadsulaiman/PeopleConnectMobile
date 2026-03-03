import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { AuthStackParamList } from '../../navigation/types';
import { auth } from '../../services/sdk';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { colors } from '../../constants';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

type VerificationStatus = 'verifying' | 'success' | 'error' | 'no-token';

export const VerifyEmailScreen: React.FC<Props> = ({ navigation, route }) => {
  const [status, setStatus] = useState<VerificationStatus>('verifying');
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

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
        const message = err?.response?.data?.message || err.message || 'Email verification failed. The link may have expired.';
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
      const message = err?.response?.data?.message || err.message || 'Failed to resend verification email.';
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
              <Icon name="checkmark-circle" size={96} color="#22c55e" />
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
                <Icon name="ellipse" size={6} color="#3b82f6" style={styles.tipBullet} />
                <Text style={styles.tipText}>Check your spam or junk folder</Text>
              </View>
              <View style={styles.tipRow}>
                <Icon name="ellipse" size={6} color="#3b82f6" style={styles.tipBullet} />
                <Text style={styles.tipText}>Make sure you entered the correct email</Text>
              </View>
              <View style={styles.tipRow}>
                <Icon name="ellipse" size={6} color="#3b82f6" style={styles.tipBullet} />
                <Text style={styles.tipText}>Wait a few minutes for delivery</Text>
              </View>
            </View>

            {/* Resend Success Message */}
            {resendSuccess && (
              <View style={styles.successMessageContainer}>
                <Icon name="checkmark-circle" size={16} color="#22c55e" />
                <Text style={styles.successMessage}>Verification email sent successfully!</Text>
              </View>
            )}

            {/* Resend Button */}
            {email && (
              <TouchableOpacity
                style={[styles.outlineButton, (isResending || resendSuccess) && styles.buttonDisabled]}
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
            <Icon name="alert-circle" size={96} color="#ef4444" />
          </View>
          <Text style={styles.errorTitle}>Verification Failed</Text>
          <Text style={styles.errorText}>
            {error || 'This verification link is invalid or has expired.'}
          </Text>

          {/* Resend Success Message */}
          {resendSuccess && (
            <View style={styles.successMessageContainer}>
              <Icon name="checkmark-circle" size={16} color="#22c55e" />
              <Text style={styles.successMessage}>Verification email sent successfully! Please check your inbox.</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  // Mail icon container
  mailIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  // Success state
  successIconContainer: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  redirectText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 24,
  },
  // Error state
  errorIconContainer: {
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  // No token state
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  // Tips container
  tipsContainer: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipBullet: {
    marginRight: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#1e40af',
    flex: 1,
  },
  // Success message
  successMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  successMessage: {
    color: '#166534',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  // Buttons
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  outlineButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  ghostButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
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
