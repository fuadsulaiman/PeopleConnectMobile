import React, { useState, useEffect, useMemo } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTheme } from '../../hooks';
import { RegisterScreenProps } from '../../navigation/types';

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { register, isLoading, error, clearError } = useAuthStore();
  const { fetchPublicSettings, isInviteOnlyMode, isRegistrationEnabled } = useSettingsStore();
  const { colors } = useTheme();

  const styles = useMemo(() => createStyles(colors), [colors]);

  // Fetch public settings to check invite-only mode
  useEffect(() => {
    fetchPublicSettings();
  }, [fetchPublicSettings]);

  useEffect(() => {
    if (error) {
      Alert.alert('Registration Failed', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error, clearError]);

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    if (pwd.length < 8) {
      errors.push('At least 8 characters');
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push('One uppercase letter');
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push('One lowercase letter');
    }
    if (!/[0-9]/.test(pwd)) {
      errors.push('One number');
    }
    return errors;
  };

  const handleRegister = async () => {
    // Validate all fields
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    // Validate password requirements
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      Alert.alert(
        'Password Requirements',
        'Password must have:\n' + passwordErrors.map((e) => '- ' + e).join('\n')
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    // Check invitation code if invite-only mode
    if (isInviteOnlyMode() && !invitationCode.trim()) {
      Alert.alert('Error', 'Please enter your invitation code');
      return;
    }

    const success = await register(
      name.trim(),
      username.trim(),
      email.trim(),
      password,
      isInviteOnlyMode() ? invitationCode.trim() : undefined
    );

    if (success) {
      Alert.alert('Success', 'Account created successfully');
    }
  };

  // If registration is disabled, show message
  if (isRegistrationEnabled && !isRegistrationEnabled()) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.disabledContainer}>
          <Icon name="lock-closed-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.disabledTitle}>Registration Closed</Text>
          <Text style={styles.disabledText}>
            New account registration is currently not available. Please contact the administrator
            for access.
          </Text>
          <TouchableOpacity
            style={styles.backToLoginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.backToLoginText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>
        </View>

        <View style={styles.form}>
          {/* Name Input */}
          <View style={styles.inputContainer}>
            <Icon
              name="person-outline"
              size={20}
              color={colors.textSecondary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              editable={!isLoading}
              autoCapitalize="words"
            />
          </View>

          {/* Username Input */}
          <View style={styles.inputContainer}>
            <Icon
              name="at-outline"
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
              editable={!isLoading}
            />
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Icon
              name="mail-outline"
              size={20}
              color={colors.textSecondary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          {/* Invitation Code Input (only if invite-only mode) */}
          {isInviteOnlyMode() && (
            <View style={styles.inputContainer}>
              <Icon
                name="ticket-outline"
                size={20}
                color={colors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Invitation Code"
                placeholderTextColor={colors.textSecondary}
                value={invitationCode}
                onChangeText={setInvitationCode}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
          )}

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
              editable={!isLoading}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Icon
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Password Requirements */}
          <View style={styles.passwordRequirements}>
            <Text style={styles.requirementsTitle}>Password Requirements:</Text>
            <View style={styles.requirementRow}>
              <Icon
                name={password.length >= 8 ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={password.length >= 8 ? colors.success : colors.textSecondary}
              />
              <Text style={[styles.requirementText, password.length >= 8 && styles.requirementMet]}>
                At least 8 characters
              </Text>
            </View>
            <View style={styles.requirementRow}>
              <Icon
                name={/[A-Z]/.test(password) ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={/[A-Z]/.test(password) ? colors.success : colors.textSecondary}
              />
              <Text
                style={[styles.requirementText, /[A-Z]/.test(password) && styles.requirementMet]}
              >
                One uppercase letter
              </Text>
            </View>
            <View style={styles.requirementRow}>
              <Icon
                name={/[a-z]/.test(password) ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={/[a-z]/.test(password) ? colors.success : colors.textSecondary}
              />
              <Text
                style={[styles.requirementText, /[a-z]/.test(password) && styles.requirementMet]}
              >
                One lowercase letter
              </Text>
            </View>
            <View style={styles.requirementRow}>
              <Icon
                name={/[0-9]/.test(password) ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={/[0-9]/.test(password) ? colors.success : colors.textSecondary}
              />
              <Text
                style={[styles.requirementText, /[0-9]/.test(password) && styles.requirementMet]}
              >
                One number
              </Text>
            </View>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Icon
              name="lock-closed-outline"
              size={20}
              color={colors.textSecondary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              editable={!isLoading}
            />
          </View>

          {/* Password Match Indicator */}
          {confirmPassword.length > 0 && (
            <View style={styles.matchIndicator}>
              <Icon
                name={password === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={password === confirmPassword ? colors.success : colors.error}
              />
              <Text
                style={[
                  styles.matchText,
                  { color: password === confirmPassword ? colors.success : colors.error },
                ]}
              >
                {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
              </Text>
            </View>
          )}

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.registerButtonText}>Sign Up</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    backButton: { marginBottom: 16 },
    backToLoginButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      marginTop: 24,
      paddingHorizontal: 32,
      paddingVertical: 12,
    },
    backToLoginText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    container: { backgroundColor: colors.background, flex: 1 },
    disabledContainer: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 32,
    },
    disabledText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 8,
      textAlign: 'center',
    },
    disabledTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: 'bold',
      marginTop: 16,
    },
    eyeIcon: { padding: 4 },
    footer: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    footerText: { color: colors.textSecondary, fontSize: 14 },
    form: { marginBottom: 32 },
    header: { marginBottom: 24, marginTop: 20 },
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
    loginLink: { color: colors.primary, fontSize: 14, fontWeight: '600', marginLeft: 4 },
    matchIndicator: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 16,
      marginLeft: 4,
    },
    matchText: {
      fontSize: 12,
      marginLeft: 6,
    },
    passwordRequirements: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      marginBottom: 16,
      padding: 12,
    },
    registerButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 52,
      justifyContent: 'center',
      marginTop: 8,
    },
    registerButtonDisabled: { opacity: 0.7 },
    registerButtonText: { color: colors.white, fontSize: 18, fontWeight: '600' },
    requirementMet: {
      color: colors.success,
    },
    requirementRow: {
      alignItems: 'center',
      flexDirection: 'row',
      marginVertical: 2,
    },
    requirementText: {
      color: colors.textSecondary,
      fontSize: 12,
      marginLeft: 6,
    },
    requirementsTitle: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 8,
    },
    scrollContent: { flexGrow: 1, padding: 24 },
    subtitle: { color: colors.textSecondary, fontSize: 16, marginTop: 8 },
    title: { color: colors.text, fontSize: 32, fontWeight: 'bold' },
  });

export default RegisterScreen;
