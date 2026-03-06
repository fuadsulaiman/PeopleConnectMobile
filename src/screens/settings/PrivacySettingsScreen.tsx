import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { useTheme } from '../../hooks';
// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
const getSDK = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.sdk || sdkModule.default;
};
const sdk = { getAccessToken: () => getSDK().getAccessToken() };

type Props = NativeStackScreenProps<ProfileStackParamList, 'PrivacySettings'>;

interface PrivacySettings {
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  showReadReceipts: boolean;
  showTypingIndicator: boolean;
}

const PrivacySettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<PrivacySettings>({
    showOnlineStatus: true,
    showLastSeen: true,
    showReadReceipts: true,
    showTypingIndicator: true,
  });

  useEffect(() => {
    loadPrivacySettings();
  }, []);

  const loadPrivacySettings = async () => {
    try {
      setIsLoading(true);
      // Call the API directly using SDK's base functionality
      const privacyData = await makeApiCall('GET', '/users/me/privacy-settings');
      setSettings({
        showOnlineStatus: privacyData.showOnlineStatus ?? true,
        showLastSeen: privacyData.showLastSeen ?? true,
        showReadReceipts: privacyData.showReadReceipts ?? true,
        showTypingIndicator: privacyData.showTypingIndicator ?? true,
      });
    } catch (error) {
      console.error('Failed to load privacy settings:', error);
      // Use default values on error
    } finally {
      setIsLoading(false);
    }
  };

  const makeApiCall = async (method: string, endpoint: string, body?: any) => {
    const token = sdk.getAccessToken();
    const baseUrl = 'https://3.121.226.182/api'; // Use the configured API URL

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }

    const data = await response.json();
    return data.data || data;
  };

  const updateSetting = async (key: keyof PrivacySettings, value: boolean) => {
    const previousSettings = { ...settings };

    // Optimistically update UI
    setSettings((prev) => ({ ...prev, [key]: value }));

    try {
      setIsSaving(true);
      await makeApiCall('PUT', '/users/me/privacy-settings', {
        ...settings,
        [key]: value,
      });
    } catch (error) {
      console.error('Failed to update privacy setting:', error);
      // Revert on error
      setSettings(previousSettings);
      Alert.alert('Error', 'Failed to update privacy setting. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy Settings</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Settings</Text>
        {isSaving ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.placeholder} />
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionDescription}>
          Control who can see your information and activity status.
        </Text>

        {/* Online Status */}
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <View style={styles.settingIconContainer}>
              <Icon
                name="ellipse"
                size={20}
                color={settings.showOnlineStatus ? colors.success : colors.textSecondary}
              />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Show Online Status</Text>
              <Text style={styles.settingDescription}>Let others see when you are online</Text>
            </View>
          </View>
          <Switch
            value={settings.showOnlineStatus}
            onValueChange={(value) => updateSetting('showOnlineStatus', value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        {/* Last Seen */}
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <View style={styles.settingIconContainer}>
              <Icon name="time-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Show Last Seen</Text>
              <Text style={styles.settingDescription}>
                Let others see when you were last active
              </Text>
            </View>
          </View>
          <Switch
            value={settings.showLastSeen}
            onValueChange={(value) => updateSetting('showLastSeen', value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        {/* Read Receipts */}
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <View style={styles.settingIconContainer}>
              <Icon name="checkmark-done-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Read Receipts</Text>
              <Text style={styles.settingDescription}>
                Let others know when you have read their messages
              </Text>
            </View>
          </View>
          <Switch
            value={settings.showReadReceipts}
            onValueChange={(value) => updateSetting('showReadReceipts', value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        {/* Typing Indicator */}
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <View style={styles.settingIconContainer}>
              <Icon name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Typing Indicator</Text>
              <Text style={styles.settingDescription}>
                Let others see when you are typing a message
              </Text>
            </View>
          </View>
          <Switch
            value={settings.showTypingIndicator}
            onValueChange={(value) => updateSetting('showTypingIndicator', value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Icon name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Your privacy settings sync across all your devices. Changes may take a few moments to
            apply everywhere.
          </Text>
        </View>

        {/* Note about admin settings */}
        <View style={styles.noteBox}>
          <Icon name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.noteText}>
            Some privacy settings may be controlled by your administrator. If a toggle is disabled,
            contact your admin for more information.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) =>
  StyleSheet.create({
    backButton: {
      padding: 8,
    },
    container: {
      backgroundColor: colors.background,
      flex: 1,
    },
    content: {
      flex: 1,
      padding: 16,
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
    infoBox: {
      alignItems: 'flex-start',
      backgroundColor: `${colors.primary}10`,
      borderRadius: 12,
      flexDirection: 'row',
      marginTop: 12,
      padding: 16,
    },
    infoText: {
      color: colors.primary,
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      marginLeft: 12,
    },
    loadingContainer: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    noteBox: {
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: 12,
      flexDirection: 'row',
      marginTop: 12,
      padding: 16,
    },
    noteText: {
      color: colors.textSecondary,
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      marginLeft: 12,
    },
    placeholder: {
      width: 40,
    },
    sectionDescription: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 24,
    },
    settingDescription: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    settingIconContainer: {
      alignItems: 'center',
      backgroundColor: `${colors.primary}15`,
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      marginRight: 12,
      width: 40,
    },
    settingInfo: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      marginRight: 16,
    },
    settingItem: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
      padding: 16,
    },
    settingTextContainer: {
      flex: 1,
    },
    settingTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 2,
    },
  });

export default PrivacySettingsScreen;
