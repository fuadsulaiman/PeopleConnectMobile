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
import { useAuthStore, useSettingsStore } from '../../stores';
import { useTheme } from '../../hooks';
import { LoginScreenProps } from '../../navigation/types';
import { biometricService } from '../../services/biometricService';

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

  const styles = useMemo(() => createStyles(colors), [colors]);

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

  // Show error alerts
  useEffect(() => {
    if (error) {
      Alert.alert('Login Failed', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error, clearError]);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both username and password');
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
            'Authentication Failed',
            'Your saved credentials may be outdated. Please sign in with your password.',
            [
              {
                text: 'OK',
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
      Alert.alert('Error', 'Biometric authentication failed. Please try again or use your password.');
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          {siteLogo ? (
            <Image
              source={{ uri: siteLogo }}
              style={styles.logo}
              resizeMode="contain"
            />
          ) : (
            <Icon name="chatbubbles" size={80} color={colors.primary} />
          )}
          <Text style={styles.title}>{getSiteName()}</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        <View style={styles.form}>
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
              placeholder="Username"
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
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!isLoading && !isAuthenticatingBiometric}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
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
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, (isLoading || isAuthenticatingBiometric) && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading || isAuthenticatingBiometric}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
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
                  <Text style={styles.biometricButtonText}>Sign in with {biometricType}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Do not have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    header: { alignItems: 'center', marginBottom: 48 },
    logo: { width: 200, height: 80, marginBottom: 8 },
    title: { fontSize: 32, fontWeight: 'bold', color: colors.text, marginTop: 16 },
    subtitle: { fontSize: 16, color: colors.textSecondary, marginTop: 8 },
    form: { marginBottom: 32 },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginBottom: 16,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, height: 52, fontSize: 16, color: colors.text },
    eyeIcon: { padding: 4 },
    forgotPassword: { alignSelf: 'flex-end', marginBottom: 24 },
    forgotPasswordText: { color: colors.primary, fontSize: 14, fontWeight: '500' },
    loginButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 52,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loginButtonDisabled: { opacity: 0.7 },
    loginButtonText: { color: colors.white, fontSize: 18, fontWeight: '600' },
    biometricButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      height: 52,
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    biometricButtonDisabled: { opacity: 0.7 },
    biometricButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    footerText: { color: colors.textSecondary, fontSize: 14 },
    registerLink: { color: colors.primary, fontSize: 14, fontWeight: '600', marginLeft: 4 },
  });

export default LoginScreen;
