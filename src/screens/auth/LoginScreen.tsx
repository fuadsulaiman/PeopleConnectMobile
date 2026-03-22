import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTheme } from '../../hooks';
import { LoginScreenProps } from '../../navigation/types';
import { biometricService } from '../../services/biometricService';
import { useAppTranslation } from '../../i18n/useTranslation';

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometric');
  const [isAuthenticatingBiometric, setIsAuthenticatingBiometric] = useState(false);

  const { login, isLoading, error, clearError, requiresTwoFactor, tempToken } = useAuthStore();
  const { fetchPublicSettings, getSiteName, getSiteLogo } = useSettingsStore();
  const { colors } = useTheme();
  const siteLogo = getSiteLogo();
  const { t } = useAppTranslation();

  const styles = useMemo(() => createStyles(colors), [colors]);

  // Check if error looks like a ban message (contains "banned" keyword)
  const isBanError = error ? /banned/i.test(error) : false;

  // Fetch public settings and biometric status on mount
  useEffect(() => {
    fetchPublicSettings();
    checkBiometricStatus();
  }, [fetchPublicSettings]);

  const checkBiometricStatus = useCallback(async () => {
    try {
      const isAvailable = await biometricService.isBiometricAvailable();
      setBiometricAvailable(isAvailable);

      if (isAvailable) {
        const isEnabled = await biometricService.isBiometricEnabled();
        setBiometricEnabled(isEnabled);

        const typeName = await biometricService.getBiometricTypeName();
        setBiometricType(typeName);
      }
    } catch (err) {
      console.error('Error checking biometric status:', err);
    }
  }, []);

  // Navigate to 2FA screen when required
  useEffect(() => {
    if (requiresTwoFactor && tempToken) {
      navigation.navigate('TwoFactor', { tempToken });
    }
  }, [requiresTwoFactor, tempToken, navigation]);

  // Show error alert only for non-ban errors (ban errors shown inline)
  useEffect(() => {
    if (error && !isBanError) {
      Alert.alert(t('auth.loginFailed'), error, [{ text: t('common.ok'), onPress: clearError }]);
    }
  }, [error, isBanError, clearError, t]);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert(t('common.error'), t('auth.enterBothFields'));
      return;
    }

    const success = await login(username.trim(), password);

    // Prompt to enable biometric after successful login
    if (success && biometricAvailable && !biometricEnabled) {
      await biometricService.promptEnableBiometric(username.trim(), password);
      checkBiometricStatus();
    }
  };

  const handleBiometricLogin = async () => {
    if (!biometricEnabled) {
      return;
    }

    setIsAuthenticatingBiometric(true);
    try {
      const credentials = await biometricService.authenticateWithBiometric();

      if (credentials) {
        const success = await login(credentials.username, credentials.password);

        if (!success) {
          // Credentials might be outdated, disable biometric
          Alert.alert(
            t('auth.authFailed'),
            t('auth.savedCredentialsOutdated'),
            [
              {
                text: t('common.ok'),
                onPress: async () => {
                  await biometricService.disableBiometric();
                  setBiometricEnabled(false);
                },
              },
            ]
          );
        }
      }
    } catch (err: any) {
      console.error('Biometric login error:', err);
      Alert.alert(
        t('common.error'),
        t('auth.authFailedBiometric')
      );
    } finally {
      setIsAuthenticatingBiometric(false);
    }
  };

  const getBiometricIcon = (): string => {
    switch (biometricType) {
      case 'Face ID':
        return 'scan-outline';
      case 'Touch ID':
      case 'Fingerprint':
        return 'finger-print-outline';
      default:
        return 'finger-print-outline';
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          {siteLogo ? (
            <Image source={{ uri: siteLogo }} style={styles.logo} resizeMode="contain" />
          ) : (
            <Icon name="chatbubbles" size={80} color={colors.primary} />
          )}
          <Text style={styles.title}>{getSiteName()}</Text>
          <Text style={styles.subtitle}>{t('auth.signInToContinue')}</Text>
        </View>

        <View style={styles.form}>
          {/* Ban Error Banner - shown inline for long ban messages */}
          {isBanError && error && (
            <View style={styles.banErrorContainer}>
              <View style={styles.banErrorHeader}>
                <Icon name="ban-outline" size={22} color={colors.error} />
                <Text style={styles.banErrorTitle}>{t('auth.accountBanned')}</Text>
              </View>
              <Text style={styles.banErrorMessage}>{error}</Text>
              <TouchableOpacity onPress={clearError} style={styles.banErrorDismiss}>
                <Text style={styles.banErrorDismissText}>{t('common.ok')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Username Input */}
          <View style={styles.inputContainer}>
            <Icon
              name="person-outline"
              size={20}
              color={colors.textSecondary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder={t('auth.username')}
              placeholderTextColor={colors.textSecondary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading && !isAuthenticatingBiometric}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Icon
              name="lock-closed-outline"
              size={20}
              color={colors.textSecondary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder={t('auth.password')}
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!isLoading && !isAuthenticatingBiometric}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Icon
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Forgot Password Link */}
          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotPassword}
          >
            <Text style={styles.forgotPasswordText}>{t('auth.forgotPassword')}</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[
              styles.loginButton,
              (isLoading || isAuthenticatingBiometric) && styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={isLoading || isAuthenticatingBiometric}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.loginButtonText}>{t('auth.signIn')}</Text>
            )}
          </TouchableOpacity>

          {/* Biometric Login Button */}
          {biometricEnabled && (
            <TouchableOpacity
              style={[
                styles.biometricButton,
                (isLoading || isAuthenticatingBiometric) && styles.biometricButtonDisabled,
              ]}
              onPress={handleBiometricLogin}
              disabled={isLoading || isAuthenticatingBiometric}
            >
              {isAuthenticatingBiometric ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Icon name={getBiometricIcon()} size={24} color={colors.primary} />
                  <Text style={styles.biometricButtonText}>{t('auth.signInWith', { method: biometricType })}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.dontHaveAccount')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLink}>{t('auth.signUp')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    banErrorContainer: {
      backgroundColor: colors.surface,
      borderColor: colors.error,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 20,
      padding: 16,
    },
    banErrorDismiss: {
      alignSelf: 'flex-end',
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    banErrorDismissText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    banErrorHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 8,
    },
    banErrorMessage: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    banErrorTitle: {
      color: colors.error,
      fontSize: 16,
      fontWeight: '700',
      marginLeft: 8,
    },
    biometricButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.primary,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      height: 52,
      justifyContent: 'center',
      marginTop: 16,
    },
    biometricButtonDisabled: { opacity: 0.7 },
    biometricButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    container: { backgroundColor: colors.background, flex: 1 },
    eyeIcon: { padding: 4 },
    footer: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
    footerText: { color: colors.textSecondary, fontSize: 14 },
    forgotPassword: { alignSelf: 'flex-end', marginBottom: 24 },
    forgotPasswordText: { color: colors.primary, fontSize: 14, fontWeight: '500' },
    form: { marginBottom: 32 },
    header: { alignItems: 'center', marginBottom: 48 },
    input: { color: colors.text, flex: 1, fontSize: 16, height: 52 },
    inputContainer: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: 16,
      paddingHorizontal: 16,
    },
    inputIcon: { marginRight: 12 },
    loginButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 52,
      justifyContent: 'center',
    },
    loginButtonDisabled: { opacity: 0.7 },
    loginButtonText: { color: colors.white, fontSize: 18, fontWeight: '600' },
    logo: { height: 80, marginBottom: 8, width: 200 },
    registerLink: { color: colors.primary, fontSize: 14, fontWeight: '600', marginLeft: 4 },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    subtitle: { color: colors.textSecondary, fontSize: 16, marginTop: 8 },
    title: { color: colors.text, fontSize: 32, fontWeight: 'bold', marginTop: 16 },
  });

export default LoginScreen;
