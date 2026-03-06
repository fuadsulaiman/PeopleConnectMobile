import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  Clipboard,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import QRCode from 'react-native-qrcode-svg';
import { ProfileStackParamList } from '../../navigation/types';
import { useTheme } from '../../hooks';
import { useAuthStore } from '../../stores/authStore';
// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
const getSDK = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.sdk || sdkModule.default;
};
const sdk = { get twoFactor() { return getSDK().twoFactor; } };

type Props = NativeStackScreenProps<ProfileStackParamList, 'TwoFactorSettings'>;

interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

const TwoFactorSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, updateUser } = useAuthStore();

  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal states
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);

  useEffect(() => {
    // Check current 2FA status from user object
    setIs2FAEnabled(user?.twoFactorEnabled || false);
  }, [user?.twoFactorEnabled]);

  const handleEnable2FA = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setIsLoading(true);
    try {
      const response = await sdk.twoFactor.enable(password);
      setSetupData({
        secret: response.secret,
        qrCodeUrl: response.qrCodeUrl,
        backupCodes: response.backupCodes || [],
      });
      setShowSetupModal(true);
      setPassword('');
    } catch (error: any) {
      console.error('Failed to setup 2FA:', error);
      Alert.alert('Error', error?.message || 'Failed to setup 2FA. Please check your password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      await sdk.twoFactor.verify(verificationCode);
      setIs2FAEnabled(true);
      updateUser({ ...user, twoFactorEnabled: true } as any);
      setShowSetupModal(false);
      setSetupData(null);
      setVerificationCode('');

      // Show backup codes after enabling
      try {
        const codes = await sdk.twoFactor.getBackupCodes();
        setBackupCodes(codes.codes);
        setShowBackupCodesModal(true);
      } catch {
        // Backup codes may require regeneration
        Alert.alert('Success', '2FA has been enabled. You can view backup codes in settings.');
      }
    } catch (error: any) {
      console.error('Failed to verify 2FA:', error);
      Alert.alert('Error', error?.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!password || !disableCode) {
      Alert.alert('Error', 'Please enter your password and verification code');
      return;
    }

    setIsLoading(true);
    try {
      await sdk.twoFactor.disable(password, disableCode);
      setIs2FAEnabled(false);
      updateUser({ ...user, twoFactorEnabled: false } as any);
      setShowDisableModal(false);
      setPassword('');
      setDisableCode('');
      Alert.alert('Success', '2FA has been disabled');
    } catch (error: any) {
      console.error('Failed to disable 2FA:', error);
      Alert.alert(
        'Error',
        error?.message || 'Failed to disable 2FA. Please check your credentials.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewBackupCodes = async () => {
    setIsLoading(true);
    try {
      const codes = await sdk.twoFactor.getBackupCodes();
      setBackupCodes(codes.codes);
      setShowBackupCodesModal(true);
    } catch (error: any) {
      // If viewing is not supported, prompt to regenerate
      Alert.alert(
        'Regenerate Backup Codes',
        'To view your backup codes, you need to regenerate them. This will invalidate your existing codes.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Regenerate', onPress: handleRegenerateBackupCodes },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!password) {
      Alert.alert('Enter Password', 'Please enter your password to regenerate backup codes.', [
        { text: 'OK' },
      ]);
      return;
    }

    setIsLoading(true);
    try {
      const codes = await sdk.twoFactor.regenerateBackupCodes(password);
      setBackupCodes(codes.codes);
      setShowBackupCodesModal(true);
    } catch (error: any) {
      console.error('Failed to regenerate backup codes:', error);
      Alert.alert('Error', error?.message || 'Failed to regenerate backup codes.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyAllCodes = () => {
    Clipboard.setString(backupCodes.join('\n'));
    Alert.alert('Copied', 'All backup codes copied to clipboard');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Two-Factor Authentication</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusIconContainer}>
            <Icon
              name={is2FAEnabled ? 'shield-checkmark' : 'shield-outline'}
              size={48}
              color={is2FAEnabled ? colors.success : colors.textSecondary}
            />
          </View>
          <Text style={styles.statusTitle}>
            {is2FAEnabled
              ? 'Two-Factor Authentication Enabled'
              : 'Two-Factor Authentication Disabled'}
          </Text>
          <Text style={styles.statusDescription}>
            {is2FAEnabled
              ? 'Your account is protected with an extra layer of security.'
              : 'Add an extra layer of security to your account by enabling 2FA.'}
          </Text>
        </View>

        {/* Enable/Disable Section */}
        {!is2FAEnabled ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Enable 2FA</Text>
            <Text style={styles.sectionDescription}>
              Enter your password to set up two-factor authentication using an authenticator app.
            </Text>
            <View style={styles.inputWrapper}>
              <Icon
                name="lock-closed-outline"
                size={20}
                color={colors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, (!password || isLoading) && styles.buttonDisabled]}
              onPress={handleEnable2FA}
              disabled={!password || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Icon name="shield-checkmark-outline" size={20} color={colors.white} />
                  <Text style={styles.primaryButtonText}>Enable 2FA</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            <TouchableOpacity style={styles.actionButton} onPress={handleViewBackupCodes}>
              <Icon name="key-outline" size={22} color={colors.primary} />
              <Text style={styles.actionButtonText}>View Backup Codes</Text>
              <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.dangerButton]}
              onPress={() => setShowDisableModal(true)}
            >
              <Icon name="shield-outline" size={22} color={colors.error} />
              <Text style={[styles.actionButtonText, { color: colors.error }]}>Disable 2FA</Text>
              <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>About Two-Factor Authentication</Text>
          <View style={styles.infoItem}>
            <Icon name="checkmark-circle-outline" size={20} color={colors.success} />
            <Text style={styles.infoText}>
              Protects your account even if your password is compromised
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="phone-portrait-outline" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              Use authenticator apps like Google Authenticator or Authy
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="key-outline" size={20} color={colors.warning} />
            <Text style={styles.infoText}>Keep backup codes safe for account recovery</Text>
          </View>
        </View>
      </ScrollView>

      {/* Setup Modal */}
      <Modal visible={showSetupModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Set Up 2FA</Text>
              <Text style={styles.modalDescription}>
                Scan the QR code with your authenticator app, then enter the 6-digit code below.
              </Text>

              {setupData && (
                <>
                  <View style={styles.qrContainer}>
                    <QRCode value={setupData.qrCodeUrl} size={200} />
                  </View>

                  <Text style={styles.manualEntryLabel}>Or enter this code manually:</Text>
                  <TouchableOpacity
                    style={styles.secretContainer}
                    onPress={() => copyToClipboard(setupData.secret)}
                  >
                    <Text style={styles.secretText}>{setupData.secret}</Text>
                    <Icon
                      name={copiedCode === setupData.secret ? 'checkmark' : 'copy-outline'}
                      size={20}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.modalInputContainer}>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={styles.codeInput}
                  placeholder="000000"
                  placeholderTextColor={colors.textSecondary}
                  value={verificationCode}
                  onChangeText={(text) => setVerificationCode(text.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  textAlign="center"
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setShowSetupModal(false);
                    setSetupData(null);
                    setVerificationCode('');
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    { flex: 1, marginLeft: 8 },
                    (verificationCode.length !== 6 || isLoading) && styles.buttonDisabled,
                  ]}
                  onPress={handleVerify2FA}
                  disabled={verificationCode.length !== 6 || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify & Enable</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Disable Modal */}
      <Modal visible={showDisableModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Disable 2FA</Text>
            <Text style={styles.modalDescription}>
              Enter your password and a verification code from your authenticator app to disable
              2FA.
            </Text>

            <View style={styles.modalInputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.modalInputContainer}>
              <Text style={styles.label}>Verification Code</Text>
              <TextInput
                style={styles.codeInput}
                placeholder="000000"
                placeholderTextColor={colors.textSecondary}
                value={disableCode}
                onChangeText={(text) => setDisableCode(text.replace(/\D/g, '').slice(0, 8))}
                keyboardType="number-pad"
                maxLength={8}
                textAlign="center"
              />
              <Text style={styles.hint}>Enter code from app or a backup code</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setShowDisableModal(false);
                  setPassword('');
                  setDisableCode('');
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dangerPrimaryButton,
                  { flex: 1, marginLeft: 8 },
                  (!password || !disableCode || isLoading) && styles.buttonDisabled,
                ]}
                onPress={handleDisable2FA}
                disabled={!password || !disableCode || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Disable 2FA</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Backup Codes Modal */}
      <Modal visible={showBackupCodesModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Backup Codes</Text>
            <Text style={styles.modalDescription}>
              Save these codes in a safe place. Each code can only be used once.
            </Text>

            <View style={styles.codesContainer}>
              {backupCodes.map((code, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.codeItem}
                  onPress={() => copyToClipboard(code)}
                >
                  <Text style={styles.codeText}>{code}</Text>
                  <Icon
                    name={copiedCode === code ? 'checkmark' : 'copy-outline'}
                    size={18}
                    color={copiedCode === code ? colors.success : colors.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.copyAllButton} onPress={copyAllCodes}>
              <Icon name="copy-outline" size={20} color={colors.primary} />
              <Text style={styles.copyAllText}>Copy All Codes</Text>
            </TouchableOpacity>

            <View style={styles.warningBox}>
              <Icon name="warning-outline" size={20} color={colors.warning} />
              <Text style={styles.warningText}>
                Each backup code can only be used once. Store them somewhere safe.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowBackupCodesModal(false)}
            >
              <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) =>
  StyleSheet.create({
    actionButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      flexDirection: 'row',
      marginBottom: 12,
      padding: 16,
    },
    actionButtonText: {
      color: colors.text,
      flex: 1,
      fontSize: 16,
      marginLeft: 12,
    },
    backButton: {
      padding: 8,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    codeInput: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      color: colors.text,
      fontSize: 24,
      letterSpacing: 8,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    codeItem: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
      padding: 12,
      width: '48%',
    },
    codeText: {
      color: colors.text,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 14,
    },
    codesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    container: {
      backgroundColor: colors.background,
      flex: 1,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    copyAllButton: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 16,
      padding: 12,
    },
    copyAllText: {
      color: colors.primary,
      fontSize: 16,
      marginLeft: 8,
    },
    dangerButton: {
      borderColor: colors.error,
      borderWidth: 1,
    },
    dangerPrimaryButton: {
      alignItems: 'center',
      backgroundColor: colors.error,
      borderRadius: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    header: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '600',
    },
    hint: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 4,
      textAlign: 'center',
    },
    infoItem: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      marginBottom: 12,
    },
    infoSection: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginTop: 8,
      padding: 16,
    },
    infoText: {
      color: colors.textSecondary,
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      marginLeft: 12,
    },
    infoTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 12,
    },
    input: {
      color: colors.text,
      flex: 1,
      fontSize: 16,
      paddingHorizontal: 12,
      paddingVertical: 14,
    },
    inputIcon: {
      marginLeft: 12,
    },
    inputWrapper: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: 16,
    },
    label: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 8,
    },
    manualEntryLabel: {
      color: colors.textSecondary,
      fontSize: 14,
      marginBottom: 8,
      textAlign: 'center',
    },
    modalButtons: {
      flexDirection: 'row',
      marginTop: 16,
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      padding: 24,
    },
    modalDescription: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 24,
      textAlign: 'center',
    },
    modalInputContainer: {
      marginBottom: 16,
    },
    modalOverlay: {
      backgroundColor: 'rgba(0,0,0,0.5)',
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '600',
      marginBottom: 8,
      textAlign: 'center',
    },
    placeholder: {
      width: 40,
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    primaryButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    qrContainer: {
      alignItems: 'center',
      backgroundColor: colors.white,
      borderRadius: 12,
      marginBottom: 16,
      padding: 20,
    },
    secondaryButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flex: 1,
      paddingVertical: 14,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    secretContainer: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 8,
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 24,
      padding: 12,
    },
    secretText: {
      color: colors.text,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 14,
      marginRight: 8,
    },
    section: {
      marginBottom: 24,
    },
    sectionDescription: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
    },
    statusCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginBottom: 24,
      padding: 24,
    },
    statusDescription: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    statusIconContainer: {
      marginBottom: 16,
    },
    statusTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 8,
      textAlign: 'center',
    },
    warningBox: {
      alignItems: 'flex-start',
      backgroundColor: `${colors.warning}20`,
      borderRadius: 8,
      flexDirection: 'row',
      marginBottom: 16,
      padding: 12,
    },
    warningText: {
      color: colors.warning,
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      marginLeft: 8,
    },
  });

export default TwoFactorSettingsScreen;
