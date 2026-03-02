import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuthStore, useSettingsStore } from '../../stores';
import { useTheme } from '../../hooks';
import { LoginScreenProps } from '../../navigation/types';

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError, requiresTwoFactor, tempToken } = useAuthStore();
  const { fetchPublicSettings, getSiteName, getSiteLogo } = useSettingsStore();
  const { colors } = useTheme();
  const siteLogo = getSiteLogo();

  // Create dynamic styles based on theme colors
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Fetch public settings (site name) on mount
  useEffect(() => {
    fetchPublicSettings();
  }, [fetchPublicSettings]);

  React.useEffect(() => {
    if (requiresTwoFactor && tempToken) {
      navigation.navigate('TwoFactor', { tempToken });
    }
  }, [requiresTwoFactor, tempToken, navigation]);

  React.useEffect(() => {
    if (error) {
      Alert.alert('Login Failed', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error, clearError]);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }
    await login(username.trim(), password);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          {siteLogo ? (
            <Image source={{ uri: siteLogo }} style={styles.logo} resizeMode="contain" />
          ) : (
            <Icon name="chatbubbles" size={80} color={colors.primary} />
          )}
          <Text style={styles.title}>{getSiteName()}</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Icon name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Username" placeholderTextColor={colors.textSecondary} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} editable={!isLoading} />
          </View>
          <View style={styles.inputContainer}>
            <Icon name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.textSecondary} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} editable={!isLoading} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.loginButton, isLoading && styles.loginButtonDisabled]} onPress={handleLogin} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.loginButtonText}>Sign In</Text>}
          </TouchableOpacity>
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

// Create styles dynamically based on theme colors
const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 48 },
  logo: { width: 200, height: 80, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: 'bold', color: colors.text, marginTop: 16 },
  subtitle: { fontSize: 16, color: colors.textSecondary, marginTop: 8 },
  form: { marginBottom: 32 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, marginBottom: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: 52, fontSize: 16, color: colors.text },
  eyeIcon: { padding: 4 },
  forgotPassword: { alignSelf: 'flex-end', marginBottom: 24 },
  forgotPasswordText: { color: colors.primary, fontSize: 14, fontWeight: '500' },
  loginButton: { backgroundColor: colors.primary, borderRadius: 12, height: 52, justifyContent: 'center', alignItems: 'center' },
  loginButtonDisabled: { opacity: 0.7 },
  loginButtonText: { color: colors.white, fontSize: 18, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { color: colors.textSecondary, fontSize: 14 },
  registerLink: { color: colors.primary, fontSize: 14, fontWeight: '600', marginLeft: 4 },
});

export default LoginScreen;
