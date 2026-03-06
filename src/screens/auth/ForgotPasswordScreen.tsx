import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
const getAuth = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.auth;
};
const auth = { forgotPassword: (email: string) => getAuth().forgotPassword(email) };
import { LoadingScreen } from '../../components/common/LoadingScreen';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      await auth.forgotPassword(email.trim());
      setIsEmailSent(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Sending reset email..." />;
  }

  if (isEmailSent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>✉️</Text>
            <Text style={styles.successTitle}>Check Your Email</Text>
            <Text style={styles.successText}>
              We have sent a password reset link to {email}. Please check your inbox and follow the
              instructions.
            </Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.backButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <TouchableOpacity style={styles.backNav} onPress={() => navigation.goBack()}>
          <Text style={styles.backNavText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            Enter your email address and we will send you a link to reset your password.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Send Reset Link</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  backButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 48,
    paddingVertical: 16,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backNav: {
    marginBottom: 24,
  },
  backNavText: {
    color: '#007AFF',
    fontSize: 16,
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  form: {
    flex: 1,
  },
  header: {
    marginBottom: 32,
  },
  input: {
    borderColor: '#e0e0e0',
    borderRadius: 12,
    borderWidth: 1,
    color: '#1a1a1a',
    fontSize: 16,
    marginBottom: 24,
    padding: 16,
  },
  label: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
  },
  successContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  successText: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  successTitle: {
    color: '#1a1a1a',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  title: {
    color: '#1a1a1a',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
});

export default ForgotPasswordScreen;
