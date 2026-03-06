import React, { useState, useRef } from 'react';
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
import { useAuthStore } from '../../stores/authStore';
import { LoadingScreen } from '../../components/common/LoadingScreen';

type Props = NativeStackScreenProps<AuthStackParamList, 'TwoFactor'>;

export const TwoFactorScreen: React.FC<Props> = ({ route }) => {
  const { tempToken } = route.params;
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const verify2FA = useAuthStore((state) => state.verify2FA);

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Move to next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const verificationCode = code.join('');
    if (verificationCode.length !== 6) {
      Alert.alert('Error', 'Please enter the complete verification code');
      return;
    }

    setIsLoading(true);
    try {
      const success = await verify2FA(tempToken, verificationCode);
      if (!success) {
        Alert.alert('Verification Failed', 'Invalid verification code');
      }
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = () => {
    Alert.alert('Code Sent', 'A new verification code has been sent to your device');
  };

  if (isLoading) {
    return <LoadingScreen message="Verifying..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Two-Factor Authentication</Text>
          <Text style={styles.subtitle}>Enter the 6-digit code from your authenticator app</Text>
        </View>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={styles.codeInput}
              value={digit}
              onChangeText={(text) => handleCodeChange(text.replace(/[^0-9]/g, ''), index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              autoFocus={index === 0}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.verifyButton} onPress={handleVerify}>
          <Text style={styles.verifyButtonText}>Verify</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendButton} onPress={handleResendCode}>
          <Text style={styles.resendButtonText}>Resend Code</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  codeInput: {
    borderColor: '#e0e0e0',
    borderRadius: 12,
    borderWidth: 2,
    color: '#1a1a1a',
    fontSize: 24,
    fontWeight: 'bold',
    height: 56,
    textAlign: 'center',
    width: 48,
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  resendButton: {
    alignItems: 'center',
    padding: 16,
  },
  resendButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  subtitle: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  title: {
    color: '#1a1a1a',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  verifyButton: {
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TwoFactorScreen;
